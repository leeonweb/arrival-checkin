// Helper utilities for code generation, CSV formatting, and formula injection mitigation

// Charset excluding 0, O, 1, I to avoid misreading and ambiguity
export const SAFE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generate a random 4-5 char code with a prefix (S for students, P for parents, T for staff).
 * Letters and digits only, no 0, O, 1, I, no hyphens.
 */
export function generateRandomCode(prefix: 'S' | 'P' | 'T', length = 4): string {
  let result = prefix;
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * SAFE_CHARS.length);
    result += SAFE_CHARS[randomIndex];
  }
  return result;
}

/**
 * Generate a random one-time license code (6 to 8 characters, default 7).
 * Letters and digits only, no 0, O, 1, I.
 */
export function generateLicenseCode(length = 7): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * SAFE_CHARS.length);
    result += SAFE_CHARS[randomIndex];
  }
  return result;
}

/**
 * Parse user agent to generate a short, human-friendly hardware/OS/browser description.
 * (e.g. "Chrome on Android", "Safari on iOS", "Edge on Windows")
 */
export function parseUserAgent(uaString: string | undefined): string {
  if (!uaString) return 'Unknown Device';

  const ua = uaString;

  // Detect OS
  let os = 'Unknown OS';
  if (/iPad/i.test(ua)) {
    os = 'iPadOS';
  } else if (/iPhone/i.test(ua)) {
    os = 'iOS';
  } else if (/Android/i.test(ua)) {
    os = 'Android';
  } else if (/Windows NT/i.test(ua)) {
    os = 'Windows';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    os = 'macOS';
  } else if (/CrOS/i.test(ua)) {
    os = 'ChromeOS';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  }

  // Detect Browser
  let browser = 'Browser';
  if (/Edg\//i.test(ua)) {
    browser = 'Edge';
  } else if (/Chrome\/|CriOS\//i.test(ua)) {
    browser = 'Chrome';
  } else if (/Firefox\/|FxiOS\//i.test(ua)) {
    browser = 'Firefox';
  } else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) {
    browser = 'Safari';
  } else if (/OPR\/|Opera\//i.test(ua)) {
    browser = 'Opera';
  }

  return `${browser} on ${os}`;
}

/**
 * Sanitize text input: trim spaces, limit length, and strip controls.
 */
export function sanitizeInput(input: unknown, maxLength = 140): string {
  if (typeof input !== 'string') return '';
  let cleaned = input.trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  if (cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength);
  }
  return cleaned;
}

/**
 * Normalize codes: trim, remove hyphens and spaces, uppercase
 */
export function normalizeCode(code: unknown): string {
  if (typeof code !== 'string') return '';
  return code.replace(/[-\s]/g, '').toUpperCase().trim();
}

/**
 * Defend against spreadsheet formula injection (CSV Injection).
 * Any cell value that begins with =, +, -, @, or tab is prefixed with an apostrophe.
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let str = String(value);

  // If starts with dangerous character, prepend single quote
  if (/^[\=\+\-\@\t\r]/.test(str)) {
    str = "'" + str;
  }

  // Escape inner double quotes
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Parse a CSV string into rows and columns
 */
export function parseCsv(text: string): string[][] {
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuote = false;

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const nextChar = normalized[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      currentRow.push(currentField);
      currentField = '';
    } else if (char === '\n' && !insideQuote) {
      currentRow.push(currentField);
      if (currentRow.some((f) => f.trim().length > 0)) {
        lines.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((f) => f.trim().length > 0)) {
      lines.push(currentRow);
    }
  }

  return lines;
}
