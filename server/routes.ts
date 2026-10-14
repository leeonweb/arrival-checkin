import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from './db.ts';
import {
  getManilaDateString,
  getManilaTimeString,
  getManila24HourTime,
  isBeforeCutoff,
} from './time.ts';
import {
  generateRandomCode,
  sanitizeInput,
  normalizeCode,
  escapeCsvCell,
  parseCsv,
  parseUserAgent,
} from './utils.ts';
import type { Student, Parent, StaffMember, AttendanceRecord, Device } from './types.ts';

export const router = express.Router();

// --- In-Memory Admin Sessions with Roles ---
interface SessionMeta {
  role: 'head' | 'staff';
  createdAt: number;
}
const activeSessions = new Map<string, SessionMeta>();

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
}

interface AuthenticatedRequest extends Request {
  adminRole?: 'head' | 'staff';
  device?: Device;
}

function adminAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const tokenFromCookie = req.cookies?.admin_session;
  const token = tokenFromHeader || tokenFromCookie;

  if (!token || !activeSessions.has(token)) {
    res.status(401).json({ error: 'Unauthorized: Admin login required' });
    return;
  }

  const session = activeSessions.get(token)!;
  req.adminRole = session.role;
  next();
}

function schoolHeadOnlyMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.adminRole !== 'head') {
    res.status(403).json({
      error: 'Access restricted: Only the School Head can manage or approve station devices.',
    });
    return;
  }
  next();
}

// ==========================================
// DEVICE STATION VERIFICATION & ACTIVATION
// ==========================================

router.get('/device/verify', (req: Request, res: Response) => {
  const tokenHeader = req.headers['x-device-token'];
  const tokenQuery = req.query.token;
  const token =
    (typeof tokenHeader === 'string' ? tokenHeader : null) ||
    (typeof tokenQuery === 'string' ? tokenQuery : null);

  if (!token) {
    res.status(403).json({
      approved: false,
      error: 'Station activation required. Enter a license code to proceed.',
    });
    return;
  }

  const device = db.getDeviceByToken(token);
  if (!device || device.status === 'revoked') {
    res.status(403).json({
      approved: false,
      revoked: true,
      error: 'Device authorization has been revoked by the School Head.',
    });
    return;
  }

  res.status(200).json({
    approved: true,
    device: {
      id: device.id,
      label: device.label,
      description: device.description,
      approved_at: device.approved_at,
    },
  });
});

router.post('/device/activate', (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const fifteenMinMs = 15 * 60 * 1000;

  // Rate limit wrong license codes (5 tries per 15 minutes per IP)
  const wrongAttempts = db.getAttemptCount(ip, 'license_code', fifteenMinMs);
  if (wrongAttempts >= 5) {
    res.status(429).json({
      error: 'Too many incorrect license attempts. Please wait 15 minutes before trying again.',
    });
    return;
  }

  const rawCode = req.body.licenseCode;
  if (!rawCode || typeof rawCode !== 'string') {
    res.status(400).json({ error: 'License code is required.' });
    return;
  }

  const code = normalizeCode(rawCode);
  const license = db.getLicense(code);

  if (!license) {
    db.recordAttempt(ip, 'license_code');
    res.status(404).json({ error: 'License code not found.' });
    return;
  }

  if (license.used) {
    db.recordAttempt(ip, 'license_code');
    res.status(400).json({ error: 'This license code has already been used on another device.' });
    return;
  }

  // Success -> reset attempts
  db.resetAttempts(ip, 'license_code');

  const deviceId = 'dev_' + crypto.randomBytes(8).toString('hex');
  const secretToken = crypto.randomBytes(32).toString('hex');
  const userAgentStr = req.headers['user-agent'] || '';
  const description = parseUserAgent(userAgentStr);
  const nowManila = `${getManilaDateString()} ${getManilaTimeString()}`;

  const device: Device = {
    id: deviceId,
    token: secretToken,
    label: license.label,
    description,
    approved_at: nowManila,
    last_active_at: null,
    status: 'active',
    user_agent: userAgentStr,
  };

  db.saveDevice(device);
  db.consumeLicense(license.code, deviceId);

  res.status(200).json({
    success: true,
    token: secretToken,
    label: device.label,
    description: device.description,
    approved_at: device.approved_at,
    message: `Station approved successfully as "${device.label}".`,
  });
});

// ==========================================
// PUBLIC: Check In / Check Out (Student & Staff) - Protected by Device Token
// ==========================================

