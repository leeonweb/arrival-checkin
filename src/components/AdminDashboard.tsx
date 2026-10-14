import { useState, useEffect } from 'react';
import {
  Lock,
  LogOut,
  Users,
  UserCheck,
  Calendar,
  Plus,
  Trash2,
  Edit2,
  Download,
  Upload,
  Settings as SettingsIcon,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Tablet,
  ShieldCheck,
  KeyRound,
  Copy,
  Check,
  Sparkles,
  FileSpreadsheet,
  QrCode,
  Printer,
  Camera,
  MessageSquare,
  Clock,
  UserX,
} from 'lucide-react';
import { QRCodeModal } from './QRCodeModal.tsx';
import { BatchQRBadgesModal } from './BatchQRBadgesModal.tsx';

interface TodayStudent {
  student_code: string;
  name: string;
  parent_code: string;
  // Single session
  check_in: string | null;
  check_in_message: string | null;
  check_in_device: string | null;
  check_out: string | null;
  check_out_message: string | null;
  check_out_device: string | null;
  no_check_in_recorded: boolean;
  // Morning
  morning_check_in: string | null;
  morning_check_in_message: string | null;
  morning_check_in_device: string | null;
  morning_check_out: string | null;
  morning_check_out_message: string | null;
  morning_check_out_device: string | null;
  morning_no_check_in_recorded: boolean;
  // Afternoon
  afternoon_check_in: string | null;
  afternoon_check_in_message: string | null;
  afternoon_check_in_device: string | null;
  afternoon_check_out: string | null;
  afternoon_check_out_message: string | null;
  afternoon_check_out_device: string | null;
  afternoon_no_check_in_recorded: boolean;
  // Flags
  isCheckedIn: boolean;
  isCheckedOut: boolean;
  morningCheckedIn?: boolean;
  morningCheckedOut?: boolean;
  afternoonCheckedIn?: boolean;
  afternoonCheckedOut?: boolean;
}

interface TodayStaff {
  code: string;
  name: string;
  status: 'active' | 'revoked';
  morning_check_in: string | null;
  morning_check_in_message: string | null;
  morning_check_in_device: string | null;
  morning_check_out: string | null;
  morning_check_out_message: string | null;
  morning_check_out_device: string | null;
  afternoon_check_in: string | null;
  afternoon_check_in_message: string | null;
  afternoon_check_in_device: string | null;
  afternoon_check_out: string | null;
  afternoon_check_out_message: string | null;
  afternoon_check_out_device: string | null;
  check_in: string | null;
  check_out: string | null;
  isCheckedIn: boolean;
}

interface TodayDashboardData {
  role: 'head' | 'staff';
  date: string;
  currentTime: string;
  use_one_session?: boolean;
  morning_cutoff?: string;
  totalStudents: number;
  checkedInCount: number;
  checkedOutCount: number;
  notCheckedInCount: number;
  morningInCount?: number;
  morningOutCount?: number;
  afternoonInCount?: number;
  afternoonOutCount?: number;
  students: TodayStudent[];
  staff?: TodayStaff[];
}

interface StudentItem {
  code: string;
  name: string;
  parent_code: string;
}

interface StaffItem {
  code: string;
  name: string;
  status: 'active' | 'revoked';
  created_at?: string;
}

interface ParentItem {
  code: string;
  name?: string;
  contact?: string;
  linkedStudentCount: number;
}

interface DeviceItem {
  id: string;
  label: string;
  description: string;
  approved_at: string;
  last_active_at: string | null;
  status: 'active' | 'revoked';
}

interface LicenseItem {
  code: string;
  label: string;
  created_at: string;
  used: boolean;
  used_at?: string;
}

interface SystemSettings {
  allow_messages: boolean;
  use_one_session: boolean;
  morning_cutoff: string;
}

interface CsvRowPreview {
  rowIndex: number;
  student_code: string;
  student_name: string;
  parent_code: string;
  parent_name?: string;
  errors: string[];
  isExisting: boolean;
}

