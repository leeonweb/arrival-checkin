import fs from 'fs';
import path from 'path';
import type {
  Student,
  Parent,
  StaffMember,
  AttendanceRecord,
  SystemSettings,
  AttemptLog,
  Device,
  DeviceLicense,
} from './types.ts';
import { generateLicenseCode } from './utils.ts';
import { getManilaTimeString, getManilaDateString } from './time.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'arrival_db.json');

interface DatabaseSchema {
  students: Record<string, Student>;
  parents: Record<string, Parent>;
  staff: Record<string, StaffMember>;
  attendance: Record<string, AttendanceRecord>; // key: `${date}_${code}`
  devices: Record<string, Device>; // key: device.id
  licenses: Record<string, DeviceLicense>; // key: license.code
  settings: SystemSettings;
  attempts: AttemptLog[];
}

const DEFAULT_DB: DatabaseSchema = {
  students: {
    S001: {
      code: 'S001',
      name: 'Sample Student 1',
      parent_code: 'P4821',
      created_at: new Date().toISOString(),
    },
    S002: {
      code: 'S002',
      name: 'Sample Student 2',
      parent_code: 'P7390',
      created_at: new Date().toISOString(),
    },
    S003: {
      code: 'S003',
      name: 'Sample Student 3',
      parent_code: 'P4821',
      created_at: new Date().toISOString(),
    },
  },
  parents: {
    P4821: {
      code: 'P4821',
      name: 'Santos Family',
      contact: '0917-555-0199',
      created_at: new Date().toISOString(),
    },
    P7390: {
      code: 'P7390',
      name: 'Reyes Family',
      contact: '0918-555-0288',
      created_at: new Date().toISOString(),
    },
  },
  staff: {
    T4829: {
      code: 'T4829',
      name: 'Maria Santos (Principal)',
      status: 'active',
      created_at: new Date().toISOString(),
    },
    T7311: {
      code: 'T7311',
      name: 'Juan Dela Cruz (Teacher)',
      status: 'active',
      created_at: new Date().toISOString(),
    },
  },
  attendance: {},
  devices: {},
  licenses: {
    GATE2026: {
      code: 'GATE2026',
      label: 'Main Gate Tablet',
      created_at: `${getManilaDateString()} 07:00 AM`,
      used: false,
    },
  },
  settings: {
    allow_messages: true,
    use_one_session: false,
    morning_cutoff: '11:01',
  },
  attempts: [],
};

class StorageEngine {
  private memoryDb: DatabaseSchema;

  constructor() {
    this.memoryDb = this.loadFromDisk();
  }