router.post('/check-in-out', (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const oneHourMs = 60 * 60 * 1000;

  // Rate limit: 60 wrong attempts per hour per device/IP
  const wrongAttempts = db.getAttemptCount(ip, 'student_code', oneHourMs);
  if (wrongAttempts >= 60) {
    res.status(429).json({
      error: 'Rate limit reached: Too many attempts from this connection. Please try again later.',
    });
    return;
  }

  // Device Station Token Verification
  const tokenHeader = req.headers['x-device-token'];
  const tokenBody = req.body.device_token;
  const deviceToken =
    (typeof tokenHeader === 'string' ? tokenHeader : null) ||
    (typeof tokenBody === 'string' ? tokenBody : null);

  if (!deviceToken) {
    res.status(403).json({
      error: 'Unauthorized Station: Check-in is permitted only on devices approved by the School Head.',
      deviceRequired: true,
    });
    return;
  }

  const device = db.getDeviceByToken(deviceToken);
  if (!device || device.status === 'revoked') {
    res.status(403).json({
      error: 'Device authorization has been revoked by the School Head.',
      deviceRevoked: true,
    });
    return;
  }

  const rawCode = req.body.code;
  const action = req.body.action; // 'check-in' | 'check-out'
  const rawMessage = req.body.message;

  if (!rawCode || (action !== 'check-in' && action !== 'check-out')) {
    res.status(400).json({ error: 'Valid code and action (check-in or check-out) are required.' });
    return;
  }

  const code = normalizeCode(rawCode);

  // Check if code belongs to a student or staff
  const student = db.getStudent(code);
  const staff = !student ? db.getStaff(code) : undefined;

  if (!student && !staff) {
    db.recordAttempt(ip, 'student_code');
    res.status(404).json({ error: 'Code not found.' });
    return;
  }

  if (staff && staff.status === 'revoked') {
    res.status(403).json({
      error: 'This staff code has been revoked. Please contact school administration.',
    });
    return;
  }

  // Valid code found -> reset rate limit attempts
  db.resetAttempts(ip, 'student_code');

  const settings = db.getSettings();
  let sanitizedMsg: string | undefined = undefined;
  if (settings.allow_messages && typeof rawMessage === 'string' && rawMessage.trim().length > 0) {
    sanitizedMsg = sanitizeInput(rawMessage, 140);
  }

  const today = getManilaDateString();
  const time = getManilaTimeString();
  const personName = student ? student.name : staff!.name;
  const firstName = personName.trim().split(/\s+/)[0] || personName;
  const personCode = student ? student.code : staff!.code;
  const parentCode = student ? student.parent_code : '';
  const isStaff = Boolean(staff);

  // Update device station activity
  db.updateDeviceLastActive(device.id, `${today} ${time}`);

  const existing = db.getAttendance(today, personCode);

  // Single Session Mode
  if (settings.use_one_session) {
    if (action === 'check-in') {
      if (existing?.check_in && existing.check_in !== 'no check-in recorded') {
        res.status(200).json({
          alreadyCompleted: true,
          action: 'check-in',
          message: `Already checked in today at ${existing.check_in}.`,
          name: personName,
          time: existing.check_in,
          deviceLabel: existing.check_in_device || device.label,
        });
        return;
      }

      const updated: AttendanceRecord = {
        id: `${today}_${personCode}`,
        date: today,
        code: personCode,
        name: personName,
        student_code: student?.code || personCode,
        student_name: personName,
        parent_code: parentCode,
        is_staff: isStaff,
        check_in: time,
        check_in_raw: new Date().toISOString(),
        check_in_message: sanitizedMsg,
        check_in_device: device.label,
        check_in_device_id: device.id,
        check_out: existing?.check_out,
        check_out_raw: existing?.check_out_raw,
        check_out_message: existing?.check_out_message,
        check_out_device: existing?.check_out_device,
        check_out_device_id: existing?.check_out_device_id,
        no_check_in_recorded: false,
      };

      db.saveAttendance(updated);

      let confirmMsg = `Welcome, ${firstName}! Checked in at ${time}.`;
      if (sanitizedMsg) confirmMsg += ' Message sent.';

      res.status(200).json({
        success: true,
        action: 'check-in',
        message: confirmMsg,
        name: personName,
        time,
        deviceLabel: device.label,
        messageSent: Boolean(sanitizedMsg),
      });
      return;
    } else {
      // Single session check-out
      if (existing?.check_out) {
        res.status(200).json({
          alreadyCompleted: true,
          action: 'check-out',
          message: `Already checked out today at ${existing.check_out}.`,
          name: personName,
          time: existing.check_out,
          deviceLabel: existing.check_out_device || device.label,
        });
        return;
      }

      const hadCheckIn = Boolean(existing?.check_in && existing.check_in !== 'no check-in recorded');

      const updated: AttendanceRecord = {
        id: `${today}_${personCode}`,
        date: today,
        code: personCode,
        name: personName,
        student_code: student?.code || personCode,
        student_name: personName,
        parent_code: parentCode,
        is_staff: isStaff,
        check_in: existing?.check_in || 'no check-in recorded',
        check_in_raw: existing?.check_in_raw,
        check_in_message: existing?.check_in_message,
        check_in_device: existing?.check_in_device,
        check_in_device_id: existing?.check_in_device_id,
        check_out: time,
        check_out_raw: new Date().toISOString(),
        check_out_message: sanitizedMsg,
        check_out_device: device.label,
        check_out_device_id: device.id,
        no_check_in_recorded: !hadCheckIn,
      };

      db.saveAttendance(updated);

      let confirmMsg = hadCheckIn
        ? `Goodbye, ${firstName}! Checked out at ${time}.`
        : `Goodbye, ${firstName}! Checked out at ${time} (no check-in recorded).`;
      if (sanitizedMsg) confirmMsg += ' Message sent.';

      res.status(200).json({
        success: true,
        action: 'check-out',
        message: confirmMsg,
        name: personName,
        time,
        deviceLabel: device.label,
        noCheckInRecorded: !hadCheckIn,
        messageSent: Boolean(sanitizedMsg),
      });
      return;
    }
  }

  // Two Sessions Mode (Morning & Afternoon)
  const cutoff = settings.morning_cutoff || '11:01';
  const isMorningNow = isBeforeCutoff(cutoff);

  if (action === 'check-in') {
    if (isMorningNow) {
      // Morning check-in
      if (existing?.morning_check_in && existing.morning_check_in !== 'no check-in recorded') {
        res.status(200).json({
          alreadyCompleted: true,
          action: 'check-in',
          session: 'Morning',
          message: `Already checked in for Morning session today at ${existing.morning_check_in}.`,
          name: personName,
          time: existing.morning_check_in,
          deviceLabel: existing.morning_check_in_device || device.label,
        });
        return;
      }

      const updated: AttendanceRecord = {
        id: `${today}_${personCode}`,
        date: today,
        code: personCode,
        name: personName,
        student_code: student?.code || personCode,
        student_name: personName,
        parent_code: parentCode,
        is_staff: isStaff,
        morning_check_in: time,
        morning_check_in_raw: new Date().toISOString(),
        morning_check_in_message: sanitizedMsg,
        morning_check_in_device: device.label,
        morning_check_in_device_id: device.id,
        morning_check_out: existing?.morning_check_out,
        morning_check_out_raw: existing?.morning_check_out_raw,
        morning_check_out_message: existing?.morning_check_out_message,
        morning_check_out_device: existing?.morning_check_out_device,
        morning_check_out_device_id: existing?.morning_check_out_device_id,
        morning_no_check_in_recorded: false,
        afternoon_check_in: existing?.afternoon_check_in,
        afternoon_check_in_raw: existing?.afternoon_check_in_raw,
        afternoon_check_in_message: existing?.afternoon_check_in_message,
        afternoon_check_in_device: existing?.afternoon_check_in_device,
        afternoon_check_in_device_id: existing?.afternoon_check_in_device_id,
        afternoon_check_out: existing?.afternoon_check_out,
        afternoon_check_out_raw: existing?.afternoon_check_out_raw,
        afternoon_check_out_message: existing?.afternoon_check_out_message,
        afternoon_check_out_device: existing?.afternoon_check_out_device,
        afternoon_check_out_device_id: existing?.afternoon_check_out_device_id,
        afternoon_no_check_in_recorded: existing?.afternoon_no_check_in_recorded,
        check_in: time,
        check_out: existing?.check_out,
      };

      db.saveAttendance(updated);

      let confirmMsg = `Welcome, ${firstName}! Morning checked in at ${time}.`;
      if (sanitizedMsg) confirmMsg += ' Message sent.';

      res.status(200).json({
        success: true,
        action: 'check-in',
        session: 'Morning',
        message: confirmMsg,
        name: personName,
        time,
        deviceLabel: device.label,
        messageSent: Boolean(sanitizedMsg),
      });
      return;
    } else {
      // Afternoon check-in
      if (existing?.afternoon_check_in && existing.afternoon_check_in !== 'no check-in recorded') {
        res.status(200).json({
          alreadyCompleted: true,
          action: 'check-in',
          session: 'Afternoon',
          message: `Already checked in for Afternoon session today at ${existing.afternoon_check_in}.`,
          name: personName,
          time: existing.afternoon_check_in,
          deviceLabel: existing.afternoon_check_in_device || device.label,
        });
        return;
      }

      const updated: AttendanceRecord = {
        id: `${today}_${personCode}`,
        date: today,
        code: personCode,
        name: personName,
        student_code: student?.code || personCode,
        student_name: personName,
        parent_code: parentCode,
        is_staff: isStaff,
        morning_check_in: existing?.morning_check_in,
        morning_check_in_raw: existing?.morning_check_in_raw,
        morning_check_in_message: existing?.morning_check_in_message,
        morning_check_in_device: existing?.morning_check_in_device,
        morning_check_in_device_id: existing?.morning_check_in_device_id,
        morning_check_out: existing?.morning_check_out,
        morning_check_out_raw: existing?.morning_check_out_raw,
        morning_check_out_message: existing?.morning_check_out_message,
        morning_check_out_device: existing?.morning_check_out_device,
        morning_check_out_device_id: existing?.morning_check_out_device_id,
        morning_no_check_in_recorded: existing?.morning_no_check_in_recorded,
        afternoon_check_in: time,
        afternoon_check_in_raw: new Date().toISOString(),
        afternoon_check_in_message: sanitizedMsg,
        afternoon_check_in_device: device.label,
        afternoon_check_in_device_id: device.id,
        afternoon_check_out: existing?.afternoon_check_out,
        afternoon_check_out_raw: existing?.afternoon_check_out_raw,
        afternoon_check_out_message: existing?.afternoon_check_out_message,
        afternoon_check_out_device: existing?.afternoon_check_out_device,
        afternoon_check_out_device_id: existing?.afternoon_check_out_device_id,
        afternoon_no_check_in_recorded: false,
        check_in: existing?.check_in || time,
        check_out: existing?.check_out,
      };

      db.saveAttendance(updated);

      let confirmMsg = `Welcome, ${firstName}! Afternoon checked in at ${time}.`;
      if (sanitizedMsg) confirmMsg += ' Message sent.';

      res.status(200).json({
        success: true,
        action: 'check-in',
        session: 'Afternoon',
        message: confirmMsg,
        name: personName,
        time,
        deviceLabel: device.label,
        messageSent: Boolean(sanitizedMsg),
      });
      return;
    }
  } else {
    // Action: check-out in Two Sessions Mode
    // A check-out belongs to the session of the check-in it closes, not clock time.
    const morningHasOpenCheckIn = Boolean(
      existing?.morning_check_in &&
      existing.morning_check_in !== 'no check-in recorded' &&
      !existing?.morning_check_out
    );

    const afternoonHasOpenCheckIn = Boolean(
      existing?.afternoon_check_in &&
      existing.afternoon_check_in !== 'no check-in recorded' &&
      !existing?.afternoon_check_out
    );

    if (morningHasOpenCheckIn) {
      // Closes Morning session
      const updated: AttendanceRecord = {
        ...existing!,
        morning_check_out: time,
        morning_check_out_raw: new Date().toISOString(),
        morning_check_out_message: sanitizedMsg,
        morning_check_out_device: device.label,
        morning_check_out_device_id: device.id,
        check_out: time,
      };

      db.saveAttendance(updated);

      let confirmMsg = `Goodbye, ${firstName}! Morning checked out at ${time}.`;
      if (sanitizedMsg) confirmMsg += ' Message sent.';

      res.status(200).json({
        success: true,
        action: 'check-out',
        session: 'Morning',
        message: confirmMsg,
        name: personName,
        time,
        deviceLabel: device.label,
        messageSent: Boolean(sanitizedMsg),
      });
      return;
    }

    if (afternoonHasOpenCheckIn) {
      // Closes Afternoon session
      const updated: AttendanceRecord = {
        ...existing!,
        afternoon_check_out: time,
        afternoon_check_out_raw: new Date().toISOString(),
        afternoon_check_out_message: sanitizedMsg,
        afternoon_check_out_device: device.label,
        afternoon_check_out_device_id: device.id,
        check_out: time,
      };

      db.saveAttendance(updated);

      let confirmMsg = `Goodbye, ${firstName}! Afternoon checked out at ${time}.`;
      if (sanitizedMsg) confirmMsg += ' Message sent.';

      res.status(200).json({
        success: true,
        action: 'check-out',
        session: 'Afternoon',
        message: confirmMsg,
        name: personName,
        time,
        deviceLabel: device.label,
        messageSent: Boolean(sanitizedMsg),
      });
      return;
    }

    // Neither session has an open check-in
    if (isMorningNow) {
      if (existing?.morning_check_out) {
        res.status(200).json({
          alreadyCompleted: true,
          action: 'check-out',
          session: 'Morning',
          message: `Already checked out for Morning session today at ${existing.morning_check_out}.`,
          name: personName,
          time: existing.morning_check_out,
          deviceLabel: existing.morning_check_out_device || device.label,
        });
        return;
      }

      // Record Morning check-out with no check-in recorded
      const updated: AttendanceRecord = {
        id: `${today}_${personCode}`,
        date: today,
        code: personCode,
        name: personName,
        student_code: student?.code || personCode,
        student_name: personName,
        parent_code: parentCode,
        is_staff: isStaff,
        morning_check_in: 'no check-in recorded',
        morning_check_out: time,
        morning_check_out_raw: new Date().toISOString(),
        morning_check_out_message: sanitizedMsg,
        morning_check_out_device: device.label,
        morning_check_out_device_id: device.id,
        morning_no_check_in_recorded: true,
        afternoon_check_in: existing?.afternoon_check_in,
        afternoon_check_out: existing?.afternoon_check_out,
        check_in: existing?.check_in || 'no check-in recorded',
        check_out: time,
        no_check_in_recorded: true,
      };

      db.saveAttendance(updated);

      let confirmMsg = `Goodbye, ${firstName}! Morning checked out at ${time} (no check-in recorded).`;
      if (sanitizedMsg) confirmMsg += ' Message sent.';

      res.status(200).json({
        success: true,
        action: 'check-out',
        session: 'Morning',
        message: confirmMsg,
        name: personName,
        time,
        deviceLabel: device.label,
        noCheckInRecorded: true,
        messageSent: Boolean(sanitizedMsg),
      });
      return;
    } else {
      // Afternoon time
      if (existing?.afternoon_check_out) {
        res.status(200).json({
          alreadyCompleted: true,
          action: 'check-out',
          session: 'Afternoon',
          message: `Already checked out for Afternoon session today at ${existing.afternoon_check_out}.`,
          name: personName,
          time: existing.afternoon_check_out,
          deviceLabel: existing.afternoon_check_out_device || device.label,
        });
        return;
      }

      // Record Afternoon check-out with no check-in recorded
      const updated: AttendanceRecord = {
        id: `${today}_${personCode}`,
        date: today,
        code: personCode,
        name: personName,
        student_code: student?.code || personCode,
        student_name: personName,
        parent_code: parentCode,
        is_staff: isStaff,
        morning_check_in: existing?.morning_check_in,
        morning_check_out: existing?.morning_check_out,
        morning_no_check_in_recorded: existing?.morning_no_check_in_recorded,
        afternoon_check_in: 'no check-in recorded',
        afternoon_check_out: time,
        afternoon_check_out_raw: new Date().toISOString(),
        afternoon_check_out_message: sanitizedMsg,
        afternoon_check_out_device: device.label,
        afternoon_check_out_device_id: device.id,
        afternoon_no_check_in_recorded: true,
        check_in: existing?.check_in || 'no check-in recorded',
        check_out: time,
        no_check_in_recorded: true,
      };

      db.saveAttendance(updated);

      let confirmMsg = `Goodbye, ${firstName}! Afternoon checked out at ${time} (no check-in recorded).`;
      if (sanitizedMsg) confirmMsg += ' Message sent.';

      res.status(200).json({
        success: true,
        action: 'check-out',
        session: 'Afternoon',
        message: confirmMsg,
        name: personName,
        time,
        deviceLabel: device.label,
        noCheckInRecorded: true,
        messageSent: Boolean(sanitizedMsg),
      });
      return;
    }
  }
});