export function AdminDashboard() {
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('admin_token') || null;
  });
  const [currentRole, setCurrentRole] = useState<'head' | 'staff'>(() => {
    return (localStorage.getItem('admin_role') as 'head' | 'staff') || 'staff';
  });

  // Login form
  const [loginRole, setLoginRole] = useState<'head' | 'staff'>('head');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<
    'today' | 'devices' | 'students' | 'staff' | 'parents' | 'import' | 'export' | 'settings'
  >('today');

  // Today's view data
  const [todayData, setTodayData] = useState<TodayDashboardData | null>(null);
  const [todayViewTarget, setTodayViewTarget] = useState<'students' | 'staff'>('students');
  const [todayFilter, setTodayFilter] = useState<'all' | 'not_checked_in' | 'morning' | 'afternoon'>('all');
  const [todaySearch, setTodaySearch] = useState('');

  // Devices & Stations state (School Head only)
  const [devicesList, setDevicesList] = useState<DeviceItem[]>([]);
  const [unusedLicensesList, setUnusedLicensesList] = useState<LicenseItem[]>([]);
  const [newDeviceLabel, setNewDeviceLabel] = useState('');
  const [generatedLicense, setGeneratedLicense] = useState<LicenseItem | null>(null);
  const [licenseCopied, setLicenseCopied] = useState(false);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [editingDeviceLabel, setEditingDeviceLabel] = useState('');

  // QR Modals state
  const [singleQRModal, setSingleQRModal] = useState<{
    code: string;
    name?: string;
    title: string;
    parentCode?: string;
  } | null>(null);
  const [batchQRModalOpen, setBatchQRModalOpen] = useState(false);
  const [batchQRTarget, setBatchQRTarget] = useState<'students' | 'staff'>('students');

  // Students data
  const [studentsList, setStudentsList] = useState<StudentItem[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [editingStudent, setEditingStudent] = useState<StudentItem | null>(null);
  const [newStudent, setNewStudent] = useState({ code: '', name: '', parent_code: '' });
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<StudentItem | null>(null);

  // Staff data
  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [editingStaff, setEditingStaff] = useState<StaffItem | null>(null);
  const [newStaff, setNewStaff] = useState<{ code: string; name: string; status: 'active' | 'revoked' }>({
    code: '',
    name: '',
    status: 'active',
  });
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<StaffItem | null>(null);

  // Parents data
  const [parentsList, setParentsList] = useState<ParentItem[]>([]);
  const [parentSearch, setParentSearch] = useState('');
  const [editingParent, setEditingParent] = useState<ParentItem | null>(null);
  const [newParent, setNewParent] = useState({ code: '', name: '', contact: '' });
  const [showAddParentModal, setShowAddParentModal] = useState(false);
  const [parentDeleteError, setParentDeleteError] = useState<string | null>(null);

  // CSV Import
  const [csvText, setCsvText] = useState('');
  const [importMode, setImportMode] = useState<'add_only' | 'update_existing'>('add_only');
  const [csvPreview, setCsvPreview] = useState<{
    totalRows: number;
    hasErrors: boolean;
    totalErrors: number;
    rows: CsvRowPreview[];
  } | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  // CSV Export
  const [exportStart, setExportStart] = useState('');
  const [exportEnd, setExportEnd] = useState('');

  // Settings & Maintenance
  const [settings, setSettings] = useState<SystemSettings>({
    allow_messages: true,
    use_one_session: false,
    morning_cutoff: '11:01',
  });
  const [settingCutoffInput, setSettingCutoffInput] = useState('11:01');
  const [cleanupCutoff, setCleanupCutoff] = useState('');
  const [cleanupConfirm, setCleanupConfirm] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Helper for authenticated fetch
  const authFetch = async (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    if (authToken) {
      headers.set('Authorization', `Bearer ${authToken}`);
    }
    const res = await fetch(url, { credentials: 'include', ...options, headers });
    if (res.status === 401) {
      setAuthToken(null);
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_role');
    }
    return res;
  };

  // Verify auth on mount
  useEffect(() => {
    if (authToken) {
      authFetch('/api/admin/verify')
        .then(async (res) => {
          if (!res.ok) {
            setAuthToken(null);
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_role');
          } else {
            const data = await res.json();
            if (data.role) {
              setCurrentRole(data.role);
              localStorage.setItem('admin_role', data.role);
            }
          }
        })
        .catch(() => {
          setAuthToken(null);
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_role');
        });
    }
  }, [authToken]);

  // Load active tab data
  useEffect(() => {
    if (!authToken) return;

    if (activeTab === 'today') {
      loadTodayData();
    } else if (activeTab === 'devices') {
      if (currentRole === 'head') {
        loadDevices();
      }
    } else if (activeTab === 'students') {
      loadStudents();
    } else if (activeTab === 'staff') {
      loadStaff();
    } else if (activeTab === 'parents') {
      loadParents();
    } else if (activeTab === 'settings') {
      loadSettings();
    }
  }, [authToken, activeTab, currentRole]);

  const loadTodayData = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/today');
      if (res.ok) {
        const data = await res.json();
        setTodayData(data);
        if (data.role) setCurrentRole(data.role);
        if (!exportStart) {
          setExportStart(data.date);
          setExportEnd(data.date);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const loadDevices = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/devices');
      if (res.ok) {
        const data = await res.json();
        setDevicesList(data.devices || []);
        setUnusedLicensesList(data.unusedLicenses || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/students');
      if (res.ok) {
        const data = await res.json();
        setStudentsList(data.students);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadStaff = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/staff');
      if (res.ok) {
        const data = await res.json();
        setStaffList(data.staff || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadParents = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/parents');
      if (res.ok) {
        const data = await res.json();
        setParentsList(data.parents);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const res = await authFetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        if (data.morning_cutoff) {
          setSettingCutoffInput(data.morning_cutoff);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, rolePreference: loginRole }),
      });
      const data = await res.json();

      if (!res.ok) {
        setLoginError(data.error || 'Login failed');
      } else {
        setAuthToken(data.token);
        setCurrentRole(data.role);
        localStorage.setItem('admin_token', data.token);
        localStorage.setItem('admin_role', data.role);
        setPassword('');
      }
    } catch {
      setLoginError('Network connection error.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await authFetch('/api/admin/logout', { method: 'POST' });
    setAuthToken(null);
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_role');
  };

  // Generate One-Time Device License (School Head only)
  const handleGenerateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceLabel.trim()) return;

    try {
      const res = await authFetch('/api/admin/devices/generate-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newDeviceLabel.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setActionNotice({ type: 'error', message: data.error || 'Failed to generate license' });
      } else {
        setGeneratedLicense(data.license);
        setNewDeviceLabel('');
        setActionNotice({ type: 'success', message: data.message });
        loadDevices();
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Failed to generate station license.' });
    }
  };

  const handleDeleteLicense = async (code: string) => {
    if (!confirm(`Are you sure you want to delete unused license code ${code}?`)) return;

    try {
      const res = await authFetch(`/api/admin/devices/licenses/${code}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setActionNotice({ type: 'error', message: data.error || 'Failed to delete license' });
      } else {
        setActionNotice({ type: 'success', message: data.message });
        loadDevices();
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Network error deleting license code.' });
    }
  };

  const handleRenameDevice = async (id: string) => {
    if (!editingDeviceLabel.trim()) return;

    try {
      const res = await authFetch(`/api/admin/devices/${id}/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: editingDeviceLabel.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setActionNotice({ type: 'error', message: data.error || 'Failed to rename device' });
      } else {
        setEditingDeviceId(null);
        setEditingDeviceLabel('');
        loadDevices();
        setActionNotice({ type: 'success', message: 'Station renamed successfully.' });
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Failed to update device label.' });
    }
  };

  const handleRevokeDevice = async (id: string, label: string) => {
    if (
      !confirm(
        `Are you sure you want to revoke "${label}"? This station will immediately return to the activation screen.`
      )
    ) {
      return;
    }

    try {
      const res = await authFetch(`/api/admin/devices/${id}/revoke`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        setActionNotice({ type: 'error', message: data.error || 'Failed to revoke device' });
      } else {
        loadDevices();
        setActionNotice({ type: 'success', message: `Station "${label}" was revoked.` });
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Failed to revoke station device.' });
    }
  };

  const copyLicenseCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setLicenseCopied(true);
    setTimeout(() => setLicenseCopied(false), 2000);
  };

  const generateCodeFor = async (type: 'S' | 'P' | 'T', target: 'student' | 'parent' | 'staff') => {
    try {
      const res = await authFetch(`/api/admin/generate-code?type=${type}`);
      const data = await res.json();
      if (data.code) {
        if (target === 'student') {
          setNewStudent((prev) => ({ ...prev, code: data.code }));
        } else if (target === 'parent') {
          setNewParent((prev) => ({ ...prev, code: data.code }));
        } else {
          setNewStaff((prev) => ({ ...prev, code: data.code }));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save student
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionNotice(null);
    try {
      if (editingStudent) {
        const res = await authFetch(`/api/admin/students/${editingStudent.code}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingStudent),
        });
        const data = await res.json();
        if (!res.ok) {
          setActionNotice({ type: 'error', message: data.error || 'Failed to update student' });
        } else {
          setActionNotice({ type: 'success', message: 'Student updated successfully.' });
          setEditingStudent(null);
          loadStudents();
        }
      } else {
        const res = await authFetch('/api/admin/students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newStudent),
        });
        const data = await res.json();
        if (!res.ok) {
          setActionNotice({ type: 'error', message: data.error || 'Failed to create student' });
        } else {
          setActionNotice({
            type: 'success',
            message: `Student ${newStudent.name} (${newStudent.code}) created.`,
          });
          setNewStudent({ code: '', name: '', parent_code: '' });
          setShowAddStudentModal(false);
          loadStudents();
        }
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Network error saving student.' });
    }
  };

  const confirmDeleteStudent = async () => {
    if (!studentToDelete) return;
    try {
      const res = await authFetch(`/api/admin/students/${studentToDelete.code}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setActionNotice({ type: 'error', message: data.error || 'Failed to delete student' });
      } else {
        setActionNotice({ type: 'success', message: data.message });
        setStudentToDelete(null);
        loadStudents();
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Network error deleting student.' });
    }
  };

  // Staff handlers
  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionNotice(null);
    try {
      if (editingStaff) {
        const res = await authFetch(`/api/admin/staff/${editingStaff.code}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingStaff),
        });
        const data = await res.json();
        if (!res.ok) {
          setActionNotice({ type: 'error', message: data.error || 'Failed to update staff' });
        } else {
          setActionNotice({ type: 'success', message: 'Staff member updated successfully.' });
          setEditingStaff(null);
          loadStaff();
        }
      } else {
        const res = await authFetch('/api/admin/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newStaff),
        });
        const data = await res.json();
        if (!res.ok) {
          setActionNotice({ type: 'error', message: data.error || 'Failed to create staff' });
        } else {
          setActionNotice({
            type: 'success',
            message: `Staff member ${newStaff.name} (${newStaff.code}) added.`,
          });
          setNewStaff({ code: '', name: '', status: 'active' });
          setShowAddStaffModal(false);
          loadStaff();
        }
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Network error saving staff.' });
    }
  };

  const handleToggleStaffStatus = async (staffMember: StaffItem) => {
    const nextStatus = staffMember.status === 'active' ? 'revoked' : 'active';
    try {
      const res = await authFetch(`/api/admin/staff/${staffMember.code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionNotice({ type: 'error', message: data.error || 'Failed to update staff status' });
      } else {
        setActionNotice({
          type: 'success',
          message: `Staff member ${staffMember.name} is now ${nextStatus}.`,
        });
        loadStaff();
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Error updating staff status.' });
    }
  };

  const confirmDeleteStaff = async () => {
    if (!staffToDelete) return;
    try {
      const res = await authFetch(`/api/admin/staff/${staffToDelete.code}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setActionNotice({ type: 'error', message: data.error || 'Failed to delete staff' });
      } else {
        setActionNotice({ type: 'success', message: data.message });
        setStaffToDelete(null);
        loadStaff();
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Network error deleting staff.' });
    }
  };

  // Save parent
  const handleSaveParent = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionNotice(null);
    try {
      if (editingParent) {
        const res = await authFetch(`/api/admin/parents/${editingParent.code}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingParent),
        });
        const data = await res.json();
        if (!res.ok) {
          setActionNotice({ type: 'error', message: data.error || 'Failed to update parent' });
        } else {
          setActionNotice({ type: 'success', message: 'Parent updated.' });
          setEditingParent(null);
          loadParents();
        }
      } else {
        const res = await authFetch('/api/admin/parents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newParent),
        });
        const data = await res.json();
        if (!res.ok) {
          setActionNotice({ type: 'error', message: data.error || 'Failed to create parent' });
        } else {
          setActionNotice({ type: 'success', message: `Parent ${newParent.code} created.` });
          setNewParent({ code: '', name: '', contact: '' });
          setShowAddParentModal(false);
          loadParents();
        }
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Network error saving parent.' });
    }
  };

  const handleDeleteParent = async (code: string) => {
    setParentDeleteError(null);
    try {
      const res = await authFetch(`/api/admin/parents/${code}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setParentDeleteError(data.error || 'Failed to delete parent');
      } else {
        setActionNotice({ type: 'success', message: data.message });
        loadParents();
      }
    } catch {
      setParentDeleteError('Network error deleting parent.');
    }
  };

  // CSV Import handlers
  const handleCsvPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportLoading(true);
    setImportSuccessMsg(null);
    try {
      const res = await authFetch('/api/admin/csv-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText, mode: 'preview' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionNotice({ type: 'error', message: data.error || 'CSV validation failed' });
      } else {
        setCsvPreview(data);
      }
    } finally {
      setImportLoading(false);
    }
  };

  const handleCsvCommit = async () => {
    setImportLoading(true);
    try {
      const res = await authFetch('/api/admin/csv-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText,
          mode: 'commit',
          updateExisting: importMode === 'update_existing',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionNotice({ type: 'error', message: data.error || 'Import failed' });
      } else {
        setImportSuccessMsg(data.message);
        setCsvPreview(null);
        setCsvText('');
        loadStudents();
        loadParents();
      }
    } finally {
      setImportLoading(false);
    }
  };

  // Settings update
  const handleUpdateSettings = async (updates: Partial<SystemSettings>) => {
    try {
      const res = await authFetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (res.ok && data.settings) {
        setSettings(data.settings);
        if (data.settings.morning_cutoff) {
          setSettingCutoffInput(data.settings.morning_cutoff);
        }
        setActionNotice({ type: 'success', message: 'Settings updated successfully.' });
      } else {
        setActionNotice({ type: 'error', message: data.error || 'Failed to update settings.' });
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Network error updating settings.' });
    }
  };

  const handleCleanupAttendance = async () => {
    try {
      const res = await authFetch('/api/admin/cleanup-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cutoffDate: cleanupCutoff }),
      });
      const data = await res.json();
      if (res.ok) {
        setCleanupResult(data.message);
        setCleanupConfirm(false);
        setCleanupCutoff('');
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Cleanup failed.' });
    }
  };

  // NOT LOGGED IN: Render Login Modal
  if (!authToken) {
    return (
      <div className="w-full max-w-md mx-auto bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center shadow-inner">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Admin Staff Portal</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Select your role and enter the server secret password.
          </p>
        </div>

        {/* Role Toggle Selector */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-950 text-xs font-bold">
          <button
            type="button"
            onClick={() => setLoginRole('head')}
            className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              loginRole === 'head'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
            <span>School Head</span>
          </button>

          <button
            type="button"
            onClick={() => setLoginRole('staff')}
            className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              loginRole === 'staff'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Staff Admin</span>
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              {loginRole === 'head' ? 'School Head Password' : 'Staff Admin Password'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              className="w-full py-3.5 px-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base"
            />
            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <div>
                Default password: <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">{loginRole === 'head' ? 'schoolhead2026' : 'schooladmin2026'}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                {loginRole === 'head'
                  ? 'Head role grants full access, including station device approval, license code generation, and session settings.'
                  : 'Staff role grants daily roster, staff codes, and attendance logging access.'}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loginLoading || !password}
            className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
          >
            {loginLoading ? 'Verifying...' : `Sign In as ${loginRole === 'head' ? 'School Head' : 'Staff Admin'}`}
          </button>
        </form>

        {loginError && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-sm flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <div>
              <div className="font-semibold">{loginError}</div>
              <div className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                Password attempts are rate-limited to 5 tries per 15 minutes.
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Filtered today's students
  const filteredTodayStudents = (todayData?.students || []).filter((s) => {
    if (todayFilter === 'not_checked_in' && s.isCheckedIn) return false;
    if (todayFilter === 'morning' && !s.morningCheckedIn) return false;
    if (todayFilter === 'afternoon' && !s.afternoonCheckedIn) return false;
    if (todaySearch.trim()) {
      const q = todaySearch.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.student_code.toLowerCase().includes(q) ||
        s.parent_code.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredTodayStaff = (todayData?.staff || []).filter((st) => {
    if (todaySearch.trim()) {
      const q = todaySearch.toLowerCase();
      return st.name.toLowerCase().includes(q) || st.code.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Admin Top Header & Role Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black">
            {currentRole === 'head' ? 'H' : 'A'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                {currentRole === 'head' ? 'School Head Portal' : 'Staff Administration'}
              </h2>
              <span
                className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                  currentRole === 'head'
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {currentRole === 'head' ? 'Head of School' : 'Staff'}
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Authenticated • Manila Time (UTC+8)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-none">
        {[
          { id: 'today', label: "Today's Log", icon: Calendar },
          { id: 'devices', label: 'Devices', icon: Tablet, headOnly: true },
          { id: 'students', label: 'Students', icon: UserCheck },
          { id: 'staff', label: 'Staff Codes', icon: Users },
          { id: 'parents', label: 'Parents', icon: Users },
          { id: 'import', label: 'CSV Import', icon: Upload },
          { id: 'export', label: 'Reports & Export', icon: Download },
          { id: 'settings', label: 'Settings', icon: SettingsIcon },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id as typeof activeTab);
                setActionNotice(null);
              }}
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.headOnly && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-extrabold uppercase">
                  Head
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Notification Banner */}
      {actionNotice && (
        <div
          className={`p-4 rounded-2xl border text-sm flex items-center justify-between gap-3 ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{actionNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-xs font-bold opacity-60 hover:opacity-100 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 0: DEVICES (SCHOOL HEAD ONLY) */}
      {/* ========================================================= */}
      {activeTab === 'devices' && (
        <div className="space-y-6">
          {currentRole !== 'head' ? (
            <div className="bg-amber-50 dark:bg-amber-950/30 p-8 rounded-3xl border border-amber-200 dark:border-amber-900 text-center space-y-3">
              <ShieldCheck className="w-10 h-10 text-amber-600 mx-auto" />
              <h3 className="text-lg font-bold text-amber-900 dark:text-amber-200">
                School Head Authorization Required
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-300 max-w-md mx-auto">
                Only the School Head can authorize new station tablets, issue license codes, rename devices, or revoke stations.
              </p>
              <button
                type="button"
                onClick={handleLogout}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-md cursor-pointer"
              >
                Sign In as School Head
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Generate License Card */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Generate Station License Code &amp; QR
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Creates a one-time 6–8 character code (no 0, O, 1, I). Stays valid indefinitely until activated or deleted.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleGenerateLicense} className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={newDeviceLabel}
                    onChange={(e) => setNewDeviceLabel(e.target.value)}
                    placeholder='Station Label (e.g. "Main Gate Tablet", "Library Station")'
                    required
                    className="flex-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={!newDeviceLabel.trim()}
                    className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-600/20 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                  >
                    Generate Code &amp; QR
                  </button>
                </form>

                {/* Newly Generated License Preview */}
                {generatedLicense && (
                  <div className="p-5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 space-y-3">
                    <div className="text-xs font-semibold text-indigo-900 dark:text-indigo-300">
                      License Code Created for: <strong>{generatedLicense.label}</strong>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800">
                      <span className="font-mono text-3xl font-black tracking-widest text-indigo-700 dark:text-indigo-300">
                        {generatedLicense.code}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setSingleQRModal({
                              code: generatedLicense.code,
                              title: `Station License QR: ${generatedLicense.label}`,
                              name: generatedLicense.label,
                            })
                          }
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold transition-all cursor-pointer"
                        >
                          <QrCode className="w-4 h-4" />
                          <span>Show QR Code</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => copyLicenseCode(generatedLicense.code)}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all cursor-pointer"
                        >
                          {licenseCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          <span>{licenseCopied ? 'Copied!' : 'Copy Code'}</span>
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Hold this QR up to the tablet station camera, or type the code on the device screen to approve it.
                    </p>
                  </div>
                )}
              </div>

              {/* Unused License Codes List */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <KeyRound className="w-5 h-5 text-amber-500" />
                      <span>Unused License Codes ({unusedLicensesList.length})</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Pending codes ready to activate stations. Codes stay valid indefinitely until used or deleted.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={loadDevices}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                    title="Refresh"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {unusedLicensesList.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-sm">
                    No unused license codes. Generate one above to activate a new device.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {unusedLicensesList.map((lic) => (
                      <div
                        key={lic.code}
                        className="p-4 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-mono text-xl font-black text-amber-900 dark:text-amber-200 tracking-wider">
                            {lic.code}
                          </div>
                          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                            {lic.label}
                          </div>
                          <div className="text-[11px] text-slate-400">Created: {lic.created_at}</div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setSingleQRModal({
                                code: lic.code,
                                title: `License QR: ${lic.label}`,
                                name: lic.label,
                              })
                            }
                            className="p-2 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-xs font-bold cursor-pointer"
                            title="Show QR"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => copyLicenseCode(lic.code)}
                            className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-xs font-bold cursor-pointer"
                            title="Copy code"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteLicense(lic.code)}
                            className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 text-xs font-bold cursor-pointer"
                            title="Delete license code"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Approved Devices List */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Tablet className="w-5 h-5 text-indigo-600" />
                      <span>Approved Check-in Devices ({devicesList.filter((d) => d.status === 'active').length})</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Devices authorized to submit student &amp; staff attendance logs. Token persists indefinitely until manually revoked.
                    </p>
                  </div>
                </div>

                {devicesList.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    No devices have been approved yet. Use a license code above on a tablet to approve it.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {devicesList.map((device) => (
                      <div
                        key={device.id}
                        className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          {editingDeviceId === device.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editingDeviceLabel}
                                onChange={(e) => setEditingDeviceLabel(e.target.value)}
                                className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                              />
                              <button
                                type="button"
                                onClick={() => handleRenameDevice(device.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingDeviceId(null)}
                                className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-base text-slate-900 dark:text-white">
                                {device.label}
                              </span>
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                  device.status === 'active'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                }`}
                              >
                                {device.status}
                              </span>
                            </div>
                          )}

                          <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                            <span>Hardware: <strong>{device.description}</strong></span>
                            <span>Approved: {device.approved_at}</span>
                            <span>Last Active: {device.last_active_at || 'Never'}</span>
                          </div>
                        </div>

                        {device.status === 'active' && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingDeviceId(device.id);
                                setEditingDeviceLabel(device.label);
                              }}
                              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRevokeDevice(device.id, device.label)}
                              className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 text-xs font-bold cursor-pointer"
                            >
                              Revoke Device
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 1: TODAY'S ATTENDANCE VIEW */}
      {/* ========================================================= */}
      {activeTab === 'today' && (
        <div className="space-y-6">
          {/* Metrics summary */}
          {todayData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Total Students
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
                  {todayData.totalStudents}
                </div>
              </div>

              {!todayData.use_one_session ? (
                <>
                  <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 shadow-sm">
                    <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                      Morning In / Out
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-amber-800 dark:text-amber-200 mt-1">
                      {todayData.morningInCount ?? 0} / {todayData.morningOutCount ?? 0}
                    </div>
                  </div>

                  <div className="bg-indigo-50 dark:bg-indigo-950/30 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 shadow-sm">
                    <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                      Afternoon In / Out
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-indigo-800 dark:text-indigo-200 mt-1">
                      {todayData.afternoonInCount ?? 0} / {todayData.afternoonOutCount ?? 0}
                    </div>
                  </div>

                  <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 shadow-sm">
                    <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      Present Today
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-emerald-800 dark:text-emerald-200 mt-1">
                      {todayData.checkedInCount}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 shadow-sm">
                    <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      Checked In
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-emerald-800 dark:text-emerald-200 mt-1">
                      {todayData.checkedInCount}
                    </div>
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 shadow-sm">
                    <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                      Not Checked In
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-amber-800 dark:text-amber-200 mt-1">
                      {todayData.notCheckedInCount}
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-2xl border border-blue-200 dark:border-blue-900/50 shadow-sm">
                    <div className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                      Checked Out
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-blue-800 dark:text-blue-200 mt-1">
                      {todayData.checkedOutCount}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Sub-tab: Student vs Staff toggle */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTodayViewTarget('students')}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                  todayViewTarget === 'students'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Students Attendance
              </button>
              <button
                type="button"
                onClick={() => setTodayViewTarget('staff')}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                  todayViewTarget === 'staff'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Staff Attendance
              </button>
            </div>

            <button
              type="button"
              onClick={loadTodayData}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Search & Filter */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={todaySearch}
                onChange={(e) => setTodaySearch(e.target.value)}
                placeholder="Search name or code..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {todayViewTarget === 'students' && (
              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setTodayFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    todayFilter === 'all'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  All ({todayData?.students.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setTodayFilter('morning')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    todayFilter === 'morning'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Morning In ({todayData?.morningInCount || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setTodayFilter('afternoon')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    todayFilter === 'afternoon'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Afternoon In ({todayData?.afternoonInCount || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setTodayFilter('not_checked_in')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    todayFilter === 'not_checked_in'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Not In ({todayData?.notCheckedInCount || 0})
                </button>
              </div>
            )}
          </div>

          {/* Table: Students View */}
          {todayViewTarget === 'students' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-4">Student</th>
                      {!todayData?.use_one_session ? (
                        <>
                          <th className="p-4">Morning Session</th>
                          <th className="p-4">Afternoon Session</th>
                        </>
                      ) : (
                        <>
                          <th className="p-4">Check-In</th>
                          <th className="p-4">Check-Out</th>
                        </>
                      )}
                      <th className="p-4 text-right">Pass</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredTodayStudents.map((s) => (
                      <tr key={s.student_code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="p-4">
                          <div className="font-bold text-sm text-slate-900 dark:text-white">{s.name}</div>
                          <div className="text-slate-400 text-[11px] font-mono">
                            {s.student_code} • Parent: {s.parent_code}
                          </div>
                        </td>

                        {!todayData?.use_one_session ? (
                          <>
                            {/* Morning Session Column */}
                            <td className="p-4">
                              {s.morning_check_in ? (
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>In: {s.morning_check_in}</span>
                                    {s.morning_check_in_device && (
                                      <span className="text-[10px] opacity-75 font-normal">
                                        ({s.morning_check_in_device})
                                      </span>
                                    )}
                                  </div>
                                  {s.morning_check_out && (
                                    <div className="text-slate-600 dark:text-slate-400">
                                      Out: {s.morning_check_out}
                                      {s.morning_check_out_device && (
                                        <span className="text-[10px] opacity-75">
                                          {' '}
                                          ({s.morning_check_out_device})
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {s.morning_check_in_message && (
                                    <div className="text-[11px] text-slate-500 italic">
                                      &ldquo;{s.morning_check_in_message}&rdquo;
                                    </div>
                                  )}
                                </div>
                              ) : s.morning_check_out ? (
                                <div className="text-slate-600 dark:text-slate-400">
                                  Out: {s.morning_check_out} (no in recorded)
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">Not checked in</span>
                              )}
                            </td>

                            {/* Afternoon Session Column */}
                            <td className="p-4">
                              {s.afternoon_check_in ? (
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5 font-bold text-indigo-700 dark:text-indigo-400">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>In: {s.afternoon_check_in}</span>
                                    {s.afternoon_check_in_device && (
                                      <span className="text-[10px] opacity-75 font-normal">
                                        ({s.afternoon_check_in_device})
                                      </span>
                                    )}
                                  </div>
                                  {s.afternoon_check_out && (
                                    <div className="text-slate-600 dark:text-slate-400">
                                      Out: {s.afternoon_check_out}
                                      {s.afternoon_check_out_device && (
                                        <span className="text-[10px] opacity-75">
                                          {' '}
                                          ({s.afternoon_check_out_device})
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {s.afternoon_check_in_message && (
                                    <div className="text-[11px] text-slate-500 italic">
                                      &ldquo;{s.afternoon_check_in_message}&rdquo;
                                    </div>
                                  )}
                                </div>
                              ) : s.afternoon_check_out ? (
                                <div className="text-slate-600 dark:text-slate-400">
                                  Out: {s.afternoon_check_out} (no in recorded)
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">Not checked in</span>
                              )}
                            </td>
                          </>
                        ) : (
                          <>
                            {/* Single Session Columns */}
                            <td className="p-4">
                              {s.check_in && s.check_in !== 'no check-in recorded' ? (
                                <div>
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                    {s.check_in}
                                  </span>
                                  {s.check_in_device && (
                                    <span className="text-[10px] text-slate-400 ml-1">
                                      ({s.check_in_device})
                                    </span>
                                  )}
                                  {s.check_in_message && (
                                    <div className="text-[11px] text-slate-500 italic">
                                      &ldquo;{s.check_in_message}&rdquo;
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">Not checked in</span>
                              )}
                            </td>
                            <td className="p-4">
                              {s.check_out ? (
                                <div>
                                  <span className="font-bold text-blue-600 dark:text-blue-400">
                                    {s.check_out}
                                  </span>
                                  {s.check_out_device && (
                                    <span className="text-[10px] text-slate-400 ml-1">
                                      ({s.check_out_device})
                                    </span>
                                  )}
                                  {s.no_check_in_recorded && (
                                    <span className="text-[10px] text-amber-600 block">
                                      (no check-in recorded)
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </>
                        )}

                        <td className="p-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setSingleQRModal({
                                code: s.student_code,
                                name: s.name,
                                title: `Student ID Pass: ${s.name}`,
                                parentCode: s.parent_code,
                              })
                            }
                            className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-colors cursor-pointer"
                            title="Show QR Code"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Table: Staff Attendance View */}
          {todayViewTarget === 'staff' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-4">Staff Member</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Morning Session</th>
                      <th className="p-4">Afternoon Session</th>
                      <th className="p-4 text-right">QR Pass</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredTodayStaff.map((st) => (
                      <tr key={st.code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="p-4">
                          <div className="font-bold text-sm text-slate-900 dark:text-white">{st.name}</div>
                          <div className="text-slate-400 text-[11px] font-mono">{st.code}</div>
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              st.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                          >
                            {st.status}
                          </span>
                        </td>
                        <td className="p-4">
                          {st.morning_check_in ? (
                            <div className="font-semibold text-amber-700 dark:text-amber-400">
                              In: {st.morning_check_in} {st.morning_check_out && `• Out: ${st.morning_check_out}`}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Not recorded</span>
                          )}
                        </td>
                        <td className="p-4">
                          {st.afternoon_check_in ? (
                            <div className="font-semibold text-indigo-700 dark:text-indigo-400">
                              In: {st.afternoon_check_in} {st.afternoon_check_out && `• Out: ${st.afternoon_check_out}`}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Not recorded</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setSingleQRModal({
                                code: st.code,
                                name: st.name,
                                title: `Staff ID Pass: ${st.name}`,
                              })
                            }
                            className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-colors cursor-pointer"
                            title="Show Staff QR"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: STUDENTS ROSTER */}
      {/* ========================================================= */}
      {activeTab === 'students' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-600" />
                <span>Student Roster ({studentsList.length})</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Manage student records one by one or print batch badges.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setBatchQRTarget('students');
                  setBatchQRModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Batch Print Badges</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  generateCodeFor('S', 'student');
                  setShowAddStudentModal(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Student</span>
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Search students by name, code, or parent code..."
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Students Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">Code</th>
                  <th className="p-3.5">Name</th>
                  <th className="p-3.5">Parent Code</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {studentsList
                  .filter((s) => {
                    const q = studentSearch.toLowerCase();
                    return (
                      s.name.toLowerCase().includes(q) ||
                      s.code.toLowerCase().includes(q) ||
                      s.parent_code.toLowerCase().includes(q)
                    );
                  })
                  .map((s) => (
                    <tr key={s.code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="p-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {s.code}
                      </td>
                      <td className="p-3.5 font-semibold text-slate-900 dark:text-white">{s.name}</td>
                      <td className="p-3.5 font-mono text-slate-500">{s.parent_code}</td>
                      <td className="p-3.5 text-right space-x-1">
                        <button
                          type="button"
                          onClick={() =>
                            setSingleQRModal({
                              code: s.code,
                              name: s.name,
                              title: `Student ID Pass: ${s.name}`,
                              parentCode: s.parent_code,
                            })
                          }
                          className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 cursor-pointer"
                          title="Show QR Code"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingStudent(s)}
                          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setStudentToDelete(s)}
                          className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Add Student Modal */}
          {showAddStudentModal && (
            <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">Add New Student</h4>
                <form onSubmit={handleSaveStudent} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Student Code
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newStudent.code}
                        onChange={(e) =>
                          setNewStudent((prev) => ({
                            ...prev,
                            code: e.target.value.replace(/[-\s]/g, '').toUpperCase(),
                          }))
                        }
                        placeholder="e.g. S004"
                        required
                        className="flex-1 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs uppercase"
                      />
                      <button
                        type="button"
                        onClick={() => generateCodeFor('S', 'student')}
                        className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                      >
                        Auto
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Student Full Name
                    </label>
                    <input
                      type="text"
                      value={newStudent.name}
                      onChange={(e) => setNewStudent((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Jose Rizal"
                      required
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Parent Code (Family Code)
                    </label>
                    <input
                      type="text"
                      value={newStudent.parent_code}
                      onChange={(e) =>
                        setNewStudent((prev) => ({
                          ...prev,
                          parent_code: e.target.value.replace(/[-\s]/g, '').toUpperCase(),
                        }))
                      }
                      placeholder="e.g. P4821"
                      required
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs uppercase"
                    />
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddStudentModal(false)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer"
                    >
                      Save Student
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Student Modal */}
          {editingStudent && (
            <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                  Edit Student {editingStudent.code}
                </h4>
                <form onSubmit={handleSaveStudent} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Student Full Name
                    </label>
                    <input
                      type="text"
                      value={editingStudent.name}
                      onChange={(e) =>
                        setEditingStudent((prev) => (prev ? { ...prev, name: e.target.value } : null))
                      }
                      required
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Parent Code
                    </label>
                    <input
                      type="text"
                      value={editingStudent.parent_code}
                      onChange={(e) =>
                        setEditingStudent((prev) =>
                          prev
                            ? {
                                ...prev,
                                parent_code: e.target.value.replace(/[-\s]/g, '').toUpperCase(),
                              }
                            : null
                        )
                      }
                      required
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs uppercase"
                    />
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingStudent(null)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer"
                    >
                      Update Student
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Delete Confirm Modal */}
          {studentToDelete && (
            <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-rose-200 dark:border-rose-900 space-y-4">
                <h4 className="text-lg font-bold text-rose-600">Delete Student Record</h4>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Are you sure you want to delete <strong>{studentToDelete.name}</strong> ({studentToDelete.code})?
                  This will also purge their associated attendance records.
                </p>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setStudentToDelete(null)}
                    className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteStudent}
                    className="flex-1 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: STAFF MANAGEMENT */}
      {/* ========================================================= */}
      {activeTab === 'staff' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <span>Staff Codes ({staffList.length})</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Manage faculty &amp; admin codes (prefix T). Staff can scan QR or type codes at station tablets. Codes are never visible publicly.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  generateCodeFor('T', 'staff');
                  setShowAddStaffModal(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Staff Member</span>
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={staffSearch}
              onChange={(e) => setStaffSearch(e.target.value)}
              placeholder="Search staff by name or code..."
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Staff Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">Code</th>
                  <th className="p-3.5">Name</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {staffList
                  .filter((st) => {
                    const q = staffSearch.toLowerCase();
                    return st.name.toLowerCase().includes(q) || st.code.toLowerCase().includes(q);
                  })
                  .map((st) => (
                    <tr key={st.code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="p-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {st.code}
                      </td>
                      <td className="p-3.5 font-semibold text-slate-900 dark:text-white">{st.name}</td>
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() => handleToggleStaffStatus(st)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase cursor-pointer transition-colors ${
                            st.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-rose-100 hover:text-rose-800'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 hover:bg-emerald-100 hover:text-emerald-800'
                          }`}
                          title="Click to toggle Active / Revoked"
                        >
                          {st.status} (tap to change)
                        </button>
                      </td>
                      <td className="p-3.5 text-right space-x-1">
                        <button
                          type="button"
                          onClick={() =>
                            setSingleQRModal({
                              code: st.code,
                              name: st.name,
                              title: `Staff ID Pass: ${st.name}`,
                            })
                          }
                          className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 cursor-pointer"
                          title="Show QR Code"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingStaff(st)}
                          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setStaffToDelete(st)}
                          className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Add Staff Modal */}
          {showAddStaffModal && (
            <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">Add Staff Member</h4>
                <form onSubmit={handleSaveStaff} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Staff Code (Prefix T)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newStaff.code}
                        onChange={(e) =>
                          setNewStaff((prev) => ({
                            ...prev,
                            code: e.target.value.replace(/[-\s]/g, '').toUpperCase(),
                          }))
                        }
                        placeholder="e.g. T4829"
                        required
                        className="flex-1 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs uppercase"
                      />
                      <button
                        type="button"
                        onClick={() => generateCodeFor('T', 'staff')}
                        className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                      >
                        Auto
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Staff Name
                    </label>
                    <input
                      type="text"
                      value={newStaff.name}
                      onChange={(e) => setNewStaff((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Maria Santos (Teacher)"
                      required
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Initial Status
                    </label>
                    <select
                      value={newStaff.status}
                      onChange={(e) =>
                        setNewStaff((prev) => ({
                          ...prev,
                          status: e.target.value as 'active' | 'revoked',
                        }))
                      }
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                    >
                      <option value="active">Active</option>
                      <option value="revoked">Revoked</option>
                    </select>
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddStaffModal(false)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer"
                    >
                      Save Staff
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Staff Modal */}
          {editingStaff && (
            <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                  Edit Staff Member {editingStaff.code}
                </h4>
                <form onSubmit={handleSaveStaff} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={editingStaff.name}
                      onChange={(e) =>
                        setEditingStaff((prev) => (prev ? { ...prev, name: e.target.value } : null))
                      }
                      required
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Status
                    </label>
                    <select
                      value={editingStaff.status}
                      onChange={(e) =>
                        setEditingStaff((prev) =>
                          prev
                            ? {
                                ...prev,
                                status: e.target.value as 'active' | 'revoked',
                              }
                            : null
                        )
                      }
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                    >
                      <option value="active">Active</option>
                      <option value="revoked">Revoked</option>
                    </select>
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingStaff(null)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer"
                    >
                      Update
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Delete Staff Confirm Modal */}
          {staffToDelete && (
            <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-rose-200 dark:border-rose-900 space-y-4">
                <h4 className="text-lg font-bold text-rose-600">Delete Staff Member</h4>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Are you sure you want to delete <strong>{staffToDelete.name}</strong> ({staffToDelete.code})?
                </p>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setStaffToDelete(null)}
                    className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteStaff}
                    className="flex-1 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: PARENTS */}
      {/* ========================================================= */}
      {activeTab === 'parents' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <span>Parent Family Codes ({parentsList.length})</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Family codes allow parents to view status without logging in. Deletion is blocked if students are still linked.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                generateCodeFor('P', 'parent');
                setShowAddParentModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Parent Code</span>
            </button>
          </div>

          {parentDeleteError && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{parentDeleteError}</span>
            </div>
          )}

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={parentSearch}
              onChange={(e) => setParentSearch(e.target.value)}
              placeholder="Search parent code, family name, contact..."
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">Code</th>
                  <th className="p-3.5">Family / Name</th>
                  <th className="p-3.5">Contact</th>
                  <th className="p-3.5">Linked Children</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {parentsList
                  .filter((p) => {
                    const q = parentSearch.toLowerCase();
                    return (
                      p.code.toLowerCase().includes(q) ||
                      (p.name && p.name.toLowerCase().includes(q)) ||
                      (p.contact && p.contact.toLowerCase().includes(q))
                    );
                  })
                  .map((p) => (
                    <tr key={p.code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="p-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {p.code}
                      </td>
                      <td className="p-3.5 font-semibold text-slate-900 dark:text-white">
                        {p.name || '—'}
                      </td>
                      <td className="p-3.5 text-slate-500">{p.contact || '—'}</td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px]">
                          {p.linkedStudentCount} student(s)
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-1">
                        <button
                          type="button"
                          onClick={() => setEditingParent(p)}
                          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteParent(p.code)}
                          className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Add Parent Modal */}
          {showAddParentModal && (
            <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">Add Parent Code</h4>
                <form onSubmit={handleSaveParent} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Parent Code
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newParent.code}
                        onChange={(e) =>
                          setNewParent((prev) => ({
                            ...prev,
                            code: e.target.value.replace(/[-\s]/g, '').toUpperCase(),
                          }))
                        }
                        placeholder="e.g. P4821"
                        required
                        className="flex-1 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs uppercase"
                      />
                      <button
                        type="button"
                        onClick={() => generateCodeFor('P', 'parent')}
                        className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                      >
                        Auto
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Family / Parent Name (optional)
                    </label>
                    <input
                      type="text"
                      value={newParent.name}
                      onChange={(e) => setNewParent((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Santos Family"
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Contact Number (optional)
                    </label>
                    <input
                      type="text"
                      value={newParent.contact}
                      onChange={(e) => setNewParent((prev) => ({ ...prev, contact: e.target.value }))}
                      placeholder="e.g. 0917-555-0199"
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                    />
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddParentModal(false)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer"
                    >
                      Save Parent
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Parent Modal */}
          {editingParent && (
            <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                  Edit Parent {editingParent.code}
                </h4>
                <form onSubmit={handleSaveParent} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Family / Parent Name
                    </label>
                    <input
                      type="text"
                      value={editingParent.name || ''}
                      onChange={(e) =>
                        setEditingParent((prev) => (prev ? { ...prev, name: e.target.value } : null))
                      }
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Contact
                    </label>
                    <input
                      type="text"
                      value={editingParent.contact || ''}
                      onChange={(e) =>
                        setEditingParent((prev) => (prev ? { ...prev, contact: e.target.value } : null))
                      }
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                    />
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingParent(null)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer"
                    >
                      Update
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 5: CSV IMPORT */}
      {/* ========================================================= */}
      {activeTab === 'import' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-600" />
              <span>Bulk Student Roster Import (CSV)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Import up to 1,000 students at once. Required headers:{' '}
              <code className="text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">
                student_code, student_name, parent_code
              </code>{' '}
              (optional:{' '}
              <code className="text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">
                parent_name
              </code>
              ).
            </p>
          </div>

          <form onSubmit={handleCsvPreview} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>Paste CSV Data</span>
                <button
                  type="button"
                  onClick={() => {
                    setCsvText(
                      `student_code,student_name,parent_code,parent_name\nS101,Juan Gomez,P901,Gomez Family\nS102,Ana Gomez,P901,Gomez Family\nS103,Mateo Cruz,P902,Cruz Family`
                    );
                  }}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Load sample template
                </button>
              </div>

              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={6}
                placeholder="student_code,student_name,parent_code,parent_name&#10;S101,Juan Gomez,P901,Gomez Family"
                className="w-full font-mono text-xs sm:text-sm p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Import Mode:
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="radio"
                  name="import_mode"
                  checked={importMode === 'add_only'}
                  onChange={() => setImportMode('add_only')}
                />
                <span>Add new only</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="radio"
                  name="import_mode"
                  checked={importMode === 'update_existing'}
                  onChange={() => setImportMode('update_existing')}
                />
                <span>Update existing too</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={importLoading || !csvText.trim()}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
            >
              {importLoading ? 'Validating CSV...' : 'Preview CSV Import'}
            </button>
          </form>

          {importSuccessMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{importSuccessMsg}</span>
            </div>
          )}

          {/* CSV Preview Table */}
          {csvPreview && (
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">
                    Preview: {csvPreview.totalRows} row(s) found
                  </h4>
                  {csvPreview.hasErrors ? (
                    <div className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                      Found {csvPreview.totalErrors} error(s). Please fix before committing.
                    </div>
                  ) : (
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                      All rows valid and ready to import.
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleCsvCommit}
                  disabled={importLoading || csvPreview.hasErrors}
                  className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {importLoading ? 'Importing...' : 'Confirm & Save to Roster'}
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 sticky top-0">
                    <tr>
                      <th className="p-2.5">Row</th>
                      <th className="p-2.5">Student Code</th>
                      <th className="p-2.5">Name</th>
                      <th className="p-2.5">Parent Code</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {csvPreview.rows.map((row) => (
                      <tr
                        key={row.rowIndex}
                        className={row.errors.length > 0 ? 'bg-rose-50/50 dark:bg-rose-950/30' : ''}
                      >
                        <td className="p-2.5">{row.rowIndex}</td>
                        <td className="p-2.5 font-mono font-bold">{row.student_code}</td>
                        <td className="p-2.5">{row.student_name}</td>
                        <td className="p-2.5 font-mono">{row.parent_code}</td>
                        <td className="p-2.5">
                          {row.errors.length > 0 ? (
                            <span className="text-rose-600 font-bold">{row.errors.join('; ')}</span>
                          ) : row.isExisting ? (
                            <span className="text-amber-600 font-semibold">Existing student</span>
                          ) : (
                            <span className="text-emerald-600 font-semibold">New student</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 6: REPORTS & EXPORT */}
      {/* ========================================================= */}
      {activeTab === 'export' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Download className="w-5 h-5 text-indigo-600" />
                <span>Attendance Logs &amp; Roster CSV Export</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Download verified attendance logs and roster CSVs. Protected against spreadsheet formula injection. Includes station device names and sessions.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Attendance Range Export */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Attendance Records Log</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-slate-500 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={exportStart}
                      onChange={(e) => setExportStart(e.target.value)}
                      className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">End Date</label>
                    <input
                      type="date"
                      value={exportEnd}
                      onChange={(e) => setExportEnd(e.target.value)}
                      className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>
                </div>

                <a
                  href={`/api/admin/export/attendance?start=${exportStart}&end=${exportEnd}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Attendance CSV</span>
                </a>
              </div>

              {/* Roster Export */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-indigo-600" />
                    <span>Current Student Roster</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Exports the active roster of all students, linked family codes, and contact info.
                  </p>
                </div>

                <a
                  href="/api/admin/export/roster"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Roster CSV</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 7: SETTINGS & MAINTENANCE */}
      {/* ========================================================= */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Session Settings (School Head only) */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span>Sessions Configuration (Morning &amp; Afternoon)</span>
                  {currentRole !== 'head' && (
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-normal text-slate-400">
                      Head of School only
                    </span>
                  )}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                  By default, each school day supports two distinct sessions: Morning and Afternoon.
                  Turn on &ldquo;Use one session per day&rdquo; if your school does not need two separate daily sessions.
                </p>
              </div>

              {currentRole === 'head' && (
                <button
                  type="button"
                  onClick={() => handleUpdateSettings({ use_one_session: !settings.use_one_session })}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.use_one_session ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      settings.use_one_session ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              )}
            </div>

            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Current Session Mode:{' '}
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                {settings.use_one_session
                  ? 'One session per day'
                  : 'Two sessions per day (Morning and Afternoon)'}
              </span>
            </div>

            {/* Cutoff setting (when two sessions mode is active) */}
            {!settings.use_one_session && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                      Morning / Afternoon Cutoff Time (Asia/Manila Clock)
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Check-ins before this cutoff are Morning session. Check-ins at or after this time are Afternoon session.
                    </p>
                  </div>

                  {currentRole === 'head' ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={settingCutoffInput}
                        onChange={(e) => setSettingCutoffInput(e.target.value)}
                        className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateSettings({ morning_cutoff: settingCutoffInput })}
                        className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 cursor-pointer"
                      >
                        Save Cutoff
                      </button>
                    </div>
                  ) : (
                    <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                      {settings.morning_cutoff || '11:01'}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Allow Messages Setting */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  Allow Check-in / Check-out Notes &amp; Messages
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-lg">
                  When enabled, students can write a short note (e.g. &ldquo;Going home with Tita today&rdquo;).
                  When turned OFF, the message box is hidden from the check-in screen.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleUpdateSettings({ allow_messages: !settings.allow_messages })}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.allow_messages ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.allow_messages ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              Current Status: {settings.allow_messages ? 'Messages Allowed' : 'Messages Disabled'}
            </div>
          </div>

          {/* Retention & Attendance Pruning */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-500" />
                <span>Attendance Retention &amp; Cleanup</span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Records are kept for one school year. Use this utility to delete historical records older than a specific date cutoff.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-end gap-3">
              <div className="w-full sm:w-60 space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Delete Records Older Than:
                </label>
                <input
                  type="date"
                  value={cleanupCutoff}
                  onChange={(e) => setCleanupCutoff(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                />
              </div>

              <button
                type="button"
                disabled={!cleanupCutoff}
                onClick={() => setCleanupConfirm(true)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md disabled:opacity-50 cursor-pointer"
              >
                Prune Old Records
              </button>
            </div>

            {cleanupResult && (
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300">
                {cleanupResult}
              </div>
            )}

            {/* Confirm cleanup modal */}
            {cleanupConfirm && (
              <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-rose-200 dark:border-rose-900 space-y-4">
                  <h4 className="text-lg font-bold text-rose-600">Confirm Deletion</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Are you sure you want to delete all attendance records before <strong>{cleanupCutoff}</strong>?
                    This action cannot be undone.
                  </p>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setCleanupConfirm(false)}
                      className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCleanupAttendance}
                      className="flex-1 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
                    >
                      Confirm Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR Code Modals */}
      {singleQRModal && (
        <QRCodeModal
          isOpen={Boolean(singleQRModal)}
          onClose={() => setSingleQRModal(null)}
          title={singleQRModal.title}
          code={singleQRModal.code}
          name={singleQRModal.name}
          subtitle="Scan with check-in station camera"
          meta={{
            parentCode: singleQRModal.parentCode,
          }}
        />
      )}

      <BatchQRBadgesModal
        isOpen={batchQRModalOpen}
        onClose={() => setBatchQRModalOpen(false)}
        students={
          batchQRTarget === 'students'
            ? studentsList
            : staffList.map((st) => ({
                code: st.code,
                name: st.name,
                role: 'Staff',
              }))
        }
      />
    </div>
  );
}
