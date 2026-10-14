// Asia/Manila Timezone (UTC+8) Helpers

export const TIMEZONE = 'Asia/Manila';

/**
 * Returns current date in Asia/Manila in YYYY-MM-DD format
 */
export function getManilaDateString(date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // en-CA yields YYYY-MM-DD
}

/**
 * Returns time in Asia/Manila in format like "7:42 AM" or "4:10 PM"
 */
export function getManilaTimeString(date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return formatter.format(date);
}

/**
 * Returns 24-hour time in Asia/Manila in "HH:mm" format (e.g. "07:42" or "11:01")
 */
export function getManila24HourTime(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  let hour = parts.find((p) => p.type === 'hour')?.value || '00';
  if (hour === '24') hour = '00';
  const minute = parts.find((p) => p.type === 'minute')?.value || '00';
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

/**
 * Checks if current Manila time is before cutoff (e.g. "11:01")
 */
export function isBeforeCutoff(cutoffHhmm = '11:01', date = new Date()): boolean {
  const current = getManila24HourTime(date);
  return current < cutoffHhmm;
}

/**
 * Returns ISO timestamp string
 */
export function getIsoTimestamp(date = new Date()): string {
  return date.toISOString();
}