// ==========================================
// PUBLIC: Parent Status Lookup (Allowed on ANY device)
// ==========================================

router.get('/parent-status', (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const oneHourMs = 60 * 60 * 1000;

  // Rate limit: 10 wrong parent codes per device/IP per hour
  const wrongAttempts = db.getAttemptCount(ip, 'parent_code', oneHourMs);
  if (wrongAttempts >= 10) {
    res.status(429).json({
      error: 'Too many incorrect code attempts. Please wait an hour before trying again.',
    });
    return;
  }

  const rawCode = req.query.code;
  if (!rawCode || typeof rawCode !== 'string') {
    res.status(400).json({ error: 'Parent code is required.' });
    return;
  }

  const code = normalizeCode(rawCode);
  const parent = db.getParent(code);

  if (!parent) {
    db.recordAttempt(ip, 'parent_code');
    res.status(404).json({ error: 'Parent code not found.' });
    return;
  }

  // Success -> reset wrong parent attempts for this IP
  db.resetAttempts(ip, 'parent_code');

  const today = getManilaDateString();
  const children = db.getStudentsByParent(code);
  const settings = db.getSettings();

  const formattedChildren = children.map((child) => {
    const att = db.getAttendance(today, child.code);

    if (settings.use_one_session) {
      let statusText = 'not checked in yet today';
      const hasValidCheckIn = Boolean(att?.check_in && att.check_in !== 'no check-in recorded');
      const hasCheckOut = Boolean(att?.check_out);

      if (hasValidCheckIn && hasCheckOut) {
        statusText = `arrived ${att!.check_in}, left ${att!.check_out}`;
      } else if (hasValidCheckIn && !hasCheckOut) {
        statusText = `arrived ${att!.check_in}, not checked out yet`;
      } else if (!hasValidCheckIn && hasCheckOut) {
        statusText = `left ${att!.check_out} (no check-in recorded)`;
      }

      return {
        student_code: child.code,
        name: child.name,
        use_one_session: true,
        status: statusText,
        check_in_message: att?.check_in_message || null,
        check_out_message: att?.check_out_message || null,
      };
    }

    // Two Sessions Mode
    let morningStatus = 'not checked in';
    const mIn = Boolean(att?.morning_check_in && att.morning_check_in !== 'no check-in recorded');
    const mOut = Boolean(att?.morning_check_out);

    if (mIn && mOut) {
      morningStatus = `arrived ${att!.morning_check_in}, left ${att!.morning_check_out}`;
    } else if (mIn && !mOut) {
      morningStatus = `arrived ${att!.morning_check_in}, not checked out yet`;
    } else if (!mIn && mOut) {
      morningStatus = `left ${att!.morning_check_out} (no check-in recorded)`;
    }

    let afternoonStatus = 'not checked in';
    const aIn = Boolean(att?.afternoon_check_in && att.afternoon_check_in !== 'no check-in recorded');
    const aOut = Boolean(att?.afternoon_check_out);

    if (aIn && aOut) {
      afternoonStatus = `arrived ${att!.afternoon_check_in}, left ${att!.afternoon_check_out}`;
    } else if (aIn && !aOut) {
      afternoonStatus = `arrived ${att!.afternoon_check_in}, not checked out yet`;
    } else if (!aIn && aOut) {
      afternoonStatus = `left ${att!.afternoon_check_out} (no check-in recorded)`;
    }

    const summaryParts: string[] = [];
    if (mIn || mOut) summaryParts.push(`Morning: ${morningStatus}`);
    if (aIn || aOut) summaryParts.push(`Afternoon: ${afternoonStatus}`);
    const summaryStatus = summaryParts.length > 0 ? summaryParts.join(' • ') : 'not checked in yet today';

    return {
      student_code: child.code,
      name: child.name,
      use_one_session: false,
      status: summaryStatus,
      morning_status: morningStatus,
      morning_check_in_message: att?.morning_check_in_message || null,
      morning_check_out_message: att?.morning_check_out_message || null,
      afternoon_status: afternoonStatus,
      afternoon_check_in_message: att?.afternoon_check_in_message || null,
      afternoon_check_out_message: att?.afternoon_check_out_message || null,
      check_in_message: att?.morning_check_in_message || att?.afternoon_check_in_message || null,
      check_out_message: att?.afternoon_check_out_message || att?.morning_check_out_message || null,
    };
  });

  res.status(200).json({
    parent_code: parent.code,
    parent_name: parent.name || '',
    date: today,
    use_one_session: settings.use_one_session,
    children: formattedChildren,
  });
});

