export interface Student {
  code: string;
  name: string;
  parent_code: string;
  created_at?: string;
}

export interface Parent {
  code: string;
  name?: string;
  contact?: string;
  created_at?: string;
}

export interface StaffMember {
  code: string; // prefix T, e.g. T4829
  name: string;
  status: 'active' | 'revoked';
  created_at?: string;
}

export interface AttendanceRecord {
  id: string; // e.g. 2026-10-13_S001 or 2026-10-13_T4829
  date: string; // YYYY-MM-DD in Asia/Manila
  code: string; // student_code or staff_code
  name: string; // student_name or staff_name
  parent_code?: string;
  is_staff?: boolean;

  // Morning Session
  morning_check_in?: string; // e.g. "7:42 AM"
  morning_check_in_raw?: string; // ISO timestamp
  morning_check_in_message?: string;
  morning_check_in_device?: string; // label of station device
  morning_check_in_device_id?: string;
  morning_check_out?: string; // e.g. "11:45 AM"
  morning_check_out_raw?: string; // ISO timestamp
  morning_check_out_message?: string;
  morning_check_out_device?: string;
  morning_check_out_device_id?: string;
  morning_no_check_in_recorded?: boolean;

  // Afternoon Session
  afternoon_check_in?: string; // e.g. "12:30 PM"
  afternoon_check_in_raw?: string; // ISO timestamp
  afternoon_check_in_message?: string;
  afternoon_check_in_device?: string;
  afternoon_check_in_device_id?: string;
  afternoon_check_out?: string; // e.g. "4:15 PM"
  afternoon_check_out_raw?: string; // ISO timestamp
  afternoon_check_out_message?: string;
  afternoon_check_out_device?: string;
  afternoon_check_out_device_id?: string;
  afternoon_no_check_in_recorded?: boolean;

  // Backwards compatibility / Single-session rollup fields
  student_code?: string;
  student_name?: string;
  check_in?: string;
  check_in_raw?: string;
  check_in_message?: string;
  check_in_device?: string;
  check_in_device_id?: string;
  check_out?: string;
  check_out_raw?: string;
  check_out_message?: string;
  check_out_device?: string;
  check_out_device_id?: string;
  no_check_in_recorded?: boolean;
}

export interface Device {
  id: string;
  token: string; // secret random token kept in station browser (survives restarts)
  label: string; // e.g. "Main Gate Tablet"
  description: string; // browser & operating system
  approved_at: string;
  last_active_at: string | null;
  status: 'active' | 'revoked';
  user_agent?: string;
}

export interface DeviceLicense {
  code: string; // 6-8 chars (letters and digits, no 0, O, 1, I)
  label: string;
  created_at: string;
  used: boolean;
  used_at?: string;
  used_device_id?: string;
}

export interface SystemSettings {
  allow_messages: boolean;
  use_one_session: boolean; // default false (two sessions Morning & Afternoon)
  morning_cutoff: string; // default "11:01" (24-hour HH:mm Asia/Manila)
}

export interface AttemptLog {
  ip: string;
  type: 'student_code' | 'parent_code' | 'admin_login' | 'head_login' | 'license_code';
  timestamp: number;
}

export interface AdminSession {
  token: string;
  role: 'head' | 'staff';
  createdAt: number;
}