  private loadFromDisk(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          students: { ...DEFAULT_DB.students, ...(parsed.students || {}) },
          parents: { ...DEFAULT_DB.parents, ...(parsed.parents || {}) },
          staff: { ...DEFAULT_DB.staff, ...(parsed.staff || {}) },
          attendance: parsed.attendance || {},
          devices: parsed.devices || {},
          licenses: parsed.licenses || {},
          settings: { ...DEFAULT_DB.settings, ...(parsed.settings || {}) },
          attempts: parsed.attempts || [],
        };
      } else {
        fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
        return JSON.parse(JSON.stringify(DEFAULT_DB));
      }
    } catch (err) {
      console.error('Failed to load database from disk, using fallback in-memory:', err);
      return JSON.parse(JSON.stringify(DEFAULT_DB));
    }
  }

  private persist() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const data = JSON.stringify(this.memoryDb, null, 2);
      fs.writeFileSync(DB_FILE, data, 'utf-8');
    } catch (err) {
      console.error('Error saving database to disk:', err);
    }
  }

  // --- Students ---

  getStudent(code: string): Student | undefined {
    return this.memoryDb.students[code.toUpperCase()];
  }

  getAllStudents(): Student[] {
    return Object.values(this.memoryDb.students).sort((a, b) => a.code.localeCompare(b.code));
  }

  saveStudent(student: Student): void {
    const code = student.code.toUpperCase();
    this.memoryDb.students[code] = {
      ...student,
      code,
      parent_code: student.parent_code.toUpperCase(),
      created_at: student.created_at || new Date().toISOString(),
    };
    this.persist();
  }

  deleteStudent(code: string): void {
    const upperCode = code.toUpperCase();
    delete this.memoryDb.students[upperCode];

    // Deleting a student also deletes their attendance records as requested
    for (const key of Object.keys(this.memoryDb.attendance)) {
      const att = this.memoryDb.attendance[key];
      if (att.student_code === upperCode || att.code === upperCode) {
        delete this.memoryDb.attendance[key];
      }
    }
    this.persist();
  }

  // --- Parents ---

  getParent(code: string): Parent | undefined {
    return this.memoryDb.parents[code.toUpperCase()];
  }

  getAllParents(): (Parent & { linkedStudentCount: number })[] {
    const studentCountMap: Record<string, number> = {};
    for (const s of Object.values(this.memoryDb.students)) {
      studentCountMap[s.parent_code] = (studentCountMap[s.parent_code] || 0) + 1;
    }

    return Object.values(this.memoryDb.parents)
      .map((p) => ({
        ...p,
        linkedStudentCount: studentCountMap[p.code] || 0,
      }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }

  saveParent(parent: Parent): void {
    const code = parent.code.toUpperCase();
    this.memoryDb.parents[code] = {
      ...parent,
      code,
      created_at: parent.created_at || new Date().toISOString(),
    };
    this.persist();
  }

  deleteParent(code: string): { success: boolean; error?: string } {
    const upperCode = code.toUpperCase();
    const linkedStudents = Object.values(this.memoryDb.students).filter(
      (s) => s.parent_code === upperCode
    );

    if (linkedStudents.length > 0) {
      const studentNames = linkedStudents.map((s) => `${s.name} (${s.code})`).join(', ');
      return {
        success: false,
        error: `Cannot delete parent code ${upperCode}: it is still linked to ${linkedStudents.length} student(s): ${studentNames}. Please reassign or delete these students first.`,
      };
    }

    delete this.memoryDb.parents[upperCode];
    this.persist();
    return { success: true };
  }

  getStudentsByParent(parentCode: string): Student[] {
    const upper = parentCode.toUpperCase();
    return Object.values(this.memoryDb.students).filter((s) => s.parent_code === upper);
  }

  // --- Staff ---

  getStaff(code: string): StaffMember | undefined {
    return this.memoryDb.staff[code.toUpperCase()];
  }

  getAllStaff(): StaffMember[] {
    return Object.values(this.memoryDb.staff).sort((a, b) => a.code.localeCompare(b.code));
  }

  saveStaff(member: StaffMember): void {
    const code = member.code.toUpperCase();
    this.memoryDb.staff[code] = {
      ...member,
      code,
      created_at: member.created_at || new Date().toISOString(),
    };
    this.persist();
  }

  deleteStaff(code: string): void {
    const upperCode = code.toUpperCase();
    delete this.memoryDb.staff[upperCode];
    this.persist();
  }

  setStaffStatus(code: string, status: 'active' | 'revoked'): boolean {
    const upperCode = code.toUpperCase();
    const member = this.memoryDb.staff[upperCode];
    if (!member) return false;
    member.status = status;
    this.persist();
    return true;
  }

  // --- Attendance ---

  getAttendance(date: string, code: string): AttendanceRecord | undefined {
    const upper = code.toUpperCase();
    const key = `${date}_${upper}`;
    return this.memoryDb.attendance[key];
  }

  getAttendanceForDate(date: string): AttendanceRecord[] {
    return Object.values(this.memoryDb.attendance).filter((a) => a.date === date);
  }

  getAttendanceForRange(startDate: string, endDate: string): AttendanceRecord[] {
    return Object.values(this.memoryDb.attendance).filter(
      (a) => a.date >= startDate && a.date <= endDate
    );
  }

  saveAttendance(record: AttendanceRecord): void {
    const code = (record.code || record.student_code || '').toUpperCase();
    const key = `${record.date}_${code}`;
    this.memoryDb.attendance[key] = {
      ...record,
      id: key,
      code,
      student_code: record.student_code ? record.student_code.toUpperCase() : code,
      name: record.name || record.student_name || '',
      student_name: record.student_name || record.name || '',
      parent_code: record.parent_code ? record.parent_code.toUpperCase() : '',
    };
    this.persist();
  }

  deleteAttendanceOlderThan(cutoffDate: string): number {
    let deletedCount = 0;
    for (const key of Object.keys(this.memoryDb.attendance)) {
      if (this.memoryDb.attendance[key].date < cutoffDate) {
        delete this.memoryDb.attendance[key];
        deletedCount++;
      }
    }
    if (deletedCount > 0) {
      this.persist();
    }
    return deletedCount;
  }

  // --- Devices & Stations ---

  getDeviceByToken(token: string): Device | undefined {
    if (!token) return undefined;
    return Object.values(this.memoryDb.devices).find((d) => d.token === token);
  }

  getDeviceById(id: string): Device | undefined {
    return this.memoryDb.devices[id];
  }

  getAllDevices(): Device[] {
    return Object.values(this.memoryDb.devices).sort(
      (a, b) => new Date(b.approved_at).getTime() - new Date(a.approved_at).getTime()
    );
  }

  saveDevice(device: Device): void {
    this.memoryDb.devices[device.id] = device;
    this.persist();
  }

  renameDevice(id: string, newLabel: string): boolean {
    const device = this.memoryDb.devices[id];
    if (!device) return false;
    device.label = newLabel.trim();
    this.persist();
    return true;
  }

  revokeDevice(id: string): boolean {
    const device = this.memoryDb.devices[id];
    if (!device) return false;
    device.status = 'revoked';
    this.persist();
    return true;
  }

  updateDeviceLastActive(id: string, timestampFormatted: string): void {
    const device = this.memoryDb.devices[id];
    if (device) {
      device.last_active_at = timestampFormatted;
      this.persist();
    }
  }

  // --- One-Time Device Licenses (No Timer / Indefinite Until Used or Deleted) ---

  createLicense(label: string): DeviceLicense {
    let code = '';
    let attempts = 0;
    do {
      code = generateLicenseCode(7);
      attempts++;
    } while (this.memoryDb.licenses[code] && attempts < 20);

    const license: DeviceLicense = {
      code,
      label: label.trim(),
      created_at: `${getManilaDateString()} ${getManilaTimeString()}`,
      used: false,
    };

    this.memoryDb.licenses[code] = license;
    this.persist();
    return license;
  }

  getLicense(code: string): DeviceLicense | undefined {
    return this.memoryDb.licenses[code.toUpperCase()];
  }

  consumeLicense(code: string, deviceId: string): boolean {
    const upper = code.toUpperCase();
    const license = this.memoryDb.licenses[upper];
    if (!license || license.used) {
      return false;
    }

    license.used = true;
    license.used_at = `${getManilaDateString()} ${getManilaTimeString()}`;
    license.used_device_id = deviceId;
    this.persist();
    return true;
  }

  deleteLicense(code: string): boolean {
    const upper = code.toUpperCase();
    if (!this.memoryDb.licenses[upper]) return false;
    delete this.memoryDb.licenses[upper];
    this.persist();
    return true;
  }

  getAllLicenses(): DeviceLicense[] {
    return Object.values(this.memoryDb.licenses).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  getUnusedLicenses(): DeviceLicense[] {
    return Object.values(this.memoryDb.licenses)
      .filter((l) => !l.used)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  // --- Settings ---

  getSettings(): SystemSettings {
    return { ...this.memoryDb.settings };
  }

  updateSettings(settings: Partial<SystemSettings>): SystemSettings {
    this.memoryDb.settings = {
      ...this.memoryDb.settings,
      ...settings,
    };
    this.persist();
    return this.memoryDb.settings;
  }

  // --- Rate Limiting ---

  recordAttempt(ip: string, type: AttemptLog['type']): void {
    const now = Date.now();
    this.memoryDb.attempts.push({ ip, type, timestamp: now });
    const cutoff = now - 2 * 60 * 60 * 1000;
    this.memoryDb.attempts = this.memoryDb.attempts.filter((a) => a.timestamp >= cutoff);
    this.persist();
  }

  getAttemptCount(ip: string, type: AttemptLog['type'], windowMs: number): number {
    const now = Date.now();
    const threshold = now - windowMs;
    return this.memoryDb.attempts.filter(
      (a) => a.ip === ip && a.type === type && a.timestamp >= threshold
    ).length;
  }

  resetAttempts(ip: string, type: AttemptLog['type']): void {
    this.memoryDb.attempts = this.memoryDb.attempts.filter(
      (a) => !(a.ip === ip && a.type === type)
    );
    this.persist();
  }
}

export const db = new StorageEngine();