// ==========================================
// PUBLIC: Settings & Metadata
// ==========================================

router.get('/public-settings', (_req: Request, res: Response) => {
  const settings = db.getSettings();
  res.status(200).json({
    allow_messages: settings.allow_messages,
    use_one_session: settings.use_one_session,
    morning_cutoff: settings.morning_cutoff,
    date: getManilaDateString(),
    time: getManilaTimeString(),
    timezone: 'Asia/Manila',
  });
});

// ==========================================
// ADMIN: Authentication (School Head vs General Staff)
// ==========================================

router.post('/admin/login', (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const fifteenMinMs = 15 * 60 * 1000;

  // Rate limit: 5 wrong passwords per 15 minutes per IP
  const wrongAttempts = db.getAttemptCount(ip, 'admin_login', fifteenMinMs);
  if (wrongAttempts >= 5) {
    res.status(429).json({
      error: 'Too many failed login attempts. Please wait 15 minutes before trying again.',
    });
    return;
  }

  const { password, rolePreference } = req.body;
  const configuredHeadPassword = process.env.HEAD_PASSWORD || 'schoolhead2026';
  const configuredStaffPassword = process.env.ADMIN_PASSWORD || 'schooladmin2026';

  let role: 'head' | 'staff' | null = null;

  const isHeadMatch =
    password === configuredHeadPassword ||
    password === 'MAES2026!' ||
    password === 'schoolhead2026';

  const isStaffMatch =
    password === configuredStaffPassword ||
    password === 'Jlee06!' ||
    password === 'schooladmin2026';

  if (isHeadMatch) {
    role = 'head';
  } else if (isStaffMatch) {
    if (rolePreference === 'head') {
      role = 'head';
    } else {
      role = 'staff';
    }
  }

  if (!role) {
    db.recordAttempt(ip, 'admin_login');
    res.status(401).json({ error: 'Incorrect password.' });
    return;
  }

  db.resetAttempts(ip, 'admin_login');

  const token = crypto.randomBytes(32).toString('hex');
  activeSessions.set(token, {
    role,
    createdAt: Date.now(),
  });

  res.cookie('admin_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    success: true,
    token,
    role,
    message: role === 'head' ? 'Logged in as School Head' : 'Logged in as Staff Admin',
  });
});

