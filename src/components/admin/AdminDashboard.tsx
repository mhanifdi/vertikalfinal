/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Users,
  CheckCircle2,
  Building2,
  Layers,
  Search,
  Settings,
  FileSpreadsheet,
  Database,
  LayoutDashboard,
  Plus,
  Edit3,
  Download,
  Upload,
  History,
  UserCheck,
  RefreshCw,
} from 'lucide-react';
import {
  Teacher,
  Student,
  DashboardWidgetConfig,
  TeacherAssignmentType,
} from '../../types';
import { api } from '../../utils/api';
import { StudentReportModal } from '../common/StudentReportModal';

interface AdminDashboardProps {
  admin: Teacher;
  allStudents: Student[];
  onLogout: () => void;
  onRefreshStudents?: () => void;
}

type AdminControlTab =
  | 'overview'
  | 'students'
  | 'teachers'
  | 'classes_rombels'
  | 'journals'
  | 'widgets_settings';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  admin,
  allStudents,
  onLogout,
  onRefreshStudents,
}) => {
  const [activeTab, setActiveTab] = useState<AdminControlTab>('overview');
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  // =========================================================================
  // G.1: OVERVIEW STATE
  // =========================================================================
  const [overviewData, setOverviewData] = useState<any>(null);

  // =========================================================================
  // G.2 & G.9: MANAJEMEN AKUN SISWA + IMPORT/EXPORT CSV
  // =========================================================================
  const [adminStudents, setAdminStudents] = useState<Student[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [filterClass, setFilterClass] = useState('ALL');
  const [filterRombel, setFilterRombel] = useState('ALL');
  const [filterAngkatan, setFilterAngkatan] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterDemo, setFilterDemo] = useState('ALL');
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [studentForm, setStudentForm] = useState<any>({
    id: '',
    nisn: '',
    name: '',
    password: '123',
    gender: 'L',
    religion: 'Islam',
    class_name: 'XI-MIPA-1',
    rombel_name: 'Rombel A',
    angkatan: '2025/2026',
    walas_name: 'Ibu Dra. Hj. Siti Aminah, M.Pd.',
    walas_nip: '197504122000122002',
    wali_name: 'Bapak Drs. H. Ahmad Fauzi, M.Si.',
    status: 'ACTIVE',
    is_demo: 0,
  });

  // CSV Import State
  const [csvPreviewRows, setCsvPreviewRows] = useState<any[]>([]);
  const [csvImportResult, setCsvImportResult] = useState<any>(null);

  // =========================================================================
  // G.3: MANAJEMEN AKUN GURU & PENUGASAN
  // =========================================================================
  const [adminTeachers, setAdminTeachers] = useState<any[]>([]);
  const [teacherFilterRole, setTeacherFilterRole] = useState<string>('ALL');
  const [teacherModalOpen, setTeacherModalOpen] = useState(false);
  const [teacherForm, setTeacherForm] = useState<any>({
    id: '',
    nip: '',
    name: '',
    password: '123',
    subject: 'Pendidikan Karakter',
    assignment_type: 'WALAS' as TeacherAssignmentType,
    class_name: 'XI-MIPA-1',
    rombel_name: 'Rombel B',
    status: 'ACTIVE',
    is_demo: 0,
  });

  // =========================================================================
  // G.4 & G.5: MANAJEMEN KELAS & ROMBEL + PEMINDAHAN TERPISAH
  // =========================================================================
  const [classesRombelsData, setClassesRombelsData] = useState<{
    classes: any[];
    rombels: any[];
    cohorts: any[];
    classHistory: any[];
    rombelHistory: any[];
  }>({
    classes: [],
    rombels: [],
    cohorts: [],
    classHistory: [],
    rombelHistory: [],
  });
  const [newClassForm, setNewClassForm] = useState({
    name: '',
    cohort_name: '2025/2026',
    walas_teacher_id: 'guru',
    walas_name: 'Ibu Dra. Hj. Siti Aminah, M.Pd.',
  });
  const [newRombelForm, setNewRombelForm] = useState({
    name: '',
    cohort_name: '2025/2026',
    wali_teacher_id: 'guruwali',
    wali_name: 'Bapak Drs. H. Ahmad Fauzi, M.Si.',
    description: 'Rombel Pendampingan Akademik & Karakter',
  });
  const [moveGroupForm, setMoveGroupForm] = useState({
    student_id: '',
    target_type: 'CLASS' as 'CLASS' | 'ROMBEL',
    new_group_name: 'XI-MIPA-1',
  });

  // =========================================================================
  // G.6: DATABASE NILAI & JURNAL 14 HARI + KOREKSI TERKONTROL
  // =========================================================================
  const [journals, setJournals] = useState<any[]>([]);
  const [correctionsHistory, setCorrectionsHistory] = useState<any[]>([]);
  const [jFilterFrom, setJFilterFrom] = useState('');
  const [jFilterTo, setJFilterTo] = useState('');
  const [jFilterClass, setJFilterClass] = useState('');
  const [jFilterRombel, setJFilterRombel] = useState('');
  const [jFilterHabit, setJFilterHabit] = useState('');
  const [editingJournal, setEditingJournal] = useState<any | null>(null);
  const [newJournalScore, setNewJournalScore] = useState<number>(100);
  const [correctionReason, setCorrectionReason] = useState<string>('');

  // =========================================================================
  // G.7 & G.8: EDITOR KOMPONEN DASHBOARD & PENGATURAN GLOBAL
  // =========================================================================
  const [widgets, setWidgets] = useState<DashboardWidgetConfig[]>([]);
  const [globalSettings, setGlobalSettings] = useState<Record<string, string>>({
    school_name: 'SMAN 28 Jakarta',
    site_title: 'VERTIKAL SMA JAWARA 28',
    academic_year: '2025/2026',
    schedule_subuh: '04:00',
    schedule_zuhur: '11:40',
    schedule_asar: '14:55',
    schedule_maghrib: '17:50',
    schedule_isya: '19:05',
  });

  // Load all Control Panel data
  const loadControlPanelData = async () => {
    try {
      const [ov, stList, tcList, crData, jData, wData, gSettings] = await Promise.all([
        api.getAdminOverview(),
        api.getAdminStudents(),
        api.getAdminTeachers(),
        api.getAdminClassesRombels(),
        api.getAdminJournals({}),
        api.getDashboardWidgets(),
        api.getGlobalSettings(),
      ]);
      setOverviewData(ov);
      if (stList?.students) setAdminStudents(stList.students);
      if (tcList?.teachers) setAdminTeachers(tcList.teachers);
      if (crData) setClassesRombelsData(crData);
      if (jData?.journals) setJournals(jData.journals);
      if (jData?.corrections) setCorrectionsHistory(jData.corrections);
      if (wData?.widgets) setWidgets(wData.widgets);
      if (gSettings?.settings) {
        setGlobalSettings((prev) => ({ ...prev, ...gSettings.settings }));
      }
    } catch (e) {
      console.error('Error loading Control Panel Admin data:', e);
    }
  };

  useEffect(() => {
    loadControlPanelData();
  }, []);

  // Handlers for G.2 Student Management
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.saveAdminStudent(studentForm);
      setStudentModalOpen(false);
      showToast('Data akun siswa berhasil disimpan!');
      await loadControlPanelData();
      onRefreshStudents?.();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan akun siswa');
    }
  };

  // CSV Parser for Import Students (G.9)
  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result || '');
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length < 2) return;
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const rows = lines.slice(1).map((line) => {
        const cols = line.split(',').map((c) => c.trim());
        const obj: any = {};
        headers.forEach((h, idx) => {
          obj[h] = cols[idx] || '';
        });
        return {
          id: obj.id || obj.username || obj.nisn,
          nisn: obj.nisn || '',
          name: obj.name || obj.nama || '',
          gender: obj.gender || obj.jk || 'L',
          religion: obj.religion || obj.agama || 'Islam',
          class_name: obj.class_name || obj.kelas || 'XI-MIPA-1',
          rombel_name: obj.rombel_name || obj.rombel || 'Rombel B',
          angkatan: obj.angkatan || '2025/2026',
          password: obj.password || '123',
        };
      });
      setCsvPreviewRows(rows);
    };
    reader.readAsText(file);
  };

  const handleConfirmCsvImport = async () => {
    if (csvPreviewRows.length === 0) return;
    try {
      const res = await api.importAdminStudents(csvPreviewRows, admin.name);
      setCsvImportResult(res);
      setCsvPreviewRows([]);
      showToast(`Impor selesai: ${res.importedCount} akun berhasil diimpor!`);
      await loadControlPanelData();
      onRefreshStudents?.();
    } catch (err: any) {
      alert(err.message || 'Gagal mengimpor CSV');
    }
  };

  // Export CSV helper
  const exportToCsv = (filename: string, headers: string[], rows: any[][]) => {
    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handlers for G.3 Teacher Management
  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.saveAdminTeacher(teacherForm);
      setTeacherModalOpen(false);
      showToast('Data akun guru & penugasan berhasil disimpan!');
      await loadControlPanelData();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan akun guru');
    }
  };

  // Handlers for G.4 & G.5 Class & Rombel Management
  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassForm.name.trim()) return;
    try {
      await api.saveAdminClass(newClassForm);
      setNewClassForm({ ...newClassForm, name: '' });
      showToast('Data Kelas berhasil disimpan!');
      await loadControlPanelData();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan kelas');
    }
  };

  const handleSaveRombel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRombelForm.name.trim()) return;
    try {
      await api.saveAdminRombel(newRombelForm);
      setNewRombelForm({ ...newRombelForm, name: '' });
      showToast('Data Rombel berhasil disimpan!');
      await loadControlPanelData();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan rombel');
    }
  };

  const handleMoveStudentGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveGroupForm.student_id || !moveGroupForm.new_group_name) return;
    try {
      await api.moveStudentGroup({
        ...moveGroupForm,
        actor_name: admin.name,
      });
      showToast(
        `Siswa berhasil dipindahkan ke ${moveGroupForm.target_type === 'CLASS' ? 'Kelas' : 'Rombel'} ${moveGroupForm.new_group_name}!`
      );
      await loadControlPanelData();
      onRefreshStudents?.();
    } catch (err: any) {
      alert(err.message || 'Gagal memindahkan siswa');
    }
  };

  // Handlers for G.6 Journal Filter & Controlled Correction
  const handleFilterJournals = async () => {
    try {
      const res = await api.getAdminJournals({
        date_from: jFilterFrom || undefined,
        date_to: jFilterTo || undefined,
        class_name: jFilterClass || undefined,
        rombel_name: jFilterRombel || undefined,
        habit_type: jFilterHabit || undefined,
      });
      if (res?.journals) setJournals(res.journals);
      if (res?.corrections) setCorrectionsHistory(res.corrections);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCorrectJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJournal || !correctionReason.trim()) return;
    try {
      await api.correctAdminJournal({
        log_id: editingJournal.id,
        new_score: Number(newJournalScore),
        reason: correctionReason.trim(),
        corrected_by: `${admin.name} (Control Panel Admin)`,
      });
      setEditingJournal(null);
      setCorrectionReason('');
      showToast('Koreksi nilai jurnal berhasil disimpan beserta audit log!');
      await handleFilterJournals();
      await loadControlPanelData();
      onRefreshStudents?.();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan koreksi');
    }
  };

  // Handlers for G.7 & G.8 Widgets & Global Settings
  const handleUpdateWidget = async (w: DashboardWidgetConfig) => {
    try {
      await api.saveDashboardWidget(w);
      showToast(`Konfigurasi widget "${w.title}" berhasil disimpan!`);
      await loadControlPanelData();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan widget');
    }
  };

  const handleSaveGlobalSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.saveGlobalSettings({
        settings: globalSettings,
        actor_name: admin.name,
      });
      showToast('Pengaturan global & jadwal ibadah berhasil disimpan!');
      await loadControlPanelData();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan pengaturan global');
    }
  };

  const filteredStudentsList = adminStudents.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.nisn.includes(studentSearch) ||
      s.id.toLowerCase().includes(studentSearch.toLowerCase());
    const matchClass = filterClass === 'ALL' || s.class_name === filterClass;
    const matchRombel = filterRombel === 'ALL' || (s.rombel_name || 'Rombel B') === filterRombel;
    const matchAngkatan = filterAngkatan === 'ALL' || s.angkatan === filterAngkatan;
    const matchStatus = filterStatus === 'ALL' || (s.status || 'ACTIVE') === filterStatus;
    const matchDemo =
      filterDemo === 'ALL' ||
      (filterDemo === 'DEMO' ? s.is_demo === 1 : !s.is_demo || s.is_demo === 0);
    return matchSearch && matchClass && matchRombel && matchAngkatan && matchStatus && matchDemo;
  });

  return (
    <div className="min-h-screen bg-kebaya-pattern flex flex-col pb-12">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl shadow-lg border border-slate-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#1c5ddc] to-[#19ae5d] text-white flex items-center justify-center font-black text-sm shadow-sm">
            28
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base tracking-tight">
                CONTROL PANEL ADMIN • JAWARA 28
              </span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-black">
                /admin
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Manajemen Sistem, Akun Siswa &amp; Guru, Kelas, Rombel, Database Jurnal 14 Hari &amp; Editor Widget
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-xs font-bold text-white block">{admin.name}</span>
            <span className="text-[10px] text-slate-400">Control Panel Administrator</span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Keluar (/admin)
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1">
        {/* Control Panel Navigation Bar */}
        <div className="bg-white rounded-3xl p-3 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {[
              { id: 'overview' as const, label: 'Ringkasan Sistem', icon: ShieldCheck },
              { id: 'students' as const, label: 'Manajemen Siswa & CSV', icon: Users },
              { id: 'teachers' as const, label: 'Manajemen Guru', icon: UserCheck },
              { id: 'classes_rombels' as const, label: 'Kelas & Rombel', icon: Layers },
              { id: 'journals' as const, label: 'Database Jurnal 14 Hari', icon: Database },
              { id: 'widgets_settings' as const, label: 'Editor Widget & Pengaturan', icon: LayoutDashboard },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={loadControlPanelData}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sinkronkan Data</span>
          </button>
        </div>

        {/* ===================================================================
            TAB 1: RINGKASAN SISTEM (G.1)
        =================================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
                <span className="text-xs font-bold text-slate-500 block">Total Akun Siswa</span>
                <span className="text-3xl font-black text-slate-900 block mt-1">
                  {overviewData?.totalStudents ?? adminStudents.length}
                </span>
                <span className="text-[11px] text-emerald-700 font-semibold">
                  Aktif: {overviewData?.activeStudents ?? 0} • Demo: {overviewData?.demoStudents ?? 0}
                </span>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
                <span className="text-xs font-bold text-slate-500 block">Total Akun Guru &amp; Admin</span>
                <span className="text-3xl font-black text-[#1c5ddc] block mt-1">
                  {(overviewData?.totalTeachers ?? 0) + (overviewData?.totalAdmins ?? 1)}
                </span>
                <span className="text-[11px] text-blue-700 font-semibold">
                  Guru Walas, Guru Wali &amp; Tim 7 KAIH
                </span>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
                <span className="text-xs font-bold text-slate-500 block">Kelas &amp; Rombel Aktif</span>
                <span className="text-3xl font-black text-purple-800 block mt-1">
                  {overviewData?.totalClasses ?? 4} Kelas / {overviewData?.totalRombels ?? 3} Rombel
                </span>
                <span className="text-[11px] text-purple-700 font-semibold">
                  Struktur Kelas &amp; Rombel Terpisah
                </span>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
                <span className="text-xs font-bold text-slate-500 block">Total Entri Jurnal 7 KAIH</span>
                <span className="text-3xl font-black text-[#19ae5d] block mt-1">
                  {overviewData?.totalLogs ?? 0}
                </span>
                <span className="text-[11px] text-emerald-700 font-semibold">
                  Hari ini: {overviewData?.todayLogs ?? 0} entri • Koreksi: {overviewData?.totalCorrections ?? 0}
                </span>
              </div>
            </div>

            {/* Audit Log Perubahan Terakhir */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-slate-700" />
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">
                      Log Aktivitas &amp; Perubahan Sistem Terakhir (Audit Log)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Rekam jejak pembuatan akun, pemindahan kelas/rombel, koreksi nilai, dan perubahan pengaturan
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">Waktu</th>
                      <th className="py-2.5 px-4">Aktor</th>
                      <th className="py-2.5 px-4">Aksi</th>
                      <th className="py-2.5 px-4">Target</th>
                      <th className="py-2.5 px-4">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(overviewData?.recentAudit || []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400">
                          Belum ada aktivitas perubahan baru.
                        </td>
                      </tr>
                    ) : (
                      (overviewData?.recentAudit || []).map((a: any) => (
                        <tr key={a.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-mono text-slate-500">{a.created_at}</td>
                          <td className="py-2.5 px-4 font-bold text-slate-900">{a.actor_name}</td>
                          <td className="py-2.5 px-4">
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 font-bold text-[10px]">
                              {a.action_type}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-600">
                            {a.target_table} ({a.target_id})
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 truncate max-w-xs">
                            {a.details_json}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 2: MANAJEMEN AKUN SISWA & IMPORT/EXPORT CSV (G.2 & G.9)
        =================================================================== */}
        {activeTab === 'students' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Manajemen Akun Siswa SMAN 28 Jakarta
                  </h3>
                  <p className="text-xs text-slate-500">
                    Kelola akun siswa nyata maupun akun demo, atur Kelas, Rombel, Angkatan, Agama, serta Impor/Ekspor CSV
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStudentForm({
                        id: '',
                        nisn: '',
                        name: '',
                        password: '123',
                        gender: 'L',
                        religion: 'Islam',
                        class_name: 'XI-MIPA-1',
                        rombel_name: 'Rombel A',
                        angkatan: '2025/2026',
                        walas_name: 'Ibu Dra. Hj. Siti Aminah, M.Pd.',
                        walas_nip: '197504122000122002',
                        wali_name: 'Bapak Drs. H. Ahmad Fauzi, M.Si.',
                        status: 'ACTIVE',
                        is_demo: 0,
                      });
                      setStudentModalOpen(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#1c5ddc] hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Akun Siswa</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      exportToCsv(
                        'daftar_siswa_jawara28.csv',
                        [
                          'id',
                          'nisn',
                          'name',
                          'gender',
                          'religion',
                          'class_name',
                          'rombel_name',
                          'angkatan',
                          'status',
                          'avg_score',
                          'poin_hebat',
                        ],
                        filteredStudentsList.map((s) => [
                          s.id,
                          s.nisn,
                          s.name,
                          s.gender,
                          s.religion,
                          s.class_name,
                          s.rombel_name || 'Rombel B',
                          s.angkatan,
                          s.status || 'ACTIVE',
                          s.avg_score || 0,
                          s.poin_hebat || 0,
                        ])
                      )
                    }
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Ekspor Siswa (CSV)</span>
                  </button>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2">
                <div className="relative col-span-2 sm:col-span-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Cari nama/NISN..."
                    className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <select
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="ALL">Semua Kelas</option>
                  {classesRombelsData.classes.map((c: any) => (
                    <option key={c.name} value={c.name}>
                      Kelas {c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={filterRombel}
                  onChange={(e) => setFilterRombel(e.target.value)}
                  className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="ALL">Semua Rombel</option>
                  {classesRombelsData.rombels.map((r: any) => (
                    <option key={r.name} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <select
                  value={filterAngkatan}
                  onChange={(e) => setFilterAngkatan(e.target.value)}
                  className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="ALL">Semua Angkatan</option>
                  <option value="2024/2025">2024/2025</option>
                  <option value="2025/2026">2025/2026</option>
                  <option value="2026/2027">2026/2027</option>
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="ALL">Semua Status</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
                <select
                  value={filterDemo}
                  onChange={(e) => setFilterDemo(e.target.value)}
                  className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="ALL">Semua Jenis Akun</option>
                  <option value="REAL">Akun Siswa Nyata</option>
                  <option value="DEMO">Akun Demo</option>
                </select>
              </div>

              {/* CSV Import Box (G.9) */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-extrabold text-slate-800">
                      Impor Akun Siswa dari CSV (Kolom: nisn, name, gender, religion, class_name, rombel_name, angkatan)
                    </span>
                  </div>
                  <label className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer inline-flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Pilih File CSV</span>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleCsvFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {csvPreviewRows.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-800">
                        Pratinjau Impor: {csvPreviewRows.length} baris siap divalidasi &amp; diimpor
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setCsvPreviewRows([])}
                          className="px-3 py-1 rounded-lg border border-slate-300 text-xs font-bold"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={handleConfirmCsvImport}
                          className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                        >
                          Konfirmasi Impor ({csvPreviewRows.length} Siswa)
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {csvImportResult && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                    Hasil Impor: <strong>{csvImportResult.importedCount}</strong> berhasil diimpor,{' '}
                    <strong>{csvImportResult.skippedCount}</strong> dilewati (duplikat/tidak valid).
                  </div>
                )}
              </div>

              {/* Students Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3">Username / ID</th>
                      <th className="py-3 px-3">Nama Siswa</th>
                      <th className="py-3 px-3">NISN</th>
                      <th className="py-3 px-3">Kelas</th>
                      <th className="py-3 px-3">Rombel</th>
                      <th className="py-3 px-3">Agama / JK</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-3 text-right">Capaian / Poin Hebat</th>
                      <th className="py-3 px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudentsList.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                          {s.id}
                          {s.is_demo === 1 && (
                            <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                              DEMO
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{s.name}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{s.nisn}</td>
                        <td className="py-2.5 px-3 font-bold text-[#1c5ddc]">{s.class_name}</td>
                        <td className="py-2.5 px-3 font-bold text-purple-800">
                          {s.rombel_name || 'Rombel B'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {s.religion} ({s.gender})
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              (s.status || 'ACTIVE') === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {s.status || 'ACTIVE'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold">
                          <span className="text-[#1c5ddc]">
                            {s.avg_score ? s.avg_score.toFixed(1) : '0'}/100
                          </span>{' '}
                          • <span className="text-emerald-700">+{s.poin_hebat || 0}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setStudentForm({
                                  id: s.id,
                                  nisn: s.nisn,
                                  name: s.name,
                                  password: '',
                                  gender: s.gender || 'L',
                                  religion: s.religion || 'Islam',
                                  class_name: s.class_name,
                                  rombel_name: s.rombel_name || 'Rombel B',
                                  angkatan: s.angkatan || '2025/2026',
                                  walas_name: s.walas_name,
                                  walas_nip: s.walas_nip,
                                  wali_name: s.wali_name || 'Bapak Drs. H. Ahmad Fauzi, M.Si.',
                                  status: s.status || 'ACTIVE',
                                  is_demo: s.is_demo || 0,
                                });
                                setStudentModalOpen(true);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedStudentForReport(s.id)}
                              className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#1c5ddc] font-bold text-[11px] cursor-pointer"
                            >
                              Rapor
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 3: MANAJEMEN AKUN GURU & PENUGASAN (G.3)
        =================================================================== */}
        {activeTab === 'teachers' && (
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Manajemen Akun Guru &amp; Penugasan (Guru Walas, Guru Wali, Guru Tim 7 KAIH)
                </h3>
                <p className="text-xs text-slate-500">
                  Atur penugasan guru ke Kelas (WALAS), ke Rombel (WALI), atau Operasional Sekolah (TIM_7_KAIH)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={teacherFilterRole}
                  onChange={(e) => setTeacherFilterRole(e.target.value)}
                  className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="ALL">Semua Penugasan</option>
                  <option value="WALAS">Guru Walas (WALAS)</option>
                  <option value="WALI">Guru Wali Rombel (WALI)</option>
                  <option value="TIM_7_KAIH">Guru Tim 7 KAIH (TIM_7_KAIH)</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setTeacherForm({
                      id: '',
                      nip: '',
                      name: '',
                      password: '123',
                      subject: 'Pendidikan Karakter',
                      assignment_type: 'WALAS',
                      class_name: 'XI-MIPA-1',
                      rombel_name: 'Rombel B',
                      status: 'ACTIVE',
                      is_demo: 0,
                    });
                    setTeacherModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#19ae5d] hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Akun Guru</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Username / ID</th>
                    <th className="py-3 px-4">Nama Guru</th>
                    <th className="py-3 px-4">NIP</th>
                    <th className="py-3 px-4">Mata Pelajaran</th>
                    <th className="py-3 px-4">Jenis Penugasan</th>
                    <th className="py-3 px-4">Unit Binaan (Kelas / Rombel)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adminTeachers
                    .filter(
                      (t) =>
                        teacherFilterRole === 'ALL' ||
                        (t.assignment_type || 'WALAS') === teacherFilterRole
                    )
                    .map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-mono font-bold">{t.id}</td>
                        <td className="py-2.5 px-4 font-bold text-slate-900">{t.name}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-600">{t.nip}</td>
                        <td className="py-2.5 px-4 text-slate-600">{t.subject}</td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                              t.assignment_type === 'TIM_7_KAIH'
                                ? 'bg-indigo-100 text-[#0000fe]'
                                : t.assignment_type === 'WALI'
                                ? 'bg-purple-100 text-purple-900'
                                : 'bg-emerald-100 text-emerald-900'
                            }`}
                          >
                            {t.assignment_type || 'WALAS'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-bold">
                          {t.assignment_type === 'WALAS'
                            ? `Kelas ${t.class_name}`
                            : t.assignment_type === 'WALI'
                            ? t.rombel_name || 'Rombel B'
                            : 'Seluruh Sekolah (7 KAIH)'}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                            {t.status || 'ACTIVE'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setTeacherForm({
                                id: t.id,
                                nip: t.nip,
                                name: t.name,
                                password: '',
                                subject: t.subject,
                                assignment_type: t.assignment_type || 'WALAS',
                                class_name: t.class_name || 'XI-MIPA-1',
                                rombel_name: t.rombel_name || 'Rombel B',
                                status: t.status || 'ACTIVE',
                                is_demo: t.is_demo || 0,
                              });
                              setTeacherModalOpen(true);
                            }}
                            className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-800 cursor-pointer"
                          >
                            Edit Penugasan
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 4: MANAJEMEN KELAS & ROMBEL TERPISAH (G.4 & G.5)
        =================================================================== */}
        {activeTab === 'classes_rombels' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Panel Kelas (Guru Walas) */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#1c5ddc]" />
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">
                      Manajemen Kelas &amp; Guru Walas (G.4)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Kelas tempat siswa belajar sehari-hari dan dipantau keterisiannya oleh Guru Walas
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveClass} className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <input
                    type="text"
                    value={newClassForm.name}
                    onChange={(e) => setNewClassForm({ ...newClassForm, name: e.target.value })}
                    placeholder="Nama Kelas (mis. XI-MIPA-4)"
                    className="px-3 py-2 rounded-xl border border-slate-200 font-bold"
                    required
                  />
                  <input
                    type="text"
                    value={newClassForm.walas_name}
                    onChange={(e) =>
                      setNewClassForm({ ...newClassForm, walas_name: e.target.value })
                    }
                    placeholder="Nama Guru Walas"
                    className="px-3 py-2 rounded-xl border border-slate-200"
                    required
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-xl bg-[#1c5ddc] text-white font-bold cursor-pointer"
                  >
                    + Simpan Kelas
                  </button>
                </form>

                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Kelas</th>
                        <th className="py-2.5 px-3">Angkatan</th>
                        <th className="py-2.5 px-3">Guru Walas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {classesRombelsData.classes.map((c: any) => (
                        <tr key={c.id}>
                          <td className="py-2.5 px-3 font-bold text-[#1c5ddc]">{c.name}</td>
                          <td className="py-2.5 px-3 text-slate-600">{c.cohort_name}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {c.walas_name}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Panel Rombel (Guru Wali) */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-purple-600" />
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">
                      Manajemen Rombel &amp; Guru Wali (G.5)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Kelompok rombongan belajar lintas kelas yang dianalisis capaiannya oleh Guru Wali
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveRombel} className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <input
                    type="text"
                    value={newRombelForm.name}
                    onChange={(e) => setNewRombelForm({ ...newRombelForm, name: e.target.value })}
                    placeholder="Nama Rombel (mis. Rombel D)"
                    className="px-3 py-2 rounded-xl border border-slate-200 font-bold"
                    required
                  />
                  <input
                    type="text"
                    value={newRombelForm.wali_name}
                    onChange={(e) =>
                      setNewRombelForm({ ...newRombelForm, wali_name: e.target.value })
                    }
                    placeholder="Nama Guru Wali"
                    className="px-3 py-2 rounded-xl border border-slate-200"
                    required
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-xl bg-purple-600 text-white font-bold cursor-pointer"
                  >
                    + Simpan Rombel
                  </button>
                </form>

                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Rombel</th>
                        <th className="py-2.5 px-3">Angkatan</th>
                        <th className="py-2.5 px-3">Guru Wali</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {classesRombelsData.rombels.map((r: any) => (
                        <tr key={r.id}>
                          <td className="py-2.5 px-3 font-bold text-purple-800">{r.name}</td>
                          <td className="py-2.5 px-3 text-slate-600">{r.cohort_name}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {r.wali_name}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Pemindahan Kelas atau Rombel Secara Independen Tanpa Merusak Riwayat */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
              <h3 className="font-extrabold text-slate-900 text-base">
                Pindahkan Siswa Antar Kelas atau Antar Rombel (Menyimpan Riwayat Keanggotaan)
              </h3>
              <form
                onSubmit={handleMoveStudentGroup}
                className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs items-end"
              >
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Pilih Siswa:</label>
                  <select
                    value={moveGroupForm.student_id}
                    onChange={(e) =>
                      setMoveGroupForm({ ...moveGroupForm, student_id: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                    required
                  >
                    <option value="">-- Pilih Siswa --</option>
                    {adminStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.class_name} • {s.rombel_name || 'Rombel B'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Jenis Pemindahan:
                  </label>
                  <select
                    value={moveGroupForm.target_type}
                    onChange={(e) =>
                      setMoveGroupForm({
                        ...moveGroupForm,
                        target_type: e.target.value as 'CLASS' | 'ROMBEL',
                        new_group_name:
                          e.target.value === 'CLASS' ? 'XI-MIPA-1' : 'Rombel A',
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  >
                    <option value="CLASS">Pindah Kelas (Tidak Mengubah Rombel)</option>
                    <option value="ROMBEL">Pindah Rombel (Tidak Mengubah Kelas)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Target {moveGroupForm.target_type === 'CLASS' ? 'Kelas Baru' : 'Rombel Baru'}:
                  </label>
                  <input
                    type="text"
                    value={moveGroupForm.new_group_name}
                    onChange={(e) =>
                      setMoveGroupForm({ ...moveGroupForm, new_group_name: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
                >
                  Simpan Pemindahan
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 5: DATABASE NILAI & JURNAL 14 HARI + KOREKSI TERKONTROL (G.6)
        =================================================================== */}
        {activeTab === 'journals' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Database Nilai &amp; Jurnal 14 Hari + Koreksi Terkontrol (G.6)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Lihat rincian skor dasar, bonus, nilai akhir, dan koreksi nilai dengan catatan alasan audit wajib
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    exportToCsv(
                      'jurnal_14_hari_jawara28.csv',
                      [
                        'id',
                        'log_date',
                        'student_name',
                        'nisn',
                        'class_name',
                        'rombel_name',
                        'habit_type',
                        'sub_category',
                        'score',
                        'timestamp',
                      ],
                      journals.map((j) => [
                        j.id,
                        j.log_date,
                        j.student_name,
                        j.nisn,
                        j.class_name,
                        j.rombel_name || 'Rombel B',
                        j.habit_type,
                        j.sub_category || '',
                        j.score,
                        j.timestamp,
                      ])
                    )
                  }
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer self-start"
                >
                  <Download className="w-4 h-4" />
                  <span>Ekspor Jurnal (CSV)</span>
                </button>
              </div>

              {/* Filter Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                <input
                  type="date"
                  value={jFilterFrom}
                  onChange={(e) => setJFilterFrom(e.target.value)}
                  className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
                <input
                  type="date"
                  value={jFilterTo}
                  onChange={(e) => setJFilterTo(e.target.value)}
                  className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
                <select
                  value={jFilterClass}
                  onChange={(e) => setJFilterClass(e.target.value)}
                  className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="">Semua Kelas</option>
                  {classesRombelsData.classes.map((c: any) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={jFilterRombel}
                  onChange={(e) => setJFilterRombel(e.target.value)}
                  className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="">Semua Rombel</option>
                  {classesRombelsData.rombels.map((r: any) => (
                    <option key={r.name} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <select
                  value={jFilterHabit}
                  onChange={(e) => setJFilterHabit(e.target.value)}
                  className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="">Semua Kebiasaan</option>
                  <option value="bangun">Bangun Pagi</option>
                  <option value="ibadah">Beribadah</option>
                  <option value="olahraga">Berolahraga</option>
                  <option value="makan">Makan Bergizi</option>
                  <option value="belajar">Gemar Belajar</option>
                  <option value="masyarakat">Bermasyarakat</option>
                  <option value="tidur">Tidur Cepat</option>
                </select>
                <button
                  type="button"
                  onClick={handleFilterJournals}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
                >
                  Terapkan Filter
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">ID</th>
                      <th className="py-2.5 px-3">Tanggal Jurnal</th>
                      <th className="py-2.5 px-3">Siswa</th>
                      <th className="py-2.5 px-3">Kelas / Rombel</th>
                      <th className="py-2.5 px-3">Kebiasaan &amp; Sesi</th>
                      <th className="py-2.5 px-3 text-right">Nilai Capaian</th>
                      <th className="py-2.5 px-3 text-center">Aksi Koreksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {journals.slice(0, 60).map((j) => (
                      <tr key={j.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono text-slate-400">#{j.id}</td>
                        <td className="py-2.5 px-3 font-mono font-bold">{j.log_date}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{j.student_name}</td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {j.class_name} • {j.rombel_name || 'Rombel B'}
                        </td>
                        <td className="py-2.5 px-3 uppercase font-bold text-indigo-700">
                          {j.habit_type} {j.sub_category ? `(${j.sub_category})` : ''}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-emerald-700">
                          {j.score} / 100
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingJournal(j);
                              setNewJournalScore(j.score);
                              setCorrectionReason('');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[11px] cursor-pointer inline-flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" /> Koreksi Nilai
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Riwayat Koreksi Data (Audit Trail) */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-3">
              <h4 className="font-extrabold text-slate-900 text-sm">
                Riwayat Koreksi Nilai Terkontrol (Audit Trail `data_corrections`)
              </h4>
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Waktu</th>
                      <th className="py-2.5 px-3">Siswa</th>
                      <th className="py-2.5 px-3">Tanggal Jurnal</th>
                      <th className="py-2.5 px-3">Kebiasaan</th>
                      <th className="py-2.5 px-3">Sebelum → Sesudah</th>
                      <th className="py-2.5 px-3">Alasan Koreksi</th>
                      <th className="py-2.5 px-3">Dikoreksi Oleh</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {correctionsHistory.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-4 text-center text-slate-400">
                          Belum ada riwayat koreksi nilai.
                        </td>
                      </tr>
                    ) : (
                      correctionsHistory.map((c: any) => (
                        <tr key={c.id}>
                          <td className="py-2.5 px-3 font-mono text-slate-500">{c.created_at}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {c.student_name || c.student_id}
                          </td>
                          <td className="py-2.5 px-3 font-mono">{c.log_date}</td>
                          <td className="py-2.5 px-3 uppercase font-bold">{c.habit_type}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-700">
                            {c.before_json} → {c.after_json}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">{c.reason}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {c.corrected_by}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 6: EDITOR KOMPONEN DASHBOARD & PENGATURAN GLOBAL (G.7 & G.8)
        =================================================================== */}
        {activeTab === 'widgets_settings' && (
          <div className="space-y-6">
            {/* G.7: Editor Komponen & Grafik Dashboard */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Editor Komponen &amp; Grafik Dashboard (G.7)
                </h3>
                <p className="text-xs text-slate-500">
                  Atur visibilitas, judul, urutan tampil, dan jenis visualisasi (Radar, Gauge, Bar, Line, Card) untuk setiap halaman dashboard
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {widgets.map((w) => (
                  <div
                    key={w.id}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                        Target: {w.dashboard_target}
                      </span>
                      <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={w.is_visible === 1}
                          onChange={(e) =>
                            handleUpdateWidget({
                              ...w,
                              is_visible: e.target.checked ? 1 : 0,
                            })
                          }
                          className="w-4 h-4 rounded text-emerald-600"
                        />
                        <span>Tampilkan Widget</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">
                          Judul Widget
                        </label>
                        <input
                          type="text"
                          value={w.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setWidgets((prev) =>
                              prev.map((item) => (item.id === w.id ? { ...item, title: val } : item))
                            );
                          }}
                          onBlur={() => handleUpdateWidget(w)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">
                          Tipe Grafik
                        </label>
                        <select
                          value={w.chart_type}
                          onChange={(e) =>
                            handleUpdateWidget({
                              ...w,
                              chart_type: e.target.value as any,
                            })
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-bold"
                        >
                          <option value="RADAR">RADAR</option>
                          <option value="GAUGE">GAUGE</option>
                          <option value="BAR">BAR</option>
                          <option value="LINE">LINE</option>
                          <option value="CARD">CARD</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* G.8: Pengaturan Global & Jadwal Ibadah */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#1c5ddc]" />
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Pengaturan Global Aplikasi &amp; Jadwal Ibadah (G.8)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Konfigurasi identitas sekolah, tahun ajaran aktif, dan jadwal waktu shalat wajib
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveGlobalSettings} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nama Sekolah</label>
                    <input
                      type="text"
                      value={globalSettings.school_name || ''}
                      onChange={(e) =>
                        setGlobalSettings({ ...globalSettings, school_name: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Judul Situs</label>
                    <input
                      type="text"
                      value={globalSettings.site_title || ''}
                      onChange={(e) =>
                        setGlobalSettings({ ...globalSettings, site_title: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tahun Ajaran Aktif</label>
                    <input
                      type="text"
                      value={globalSettings.academic_year || ''}
                      onChange={(e) =>
                        setGlobalSettings({ ...globalSettings, academic_year: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
                  {[
                    { key: 'schedule_subuh', label: 'Jadwal Subuh' },
                    { key: 'schedule_zuhur', label: 'Jadwal Zuhur' },
                    { key: 'schedule_asar', label: 'Jadwal Asar' },
                    { key: 'schedule_maghrib', label: 'Jadwal Maghrib' },
                    { key: 'schedule_isya', label: 'Jadwal Isya' },
                  ].map((item) => (
                    <div key={item.key}>
                      <label className="block font-bold text-slate-700 mb-1">{item.label}</label>
                      <input
                        type="time"
                        value={globalSettings[item.key] || ''}
                        onChange={(e) =>
                          setGlobalSettings({ ...globalSettings, [item.key]: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
                  >
                    Simpan Pengaturan Global
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Modal Tambah/Edit Akun Siswa */}
      {studentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h4 className="font-extrabold text-slate-900 text-base">
              Formulir Akun Siswa (Kelas &amp; Rombel Terpisah)
            </h4>
            <form onSubmit={handleSaveStudent} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Username / ID</label>
                  <input
                    type="text"
                    value={studentForm.id}
                    onChange={(e) => setStudentForm({ ...studentForm, id: e.target.value })}
                    placeholder="Kosongkan untuk otomatis"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">NISN (Wajib)</label>
                  <input
                    type="text"
                    value={studentForm.nisn}
                    onChange={(e) => setStudentForm({ ...studentForm, nisn: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap Siswa</label>
                <input
                  type="text"
                  value={studentForm.name}
                  onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jenis Kelamin</label>
                  <select
                    value={studentForm.gender}
                    onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Agama</label>
                  <select
                    value={studentForm.religion}
                    onChange={(e) => setStudentForm({ ...studentForm, religion: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  >
                    <option value="Islam">Islam</option>
                    <option value="Kristen">Kristen</option>
                    <option value="Katolik">Katolik</option>
                    <option value="Hindu">Hindu</option>
                    <option value="Buddha">Buddha</option>
                    <option value="Konghucu">Konghucu</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status Akun</label>
                  <select
                    value={studentForm.status}
                    onChange={(e) => setStudentForm({ ...studentForm, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kelas (Guru Walas)</label>
                  <input
                    type="text"
                    value={studentForm.class_name}
                    onChange={(e) => setStudentForm({ ...studentForm, class_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Rombel (Guru Wali)</label>
                  <input
                    type="text"
                    value={studentForm.rombel_name}
                    onChange={(e) =>
                      setStudentForm({ ...studentForm, rombel_name: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Angkatan</label>
                  <input
                    type="text"
                    value={studentForm.angkatan}
                    onChange={(e) => setStudentForm({ ...studentForm, angkatan: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Password Baru (Kosongkan jika tidak diubah)
                </label>
                <input
                  type="password"
                  value={studentForm.password}
                  onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                  placeholder="Default: 123"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setStudentModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#1c5ddc] text-white font-bold cursor-pointer"
                >
                  Simpan Akun Siswa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah/Edit Akun Guru */}
      {teacherModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200 shadow-xl space-y-4">
            <h4 className="font-extrabold text-slate-900 text-base">
              Formulir Akun Guru &amp; Jenis Penugasan
            </h4>
            <form onSubmit={handleSaveTeacher} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Username / ID</label>
                  <input
                    type="text"
                    value={teacherForm.id}
                    onChange={(e) => setTeacherForm({ ...teacherForm, id: e.target.value })}
                    placeholder="Mis: guruwalas2"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">NIP</label>
                  <input
                    type="text"
                    value={teacherForm.nip}
                    onChange={(e) => setTeacherForm({ ...teacherForm, nip: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap Guru</label>
                <input
                  type="text"
                  value={teacherForm.name}
                  onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jenis Penugasan</label>
                  <select
                    value={teacherForm.assignment_type}
                    onChange={(e) =>
                      setTeacherForm({
                        ...teacherForm,
                        assignment_type: e.target.value as TeacherAssignmentType,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  >
                    <option value="WALAS">Guru Walas (Monitoring Kelas)</option>
                    <option value="WALI">Guru Wali (Analitik Rombel)</option>
                    <option value="TIM_7_KAIH">Guru Tim 7 KAIH (Operasional Sekolah)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mata Pelajaran</label>
                  <input
                    type="text"
                    value={teacherForm.subject}
                    onChange={(e) => setTeacherForm({ ...teacherForm, subject: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              {teacherForm.assignment_type === 'WALAS' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Kelas Binaan (Guru Walas)
                  </label>
                  <input
                    type="text"
                    value={teacherForm.class_name}
                    onChange={(e) => setTeacherForm({ ...teacherForm, class_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                    required
                  />
                </div>
              )}

              {teacherForm.assignment_type === 'WALI' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Rombel Binaan (Guru Wali)
                  </label>
                  <input
                    type="text"
                    value={teacherForm.rombel_name}
                    onChange={(e) =>
                      setTeacherForm({ ...teacherForm, rombel_name: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  value={teacherForm.password}
                  onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })}
                  placeholder="Default: 123"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setTeacherModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#19ae5d] text-white font-bold cursor-pointer"
                >
                  Simpan Akun Guru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Koreksi Nilai Jurnal */}
      {editingJournal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-xl space-y-4">
            <h4 className="font-extrabold text-slate-900 text-base">
              Koreksi Terkontrol Nilai Jurnal Siswa
            </h4>
            <p className="text-xs text-slate-600">
              Siswa: <strong>{editingJournal.student_name}</strong> • Tanggal:{' '}
              <strong>{editingJournal.log_date}</strong> • Kebiasaan:{' '}
              <strong className="uppercase">{editingJournal.habit_type}</strong>
            </p>
            <form onSubmit={handleCorrectJournal} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block">Nilai Sebelum:</span>
                  <span className="text-lg font-black text-slate-800">
                    {editingJournal.score} / 100
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                  <label className="text-blue-800 font-bold block mb-1">Nilai Sesudah (0-100):</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={newJournalScore}
                    onChange={(e) => setNewJournalScore(Number(e.target.value))}
                    className="w-full px-2 py-1 rounded bg-white border border-blue-300 font-black text-sm"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Alasan Koreksi (Wajib diisi untuk Audit):
                </label>
                <textarea
                  rows={3}
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="Tuliskan alasan perubahan nilai secara jelas..."
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingJournal(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold cursor-pointer"
                >
                  Simpan Koreksi Resmi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rapor Individual Modal */}
      {selectedStudentForReport && (
        <StudentReportModal
          studentId={selectedStudentForReport}
          canEditNotes={true}
          onClose={() => setSelectedStudentForReport(null)}
        />
      )}
    </div>
  );
};