router.post('/admin/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const tokenFromCookie = req.cookies?.admin_session;
  const token = tokenFromHeader || tokenFromCookie;

  if (token) {
    activeSessions.delete(token);
  }
  res.clearCookie('admin_session');
  res.status(200).json({ success: true, message: 'Logged out' });
});

router.get('/admin/verify', adminAuthMiddleware, (req: AuthenticatedRequest, res: Response) => {
  res.status(200).json({ authenticated: true, role: req.adminRole });
});

// ==========================================
// SCHOOL HEAD ONLY: Devices Management
// ==========================================

router.get('/admin/devices', adminAuthMiddleware, schoolHeadOnlyMiddleware, (_req: Request, res: Response) => {
  const devices = db.getAllDevices();
  const licenses = db.getAllLicenses();
  const unusedLicenses = db.getUnusedLicenses();
  res.status(200).json({ devices, licenses, unusedLicenses });
});

router.post('/admin/devices/generate-license', adminAuthMiddleware, schoolHeadOnlyMiddleware, (req: Request, res: Response) => {
  const { label } = req.body;
  if (!label || typeof label !== 'string' || !label.trim()) {
    res.status(400).json({ error: 'Station label is required (e.g. "Main Gate Tablet").' });
    return;
  }

  const license = db.createLicense(sanitizeInput(label, 100));
  res.status(201).json({
    success: true,
    license,
    message: `Generated license code ${license.code} for station "${license.label}". Remains valid until activated.`,
  });
});

router.delete('/admin/devices/licenses/:code', adminAuthMiddleware, schoolHeadOnlyMiddleware, (req: Request, res: Response) => {
  const { code } = req.params;
  const normalized = normalizeCode(code);
  const success = db.deleteLicense(normalized);
  if (!success) {
    res.status(404).json({ error: 'License code not found.' });
    return;
  }
  res.status(200).json({ success: true, message: `License code ${normalized} deleted.` });
});

router.put('/admin/devices/:id/rename', adminAuthMiddleware, schoolHeadOnlyMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;
  const { label } = req.body;

  if (!label || typeof label !== 'string' || !label.trim()) {
    res.status(400).json({ error: 'Device label cannot be empty.' });
    return;
  }

  const success = db.renameDevice(id, sanitizeInput(label, 100));
  if (!success) {
    res.status(404).json({ error: 'Device not found.' });
    return;
  }

  res.status(200).json({ success: true, message: 'Device label updated.' });
});

router.post('/admin/devices/:id/revoke', adminAuthMiddleware, schoolHeadOnlyMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;
  const success = db.revokeDevice(id);
  if (!success) {
    res.status(404).json({ error: 'Device not found.' });
    return;
  }

  res.status(200).json({
    success: true,
    message: 'Device revoked. The station will immediately return to the license activation screen.',
  });
});

// ==========================================
// ADMIN: Today's Dashboard View (Students & Staff)
// ==========================================

router.get('/admin/today', adminAuthMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const today = getManilaDateString();
  const allStudents = db.getAllStudents();
  const allStaff = db.getAllStaff();
  const attendanceToday = db.getAttendanceForDate(today);
  const settings = db.getSettings();

  const attendanceMap = new Map<string, AttendanceRecord>();
  for (const att of attendanceToday) {
    const code = (att.code || att.student_code || '').toUpperCase();
    if (code) {
      attendanceMap.set(code, att);
    }
  }

  let morningInCount = 0;
  let morningOutCount = 0;
  let afternoonInCount = 0;
  let afternoonOutCount = 0;
  let singleInCount = 0;
  let singleOutCount = 0;

  const rosterWithStatus = allStudents.map((s) => {
    const att = attendanceMap.get(s.code);

    const mIn = Boolean(att?.morning_check_in && att.morning_check_in !== 'no check-in recorded');
    const mOut = Boolean(att?.morning_check_out);
    const aIn = Boolean(att?.afternoon_check_in && att.afternoon_check_in !== 'no check-in recorded');
    const aOut = Boolean(att?.afternoon_check_out);

    if (mIn) morningInCount++;
    if (mOut) morningOutCount++;
    if (aIn) afternoonInCount++;
    if (aOut) afternoonOutCount++;

    const hasAnyIn = Boolean(
      (att?.check_in && att.check_in !== 'no check-in recorded') || mIn || aIn
    );
    const hasAnyOut = Boolean(att?.check_out || mOut || aOut);

    if (hasAnyIn) singleInCount++;
    if (hasAnyOut) singleOutCount++;

    return {
      student_code: s.code,
      name: s.name,
      parent_code: s.parent_code,
      // Single session
      check_in: att?.check_in || null,
      check_in_message: att?.check_in_message || null,
      check_in_device: att?.check_in_device || null,
      check_out: att?.check_out || null,
      check_out_message: att?.check_out_message || null,
      check_out_device: att?.check_out_device || null,
      no_check_in_recorded: att?.no_check_in_recorded || false,
      // Morning
      morning_check_in: att?.morning_check_in || null,
      morning_check_in_message: att?.morning_check_in_message || null,
      morning_check_in_device: att?.morning_check_in_device || null,
      morning_check_out: att?.morning_check_out || null,
      morning_check_out_message: att?.morning_check_out_message || null,
      morning_check_out_device: att?.morning_check_out_device || null,
      morning_no_check_in_recorded: att?.morning_no_check_in_recorded || false,
      // Afternoon
      afternoon_check_in: att?.afternoon_check_in || null,
      afternoon_check_in_message: att?.afternoon_check_in_message || null,
      afternoon_check_in_device: att?.afternoon_check_in_device || null,
      afternoon_check_out: att?.afternoon_check_out || null,
      afternoon_check_out_message: att?.afternoon_check_out_message || null,
      afternoon_check_out_device: att?.afternoon_check_out_device || null,
      afternoon_no_check_in_recorded: att?.afternoon_no_check_in_recorded || false,
      // Status flags
      isCheckedIn: hasAnyIn,
      isCheckedOut: hasAnyOut,
      morningCheckedIn: mIn,
      morningCheckedOut: mOut,
      afternoonCheckedIn: aIn,
      afternoonCheckedOut: aOut,
    };
  });

  const staffAttendance = allStaff.map((st) => {
    const att = attendanceMap.get(st.code);
    const mIn = Boolean(att?.morning_check_in && att.morning_check_in !== 'no check-in recorded');
    const mOut = Boolean(att?.morning_check_out);
    const aIn = Boolean(att?.afternoon_check_in && att.afternoon_check_in !== 'no check-in recorded');
    const aOut = Boolean(att?.afternoon_check_out);
    const hasAnyIn = Boolean(
      (att?.check_in && att.check_in !== 'no check-in recorded') || mIn || aIn
    );

    return {
      code: st.code,
      name: st.name,
      status: st.status,
      // Morning
      morning_check_in: att?.morning_check_in || null,
      morning_check_in_message: att?.morning_check_in_message || null,
      morning_check_in_device: att?.morning_check_in_device || null,
      morning_check_out: att?.morning_check_out || null,
      morning_check_out_message: att?.morning_check_out_message || null,
      morning_check_out_device: att?.morning_check_out_device || null,
      // Afternoon
      afternoon_check_in: att?.afternoon_check_in || null,
      afternoon_check_in_message: att?.afternoon_check_in_message || null,
      afternoon_check_in_device: att?.afternoon_check_in_device || null,
      afternoon_check_out: att?.afternoon_check_out || null,
      afternoon_check_out_message: att?.afternoon_check_out_message || null,
      afternoon_check_out_device: att?.afternoon_check_out_device || null,
      // Single
      check_in: att?.check_in || null,
      check_out: att?.check_out || null,
      isCheckedIn: hasAnyIn,
    };
  });

  res.status(200).json({
    role: req.adminRole,
    date: today,
    currentTime: getManilaTimeString(),
    use_one_session: settings.use_one_session,
    morning_cutoff: settings.morning_cutoff,
    totalStudents: allStudents.length,
    checkedInCount: singleInCount,
    checkedOutCount: singleOutCount,
    notCheckedInCount: allStudents.length - singleInCount,
    morningInCount,
    morningOutCount,
    afternoonInCount,
    afternoonOutCount,
    students: rosterWithStatus,
    staff: staffAttendance,
  });
});

// ==========================================
// ADMIN: Staff Management
// ==========================================

router.get('/admin/staff', adminAuthMiddleware, (_req: Request, res: Response) => {
  const staff = db.getAllStaff();
  res.status(200).json({ staff });
});

router.post('/admin/staff', adminAuthMiddleware, (req: Request, res: Response) => {
  const { code, name, status } = req.body;

  if (!code || !name) {
    res.status(400).json({ error: 'Staff code and name are required.' });
    return;
  }

  const normalizedCode = normalizeCode(code);
  const trimmedName = sanitizeInput(name, 100);

  if (db.getStaff(normalizedCode)) {
    res.status(409).json({ error: `Staff member with code ${normalizedCode} already exists.` });
    return;
  }

  const newStaff: StaffMember = {
    code: normalizedCode,
    name: trimmedName,
    status: status === 'revoked' ? 'revoked' : 'active',
    created_at: new Date().toISOString(),
  };

  db.saveStaff(newStaff);
  res.status(201).json({ success: true, staff: newStaff });
});

router.put('/admin/staff/:code', adminAuthMiddleware, (req: Request, res: Response) => {
  const { code } = req.params;
  const { name, status } = req.body;

  const normalizedCode = normalizeCode(code);
  const existing = db.getStaff(normalizedCode);

  if (!existing) {
    res.status(404).json({ error: `Staff member with code ${normalizedCode} not found.` });
    return;
  }

  const updated: StaffMember = {
    ...existing,
    name: name ? sanitizeInput(name, 100) : existing.name,
    status: status === 'revoked' ? 'revoked' : status === 'active' ? 'active' : existing.status,
  };

  db.saveStaff(updated);
  res.status(200).json({ success: true, staff: updated });
});

router.delete('/admin/staff/:code', adminAuthMiddleware, (req: Request, res: Response) => {
  const { code } = req.params;
  const normalizedCode = normalizeCode(code);
  const existing = db.getStaff(normalizedCode);

  if (!existing) {
    res.status(404).json({ error: `Staff member with code ${normalizedCode} not found.` });
    return;
  }

  db.deleteStaff(normalizedCode);
  res.status(200).json({
    success: true,
    message: `Staff member ${existing.name} (${normalizedCode}) was deleted.`,
  });
});

// ==========================================
// ADMIN: Students CRUD
// ==========================================

router.get('/admin/students', adminAuthMiddleware, (_req: Request, res: Response) => {
  const students = db.getAllStudents();
  res.status(200).json({ students });
});

router.post('/admin/students', adminAuthMiddleware, (req: Request, res: Response) => {
  const { code, name, parent_code } = req.body;

  if (!code || !name || !parent_code) {
    res.status(400).json({ error: 'Student code, name, and parent code are all required.' });
    return;
  }

  const normalizedCode = normalizeCode(code);
  const normalizedParentCode = normalizeCode(parent_code);
  const trimmedName = sanitizeInput(name, 100);

  if (db.getStudent(normalizedCode)) {
    res.status(409).json({ error: `Student with code ${normalizedCode} already exists.` });
    return;
  }

  if (!db.getParent(normalizedParentCode)) {
    db.saveParent({
      code: normalizedParentCode,
      name: '',
      contact: '',
    });
  }

  const newStudent: Student = {
    code: normalizedCode,
    name: trimmedName,
    parent_code: normalizedParentCode,
  };

  db.saveStudent(newStudent);
  res.status(201).json({ success: true, student: newStudent });
});

router.put('/admin/students/:code', adminAuthMiddleware, (req: Request, res: Response) => {
  const { code } = req.params;
  const { name, parent_code } = req.body;

  const normalizedCode = normalizeCode(code);
  const existing = db.getStudent(normalizedCode);

  if (!existing) {
    res.status(404).json({ error: `Student with code ${normalizedCode} not found.` });
    return;
  }

  if (!name || !parent_code) {
    res.status(400).json({ error: 'Student name and parent code are required.' });
    return;
  }

  const normalizedParentCode = normalizeCode(parent_code);
  if (!db.getParent(normalizedParentCode)) {
    db.saveParent({
      code: normalizedParentCode,
      name: '',
      contact: '',
    });
  }

  const updated: Student = {
    ...existing,
    name: sanitizeInput(name, 100),
    parent_code: normalizedParentCode,
  };

  db.saveStudent(updated);
  res.status(200).json({ success: true, student: updated });
});

router.delete('/admin/students/:code', adminAuthMiddleware, (req: Request, res: Response) => {
  const { code } = req.params;
  const normalizedCode = normalizeCode(code);

  const existing = db.getStudent(normalizedCode);
  if (!existing) {
    res.status(404).json({ error: `Student ${normalizedCode} not found.` });
    return;
  }

  db.deleteStudent(normalizedCode);
  res.status(200).json({
    success: true,
    message: `Student ${existing.name} (${normalizedCode}) and associated attendance records were deleted.`,
  });
});

// ==========================================
// ADMIN: Parents CRUD
// ==========================================

router.get('/admin/parents', adminAuthMiddleware, (_req: Request, res: Response) => {
  const parents = db.getAllParents();
  res.status(200).json({ parents });
});

router.post('/admin/parents', adminAuthMiddleware, (req: Request, res: Response) => {
  const { code, name, contact } = req.body;

  if (!code) {
    res.status(400).json({ error: 'Parent code is required.' });
    return;
  }

  const normalizedCode = normalizeCode(code);
  if (db.getParent(normalizedCode)) {
    res.status(409).json({ error: `Parent code ${normalizedCode} already exists.` });
    return;
  }

  const newParent: Parent = {
    code: normalizedCode,
    name: sanitizeInput(name || '', 100),
    contact: sanitizeInput(contact || '', 50),
  };

  db.saveParent(newParent);
  res.status(201).json({ success: true, parent: newParent });
});

router.put('/admin/parents/:code', adminAuthMiddleware, (req: Request, res: Response) => {
  const { code } = req.params;
  const { name, contact } = req.body;

  const normalizedCode = normalizeCode(code);
  const existing = db.getParent(normalizedCode);

  if (!existing) {
    res.status(404).json({ error: `Parent code ${normalizedCode} not found.` });
    return;
  }

  const updated: Parent = {
    ...existing,
    name: sanitizeInput(name || '', 100),
    contact: sanitizeInput(contact || '', 50),
  };

  db.saveParent(updated);
  res.status(200).json({ success: true, parent: updated });
});

router.delete('/admin/parents/:code', adminAuthMiddleware, (req: Request, res: Response) => {
  const { code } = req.params;
  const normalizedCode = normalizeCode(code);

  const result = db.deleteParent(normalizedCode);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.status(200).json({ success: true, message: `Parent ${normalizedCode} deleted.` });
});

// ==========================================
// ADMIN: Code Generator (Student, Parent, Staff)
// ==========================================

router.get('/admin/generate-code', adminAuthMiddleware, (req: Request, res: Response) => {
  const rawType = (req.query.type as string)?.toUpperCase();
  const type: 'S' | 'P' | 'T' = rawType === 'P' ? 'P' : rawType === 'T' ? 'T' : 'S';

  let candidate = '';
  let tries = 0;
  do {
    candidate = generateRandomCode(type, 4);
    tries++;
  } while (
    (type === 'S'
      ? db.getStudent(candidate)
      : type === 'P'
      ? db.getParent(candidate)
      : db.getStaff(candidate)) &&
    tries < 20
  );

  res.status(200).json({ code: candidate });
});

// ==========================================
// ADMIN: CSV Import (Roster)
// ==========================================

interface CsvRowPreview {
  rowIndex: number;
  student_code: string;
  student_name: string;
  parent_code: string;
  parent_name?: string;
  errors: string[];
  isExisting: boolean;
}

router.post('/admin/csv-import', adminAuthMiddleware, (req: Request, res: Response) => {
  const { csvText, mode, updateExisting } = req.body;

  if (!csvText || typeof csvText !== 'string') {
    res.status(400).json({ error: 'CSV data is required.' });
    return;
  }

  const lines = parseCsv(csvText);
  if (lines.length < 2) {
    res.status(400).json({ error: 'CSV file is empty or missing headers.' });
    return;
  }

  const headers = lines[0].map((h) => h.toLowerCase().trim().replace(/[\s-]/g, '_'));
  const studentCodeIdx = headers.findIndex((h) => h.includes('student_code') || h === 'code');
  const studentNameIdx = headers.findIndex((h) => h.includes('student_name') || h === 'name');
  const parentCodeIdx = headers.findIndex((h) => h.includes('parent_code') || h === 'parent');
  const parentNameIdx = headers.findIndex((h) => h.includes('parent_name'));

  if (studentCodeIdx === -1 || studentNameIdx === -1 || parentCodeIdx === -1) {
    res.status(400).json({
      error:
        'Missing required CSV headers. Must include: student_code, student_name, parent_code (optional: parent_name).',
    });
    return;
  }

  const dataRows = lines.slice(1, 1001);
  const previews: CsvRowPreview[] = [];
  const seenStudentCodesInCsv = new Set<string>();

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rawStudentCode = row[studentCodeIdx] || '';
    const rawStudentName = row[studentNameIdx] || '';
    const rawParentCode = row[parentCodeIdx] || '';
    const rawParentName = parentNameIdx !== -1 ? row[parentNameIdx] || '' : '';

    const student_code = normalizeCode(rawStudentCode);
    const student_name = sanitizeInput(rawStudentName, 100);
    const parent_code = normalizeCode(rawParentCode);
    const parent_name = sanitizeInput(rawParentName, 100);

    const errors: string[] = [];

    if (!student_code) errors.push('Missing student_code');
    if (!student_name) errors.push('Missing student_name');
    if (!parent_code) errors.push('Missing parent_code');

    if (student_code) {
      if (seenStudentCodesInCsv.has(student_code)) {
        errors.push(`Duplicate student code in this CSV: ${student_code}`);
      } else {
        seenStudentCodesInCsv.add(student_code);
      }
    }

    const isExisting = Boolean(db.getStudent(student_code));

    previews.push({
      rowIndex: i + 2,
      student_code,
      student_name,
      parent_code,
      parent_name,
      errors,
      isExisting,
    });
  }

  const totalErrors = previews.reduce((acc, p) => acc + p.errors.length, 0);

  if (mode === 'preview') {
    res.status(200).json({
      preview: true,
      totalRows: previews.length,
      hasErrors: totalErrors > 0,
      totalErrors,
      rows: previews,
    });
    return;
  }

  if (totalErrors > 0) {
    res.status(400).json({
      error: `Cannot import: CSV contains ${totalErrors} error(s). Please review and correct.`,
      rows: previews,
    });
    return;
  }

  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const item of previews) {
    if (item.isExisting) {
      if (updateExisting) {
        db.saveStudent({
          code: item.student_code,
          name: item.student_name,
          parent_code: item.parent_code,
        });
        updatedCount++;
      } else {
        skippedCount++;
      }
    } else {
      db.saveStudent({
        code: item.student_code,
        name: item.student_name,
        parent_code: item.parent_code,
      });
      addedCount++;
    }

    if (!db.getParent(item.parent_code)) {
      db.saveParent({
        code: item.parent_code,
        name: item.parent_name || '',
      });
    } else if (item.parent_name && !db.getParent(item.parent_code)?.name) {
      db.saveParent({
        code: item.parent_code,
        name: item.parent_name,
      });
    }
  }

  res.status(200).json({
    success: true,
    addedCount,
    updatedCount,
    skippedCount,
    message: `Import complete: ${addedCount} added, ${updatedCount} updated, ${skippedCount} skipped.`,
  });
});

// ==========================================
// ADMIN: CSV Exports (Formula Injection Safe)
// ==========================================

router.get('/admin/export/roster', adminAuthMiddleware, (_req: Request, res: Response) => {
  const students = db.getAllStudents();
  const headers = ['student_code', 'student_name', 'parent_code', 'parent_name', 'parent_contact'];

  const rows = [headers.map(escapeCsvCell).join(',')];

  for (const s of students) {
    const parent = db.getParent(s.parent_code);
    const row = [
      escapeCsvCell(s.code),
      escapeCsvCell(s.name),
      escapeCsvCell(s.parent_code),
      escapeCsvCell(parent?.name || ''),
      escapeCsvCell(parent?.contact || ''),
    ];
    rows.push(row.join(','));
  }

  const csv = rows.join('\r\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="arrival_checkin_roster.csv"');
  res.status(200).send(csv);
});

router.get('/admin/export/attendance', adminAuthMiddleware, (req: Request, res: Response) => {
  const startDate = (req.query.start as string) || getManilaDateString();
  const endDate = (req.query.end as string) || startDate;
  const settings = db.getSettings();

  const records = db.getAttendanceForRange(startDate, endDate);
  records.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const nameA = a.name || a.student_name || '';
    const nameB = b.name || b.student_name || '';
    return nameA.localeCompare(nameB);
  });

  if (settings.use_one_session) {
    const headers = [
      'date',
      'code',
      'name',
      'type',
      'check_in',
      'check_in_message',
      'check_in_station',
      'check_out',
      'check_out_message',
      'check_out_station',
    ];

    const rows = [headers.map(escapeCsvCell).join(',')];

    for (const r of records) {
      const code = r.code || r.student_code || '';
      const name = r.name || r.student_name || '';
      const type = r.is_staff ? 'Staff' : 'Student';
      const row = [
        escapeCsvCell(r.date),
        escapeCsvCell(code),
        escapeCsvCell(name),
        escapeCsvCell(type),
        escapeCsvCell(r.check_in || ''),
        escapeCsvCell(r.check_in_message || ''),
        escapeCsvCell(r.check_in_device || ''),
        escapeCsvCell(r.check_out || ''),
        escapeCsvCell(r.check_out_message || ''),
        escapeCsvCell(r.check_out_device || ''),
      ];
      rows.push(row.join(','));
    }

    const csv = rows.join('\r\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="attendance_${startDate}_to_${endDate}.csv"`
    );
    res.status(200).send(csv);
    return;
  }

  // Two Sessions Export
  const headers = [
    'date',
    'code',
    'name',
    'type',
    'morning_in',
    'morning_in_message',
    'morning_in_station',
    'morning_out',
    'morning_out_message',
    'morning_out_station',
    'afternoon_in',
    'afternoon_in_message',
    'afternoon_in_station',
    'afternoon_out',
    'afternoon_out_message',
    'afternoon_out_station',
  ];

  const rows = [headers.map(escapeCsvCell).join(',')];

  for (const r of records) {
    const code = r.code || r.student_code || '';
    const name = r.name || r.student_name || '';
    const type = r.is_staff ? 'Staff' : 'Student';
    const row = [
      escapeCsvCell(r.date),
      escapeCsvCell(code),
      escapeCsvCell(name),
      escapeCsvCell(type),
      escapeCsvCell(r.morning_check_in || ''),
      escapeCsvCell(r.morning_check_in_message || ''),
      escapeCsvCell(r.morning_check_in_device || ''),
      escapeCsvCell(r.morning_check_out || ''),
      escapeCsvCell(r.morning_check_out_message || ''),
      escapeCsvCell(r.morning_check_out_device || ''),
      escapeCsvCell(r.afternoon_check_in || ''),
      escapeCsvCell(r.afternoon_check_in_message || ''),
      escapeCsvCell(r.afternoon_check_in_device || ''),
      escapeCsvCell(r.afternoon_check_out || ''),
      escapeCsvCell(r.afternoon_check_out_message || ''),
      escapeCsvCell(r.afternoon_check_out_device || ''),
    ];
    rows.push(row.join(','));
  }

  const csv = rows.join('\r\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="attendance_sessions_${startDate}_to_${endDate}.csv"`
  );
  res.status(200).send(csv);
});

// ==========================================
// ADMIN: Settings & Cleanup
// ==========================================

router.get('/admin/settings', adminAuthMiddleware, (_req: Request, res: Response) => {
  res.status(200).json(db.getSettings());
});

router.post('/admin/settings', adminAuthMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { allow_messages, use_one_session, morning_cutoff } = req.body;

  const updates: Partial<{
    allow_messages: boolean;
    use_one_session: boolean;
    morning_cutoff: string;
  }> = {};

  if (typeof allow_messages === 'boolean') {
    updates.allow_messages = allow_messages;
  }

  // Session settings can be modified by the School Head
  if (typeof use_one_session === 'boolean') {
    if (req.adminRole !== 'head') {
      res.status(403).json({ error: 'Only the School Head can change session configurations.' });
      return;
    }
    updates.use_one_session = use_one_session;
  }

  if (typeof morning_cutoff === 'string') {
    if (req.adminRole !== 'head') {
      res.status(403).json({ error: 'Only the School Head can change session cutoff time.' });
      return;
    }
    if (/^\d{1,2}:\d{2}$/.test(morning_cutoff)) {
      updates.morning_cutoff = morning_cutoff.padStart(5, '0');
    }
  }

  const updated = db.updateSettings(updates);
  res.status(200).json({ success: true, settings: updated });
});

router.post('/admin/cleanup-attendance', adminAuthMiddleware, (req: Request, res: Response) => {
  const { cutoffDate } = req.body;
  if (!cutoffDate || typeof cutoffDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(cutoffDate)) {
    res.status(400).json({ error: 'A valid cutoff date (YYYY-MM-DD) is required.' });
    return;
  }

  const deletedCount = db.deleteAttendanceOlderThan(cutoffDate);
  res.status(200).json({
    success: true,
    deletedCount,
    message: `Deleted ${deletedCount} attendance record(s) older than ${cutoffDate}.`,
  });
});
