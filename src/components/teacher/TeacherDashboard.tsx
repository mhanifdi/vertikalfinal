/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  Award,
  CheckCircle2,
  Trophy,
  BarChart3,
  ChevronRight,
  AlertTriangle,
  Search,
  RefreshCw,
  Calendar,
  ShieldCheck,
  Building2,
  Layers,
  Clock,
  CheckCheck,
  Star,
  AlertCircle,
  Edit3,
  Settings,
} from 'lucide-react';
import {
  Teacher,
  Student,
  ClassAnalytics,
  RombelAnalytics,
  SchoolAnalytics,
  HabitStatus,
} from '../../types';
import { api } from '../../utils/api';
import { RadarChart } from '../charts/RadarChart';
import { GaugeChart } from '../charts/GaugeChart';
import { ScoreDistributionBar } from '../charts/ScoreDistributionBar';
import { LeaderboardTable } from '../common/LeaderboardTable';
import { StudentReportModal } from '../common/StudentReportModal';

interface TeacherDashboardProps {
  teacher: Teacher;
  allStudents: Student[];
  onLogout: () => void;
  onRefreshStudents?: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  teacher,
  allStudents,
  onLogout,
  onRefreshStudents,
}) => {
  // Determine teacher assignment role: WALAS | WALI | TIM_7_KAIH
  const assignmentType = teacher.assignment_type || 'WALAS';

  const [selectedStudentForReport, setSelectedStudentForReport] = useState<string | null>(null);
  const [searchStudent, setSearchStudent] = useState('');
  const [loading, setLoading] = useState(false);

  // =========================================================================
  // 1. STATE FOR GURU WALAS (Monitoring Keterisian Kelas)
  // =========================================================================
  const [walasDate, setWalasDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [walasStatusFilter, setWalasStatusFilter] = useState<'ALL' | HabitStatus>('ALL');
  const [walasTab, setWalasTab] = useState<'monitoring' | 'analitik' | 'leaderboard'>('monitoring');
  const [classData, setClassData] = useState<ClassAnalytics | null>(null);
  const [chartMode, setChartMode] = useState<'radar' | 'progress'>('radar');

  // =========================================================================
  // 2. STATE FOR GURU WALI (Analitik Rombel)
  // =========================================================================
  const assignedRombel = teacher.rombel_name || 'Rombel B';
  const [rombelDays, setRombelDays] = useState<number>(14);
  const [rombelHabitFilter, setRombelHabitFilter] = useState<string>('ALL');
  const [rombelStatusFilter, setRombelStatusFilter] = useState<'ALL' | HabitStatus>('ALL');
  const [rombelTab, setRombelTab] = useState<'analitik' | 'murid' | 'leaderboard'>('analitik');
  const [rombelData, setRombelData] = useState<RombelAnalytics | null>(null);

  // =========================================================================
  // 3. STATE FOR GURU TIM 7 KAIH (Operasional 7 KAIH Sekolah)
  // =========================================================================
  const [timTab, setTimTab] = useState<
    'sekolah' | 'kelas' | 'rombel' | 'validasi' | 'jadwal_koreksi' | 'leaderboard'
  >('sekolah');
  const [schoolData, setSchoolData] = useState<SchoolAnalytics | null>(null);
  const [inspectedClass, setInspectedClass] = useState<string>('XI-MIPA-1');
  const [inspectedClassDate, setInspectedClassDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [inspectedClassData, setInspectedClassData] = useState<ClassAnalytics | null>(null);
  const [inspectedRombel, setInspectedRombel] = useState<string>('Rombel A');
  const [inspectedRombelData, setInspectedRombelData] = useState<RombelAnalytics | null>(null);

  // Validation state (for TIM_7_KAIH)
  const [validationForm, setValidationForm] = useState<{
    studentId: string;
    score: number;
    notes: string;
  }>({
    studentId: '',
    score: 9,
    notes: 'Konsisten melaksanakan 7 KAIH dan aktif dalam piket kebersihan SMAN 28.',
  });
  const [validationSuccess, setValidationSuccess] = useState(false);
  const [validationSummary, setValidationSummary] = useState<any>(null);

  // Schedule & Journal Correction state (for TIM_7_KAIH)
  const [scheduleSettings, setScheduleSettings] = useState({
    schedule_subuh: '04:00',
    schedule_zuhur: '11:40',
    schedule_asar: '14:55',
    schedule_maghrib: '17:50',
    schedule_isya: '19:05',
  });
  const [scheduleSavedMsg, setScheduleSavedMsg] = useState('');
  const [journalsList, setJournalsList] = useState<any[]>([]);
  const [journalFilterDate, setJournalFilterDate] = useState<string>('');
  const [journalFilterHabit, setJournalFilterHabit] = useState<string>('');
  const [editingJournal, setEditingJournal] = useState<any | null>(null);
  const [newJournalScore, setNewJournalScore] = useState<number>(100);
  const [correctionReason, setCorrectionReason] = useState<string>('');

  // Loaders
  const loadWalasData = async () => {
    if (!teacher.class_name) return;
    try {
      setLoading(true);
      const data = await api.getClassAnalytics(teacher.class_name, walasDate);
      setClassData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadWaliData = async () => {
    try {
      setLoading(true);
      const data = await api.getRombelAnalytics(assignedRombel, rombelDays);
      setRombelData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadTim7KaihData = async () => {
    try {
      setLoading(true);
      const [sData, vSummary, cData, rData, settingsRes, jRes] = await Promise.all([
        api.getSchoolAnalytics(),
        api.getAdminValidationsSummary(),
        api.getClassAnalytics(inspectedClass, inspectedClassDate),
        api.getRombelAnalytics(inspectedRombel, 14),
        api.getGlobalSettings(),
        api.getAdminJournals({ date_from: journalFilterDate || undefined, habit_type: journalFilterHabit || undefined }),
      ]);
      setSchoolData(sData);
      setValidationSummary(vSummary);
      setInspectedClassData(cData);
      setInspectedRombelData(rData);
      if (settingsRes?.settings) {
        setScheduleSettings({
          schedule_subuh: settingsRes.settings.schedule_subuh || '04:00',
          schedule_zuhur: settingsRes.settings.schedule_zuhur || '11:40',
          schedule_asar: settingsRes.settings.schedule_asar || '14:55',
          schedule_maghrib: settingsRes.settings.schedule_maghrib || '17:50',
          schedule_isya: settingsRes.settings.schedule_isya || '19:05',
        });
      }
      if (jRes?.journals) {
        setJournalsList(jRes.journals);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (assignmentType === 'WALAS') {
      loadWalasData();
    } else if (assignmentType === 'WALI') {
      loadWaliData();
    } else {
      loadTim7KaihData();
    }
  }, [assignmentType, walasDate, rombelDays, inspectedClass, inspectedClassDate, inspectedRombel]);

  const handleSaveValidation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validationForm.studentId) return;
    try {
      await api.saveAdminValidation({
        student_id: validationForm.studentId,
        verification_score: validationForm.score,
        verified_by: `${teacher.name} (Guru Tim 7 KAIH)`,
        notes: validationForm.notes,
      });
      setValidationSuccess(true);
      setTimeout(() => setValidationSuccess(false), 3000);
      onRefreshStudents?.();
      await loadTim7KaihData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.saveGlobalSettings({
        settings: scheduleSettings,
        actor_name: teacher.name,
      });
      setScheduleSavedMsg('Jadwal ibadah berhasil diperbarui dan diterapkan ke seluruh formulir siswa!');
      setTimeout(() => setScheduleSavedMsg(''), 3500);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan jadwal');
    }
  };

  const handleFilterJournals = async () => {
    try {
      const res = await api.getAdminJournals({
        date_from: journalFilterDate || undefined,
        date_to: journalFilterDate || undefined,
        habit_type: journalFilterHabit || undefined,
      });
      if (res?.journals) setJournalsList(res.journals);
    } catch (err) {
      console.error(err);
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
        corrected_by: `${teacher.name} (Tim 7 KAIH)`,
      });
      setEditingJournal(null);
      setCorrectionReason('');
      await handleFilterJournals();
      await loadTim7KaihData();
      onRefreshStudents?.();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan koreksi nilai');
    }
  };

  // Status badge renderer for 4 official statuses
  const renderStatusBadge = (status?: HabitStatus, completedCount = 0) => {
    const st = status || 'Belum dimulai';
    if (st === 'Selesai') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-800 bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-full">
          <CheckCircle2 className="w-3 h-3" /> Selesai ({completedCount}/7)
        </span>
      );
    }
    if (st === 'Sedang diisi') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-800 bg-blue-100 border border-blue-200 px-2.5 py-0.5 rounded-full">
          <Clock className="w-3 h-3" /> Sedang diisi ({completedCount}/7)
        </span>
      );
    }
    if (st === 'Belum diisi/terlewat') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-100 border border-rose-200 px-2.5 py-0.5 rounded-full">
          <AlertTriangle className="w-3 h-3" /> Belum diisi/terlewat ({completedCount}/7)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-full">
        Belum dimulai (0/7)
      </span>
    );
  };

  const roleBadgeLabel =
    assignmentType === 'WALAS'
      ? `Guru Walas • Kelas ${teacher.class_name}`
      : assignmentType === 'WALI'
      ? `Guru Wali • ${assignedRombel}`
      : 'Guru Tim 7 KAIH • Operasional Sekolah';

  return (
    <div className="min-h-screen bg-kebaya-pattern flex flex-col pb-12">
      {/* Teacher Top Navigation */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#19ae5d] to-[#1c5ddc] text-white flex items-center justify-center font-black text-sm shadow-sm">
            28
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
                VERTIKAL SMA JAWARA 28
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                {roleBadgeLabel}
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              SMAN 28 Jakarta • Sistem Pemantauan &amp; Analitik 7 KAIH
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-xs font-bold text-slate-900 block">{teacher.name}</span>
            <span className="text-[10px] text-slate-500">
              {teacher.subject} • NIP {teacher.nip}
            </span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Keluar
          </button>
        </div>
      </header>

      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1">
        {/* ===================================================================
            ROLE 1: GURU WALAS (MONITORING KETERISIAN KELAS)
        =================================================================== */}
        {assignmentType === 'WALAS' && (
          <div className="space-y-6">
            {/* Profile & Role Header */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#19ae5d] text-white flex items-center justify-center font-black text-2xl shadow-md">
                    WL
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                        {teacher.name}
                      </h2>
                      <span className="text-[11px] font-black bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-full">
                        Guru Walas • Kelas {teacher.class_name}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      NIP: {teacher.nip} • Fokus Utama: Monitoring Keterisian Jurnal Harian Kelas {teacher.class_name}
                    </p>
                  </div>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setWalasTab('monitoring')}
                    className={`px-3.5 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                      walasTab === 'monitoring'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Monitoring Keterisian
                  </button>
                  <button
                    type="button"
                    onClick={() => setWalasTab('analitik')}
                    className={`px-3.5 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                      walasTab === 'analitik'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Analitik Kelas
                  </button>
                  <button
                    type="button"
                    onClick={() => setWalasTab('leaderboard')}
                    className={`px-3.5 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                      walasTab === 'leaderboard'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Leaderboard
                  </button>
                </div>
              </div>

              {/* 4 Summary Status Cards for Selected Date */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-xs font-bold text-slate-600 block">Total Siswa Kelas</span>
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 block mt-1">
                    {classData?.statusSummary?.total ?? classData?.studentCount ?? 0}
                  </span>
                  <span className="text-[11px] text-slate-500">Kelas {teacher.class_name}</span>
                </div>
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                  <span className="text-xs font-bold text-emerald-800 block">Selesai (7/7)</span>
                  <span className="text-2xl sm:text-3xl font-black text-emerald-700 block mt-1">
                    {classData?.statusSummary?.selesai ?? 0}
                  </span>
                  <span className="text-[11px] text-emerald-700">Lengkap seluruh kebiasaan</span>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                  <span className="text-xs font-bold text-blue-800 block">Sedang Diisi</span>
                  <span className="text-2xl sm:text-3xl font-black text-blue-700 block mt-1">
                    {classData?.statusSummary?.sedangDiisi ?? 0}
                  </span>
                  <span className="text-[11px] text-blue-700">Sebagian kebiasaan terisi</span>
                </div>
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl">
                  <span className="text-xs font-bold text-rose-800 block">
                    Belum Dimulai / Terlewat
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-rose-700 block mt-1">
                    {(classData?.statusSummary?.belumDimulai ?? 0) +
                      (classData?.statusSummary?.terlewat ?? 0)}
                  </span>
                  <span className="text-[11px] text-rose-700">Perlu diingatkan Guru Walas</span>
                </div>
              </div>
            </div>

            {walasTab === 'monitoring' && (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">
                      Monitoring Keterisian Jurnal Kelas {teacher.class_name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Pantau siswa yang belum memulai, sedang mengisi, selesai, atau terlewat pada tanggal terpilih
                    </p>
                  </div>

                  {/* Date Picker + Status Filter + Search + Refresh */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <input
                        type="date"
                        value={walasDate}
                        onChange={(e) => setWalasDate(e.target.value)}
                        className="bg-transparent font-bold text-slate-800 focus:outline-none"
                      />
                    </div>

                    <select
                      value={walasStatusFilter}
                      onChange={(e) => setWalasStatusFilter(e.target.value as any)}
                      className="px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                    >
                      <option value="ALL">Semua Status</option>
                      <option value="Belum dimulai">Belum dimulai</option>
                      <option value="Sedang diisi">Sedang diisi</option>
                      <option value="Selesai">Selesai</option>
                      <option value="Belum diisi/terlewat">Belum diisi/terlewat</option>
                    </select>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchStudent}
                        onChange={(e) => setSearchStudent(e.target.value)}
                        placeholder="Cari nama / NISN..."
                        className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={loadWalasData}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Nama Siswa</th>
                        <th className="py-3 px-4">NISN</th>
                        <th className="py-3 px-4">Rombel</th>
                        <th className="py-3 px-4 text-center">Status Tanggal ({walasDate})</th>
                        <th className="py-3 px-4 text-right">Nilai Capaian</th>
                        <th className="py-3 px-4 text-right">Poin Hebat</th>
                        <th className="py-3 px-4 text-center">Catatan Walas</th>
                        <th className="py-3 px-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(classData?.students || [])
                        .filter((st) => {
                          const matchSearch =
                            st.name.toLowerCase().includes(searchStudent.toLowerCase()) ||
                            st.nisn.includes(searchStudent);
                          const matchStatus =
                            walasStatusFilter === 'ALL' || st.today_status === walasStatusFilter;
                          return matchSearch && matchStatus;
                        })
                        .map((st) => (
                          <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                                  {st.name.charAt(0)}
                                </div>
                                <div>
                                  <span className="font-bold text-slate-900 block">{st.name}</span>
                                  <span className="text-[10px] text-slate-400">
                                    {st.religion} • {st.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-600">{st.nisn}</td>
                            <td className="py-3 px-4">
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
                                {st.rombel_name || 'Rombel B'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {renderStatusBadge(st.today_status, st.today_completed_habits || 0)}
                            </td>
                            <td className="py-3 px-4 text-right font-black text-[#1c5ddc]">
                              {st.avg_score ? st.avg_score.toFixed(1) : '0'} / 100
                            </td>
                            <td className="py-3 px-4 text-right font-black text-emerald-700">
                              +{st.poin_hebat || 0}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {st.walas_notes ? (
                                <span className="text-emerald-700 text-[11px] font-semibold">
                                  Ada Catatan
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px]">Belum Ada</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => setSelectedStudentForReport(st.id)}
                                className="px-3 py-1.5 bg-[#19ae5d] hover:bg-emerald-700 text-white font-bold rounded-lg text-xs cursor-pointer"
                              >
                                Detail &amp; Catatan
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {walasTab === 'analitik' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-extrabold text-slate-900 text-sm">
                      Capaian 7 KAIH Kelas {teacher.class_name}
                    </h3>
                    <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs">
                      <button
                        type="button"
                        onClick={() => setChartMode('radar')}
                        className={`px-2.5 py-1 rounded font-bold cursor-pointer ${
                          chartMode === 'radar' ? 'bg-white text-[#1c5ddc]' : 'text-slate-600'
                        }`}
                      >
                        Radar
                      </button>
                      <button
                        type="button"
                        onClick={() => setChartMode('progress')}
                        className={`px-2.5 py-1 rounded font-bold cursor-pointer ${
                          chartMode === 'progress' ? 'bg-white text-[#1c5ddc]' : 'text-slate-600'
                        }`}
                      >
                        Bar
                      </button>
                    </div>
                  </div>
                  {chartMode === 'radar' ? (
                    <RadarChart
                      data={(classData?.classRadar || []).map((r) => ({
                        habit: r.habit,
                        label: r.label,
                        score: r.avg_score,
                      }))}
                      size={260}
                    />
                  ) : (
                    <div className="space-y-2.5 my-2">
                      {(classData?.classRadar || []).map((r) => (
                        <div key={r.habit} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-bold text-slate-700">{r.label}</span>
                            <span className="font-black text-[#1c5ddc]">{r.avg_score} / 100</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#1c5ddc] to-[#19ae5d] rounded-full"
                              style={{ width: `${Math.min(100, Math.max(0, r.avg_score))}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-3 bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-center items-center">
                  <GaugeChart
                    score={classData?.classAverage || 0}
                    title={`Rata-Rata ${teacher.class_name}`}
                    size={220}
                  />
                </div>

                <div className="lg:col-span-4 bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
                  <h3 className="font-extrabold text-slate-900 text-sm mb-3">
                    Distribusi Skor Kelas {teacher.class_name}
                  </h3>
                  {classData?.distribution && (
                    <ScoreDistributionBar distribution={classData.distribution} />
                  )}
                </div>
              </div>
            )}

            {walasTab === 'leaderboard' && (
              <LeaderboardTable
                students={allStudents}
                highlightClass={teacher.class_name}
                onSelectStudent={(s) => setSelectedStudentForReport(s.id)}
              />
            )}
          </div>
        )}

        {/* ===================================================================
            ROLE 2: GURU WALI (ANALITIK ROMBEL)
        =================================================================== */}
        {assignmentType === 'WALI' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-black text-2xl shadow-md">
                    GW
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                        {teacher.name}
                      </h2>
                      <span className="text-[11px] font-black bg-purple-100 text-purple-900 px-2.5 py-0.5 rounded-full">
                        Guru Wali • {assignedRombel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      NIP: {teacher.nip} • Fokus Utama: Analitik Perkembangan &amp; Capaian 7 KAIH {assignedRombel}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={rombelDays}
                    onChange={(e) => setRombelDays(Number(e.target.value))}
                    className="px-3 py-2 text-xs font-bold bg-slate-100 rounded-xl text-slate-800"
                  >
                    <option value={7}>Periode 7 Hari Terakhir</option>
                    <option value={14}>Periode 14 Hari Terakhir</option>
                  </select>

                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setRombelTab('analitik')}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer ${
                        rombelTab === 'analitik' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      Analitik Rombel
                    </button>
                    <button
                      type="button"
                      onClick={() => setRombelTab('murid')}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer ${
                        rombelTab === 'murid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      Tabel Siswa Rombel
                    </button>
                    <button
                      type="button"
                      onClick={() => setRombelTab('leaderboard')}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer ${
                        rombelTab === 'leaderboard' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      Leaderboard
                    </button>
                  </div>
                </div>
              </div>

              {/* 4 KPI Cards for Rombel Analytics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl">
                  <span className="text-xs font-bold text-purple-900 block">
                    Rata-Rata 7 KAIH {assignedRombel}
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-purple-800 block mt-1">
                    {rombelData?.rombelAverage ? rombelData.rombelAverage.toFixed(1) : '0'} / 100
                  </span>
                  <span className="text-[11px] text-purple-700">Nilai Capaian Rombel</span>
                </div>
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                  <span className="text-xs font-bold text-emerald-900 block">
                    Persentase Kelengkapan Jurnal
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-emerald-700 block mt-1">
                    {rombelData?.completionRate ?? 0}%
                  </span>
                  <span className="text-[11px] text-emerald-700">Selama {rombelDays} hari terakhir</span>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                  <span className="text-xs font-bold text-blue-900 block">Siswa Aktif Rombel</span>
                  <span className="text-2xl sm:text-3xl font-black text-blue-800 block mt-1">
                    {rombelData?.participatingCount ?? 0} / {rombelData?.studentCount ?? 0}
                  </span>
                  <span className="text-[11px] text-blue-700">Lintas kelas dalam {assignedRombel}</span>
                </div>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                  <span className="text-xs font-bold text-amber-900 block">Selesai Hari Ini (7/7)</span>
                  <span className="text-2xl sm:text-3xl font-black text-amber-800 block mt-1">
                    {rombelData?.statusSummary?.selesai ?? 0} Siswa
                  </span>
                  <span className="text-[11px] text-amber-700">
                    Sedang diisi: {rombelData?.statusSummary?.sedangDiisi ?? 0}
                  </span>
                </div>
              </div>
            </div>

            {rombelTab === 'analitik' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Perbandingan Capaian Antar Kebiasaan Rombel */}
                  <div className="lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs">
                    <h3 className="font-extrabold text-slate-900 text-sm sm:text-base mb-1">
                      Perbandingan Capaian 7 Kebiasaan ({assignedRombel})
                    </h3>
                    <p className="text-xs text-slate-500 mb-3">
                      Rerata skor tiap kebiasaan anggota {assignedRombel}
                    </p>
                    <RadarChart
                      data={(rombelData?.rombelRadar || []).map((r) => ({
                        habit: r.habit,
                        label: r.label,
                        score: r.avg_score,
                      }))}
                      size={260}
                    />
                  </div>

                  {/* Gauge Rombel */}
                  <div className="lg:col-span-3 bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-center items-center">
                    <GaugeChart
                      score={rombelData?.rombelAverage || 0}
                      title={assignedRombel}
                      size={220}
                    />
                  </div>

                  {/* Distribusi Nilai Rombel */}
                  <div className="lg:col-span-4 bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
                    <h3 className="font-extrabold text-slate-900 text-sm sm:text-base mb-1">
                      Distribusi Rentang Nilai {assignedRombel}
                    </h3>
                    <p className="text-xs text-slate-500 mb-3">Sebaran capaian anggota rombel</p>
                    {rombelData?.distribution && (
                      <ScoreDistributionBar distribution={rombelData.distribution} />
                    )}
                  </div>
                </div>

                {/* Tren Harian Rombel */}
                <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                        Tren Perkembangan Harian {assignedRombel} ({rombelDays} Hari Terakhir)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Rata-rata nilai harian dan persentase kelengkapan jurnal anggota {assignedRombel}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-7 gap-2 pt-2">
                    {(rombelData?.dailyTrend || []).map((d) => (
                      <div
                        key={d.date}
                        className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center flex flex-col justify-between"
                      >
                        <span className="text-[10px] font-bold text-slate-500">{d.label}</span>
                        <div className="my-2 h-20 bg-slate-200 rounded-xl overflow-hidden flex flex-col justify-end">
                          <div
                            className="w-full bg-gradient-to-t from-purple-600 to-indigo-500 text-white text-[10px] font-black flex items-center justify-center transition-all"
                            style={{ height: `${Math.max(15, d.avgScore)}%` }}
                          >
                            {d.avgScore}
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold text-emerald-700">
                          {d.completionPct}% lengkap
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {rombelTab === 'murid' && (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">
                      Daftar Siswa Anggota {assignedRombel}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Menampilkan kelas asal, status pengisian hari ini, nilai capaian, dan poin hebat
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={rombelStatusFilter}
                      onChange={(e) => setRombelStatusFilter(e.target.value as any)}
                      className="px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                    >
                      <option value="ALL">Semua Status</option>
                      <option value="Belum dimulai">Belum dimulai</option>
                      <option value="Sedang diisi">Sedang diisi</option>
                      <option value="Selesai">Selesai</option>
                    </select>
                    <input
                      type="text"
                      value={searchStudent}
                      onChange={(e) => setSearchStudent(e.target.value)}
                      placeholder="Cari siswa rombel..."
                      className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Nama Siswa</th>
                        <th className="py-3 px-4">Kelas</th>
                        <th className="py-3 px-4">Rombel</th>
                        <th className="py-3 px-4 text-center">Status Hari Ini</th>
                        <th className="py-3 px-4 text-right">Nilai Capaian</th>
                        <th className="py-3 px-4 text-right">Poin Hebat</th>
                        <th className="py-3 px-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(rombelData?.students || [])
                        .filter((st) => {
                          const matchSearch =
                            st.name.toLowerCase().includes(searchStudent.toLowerCase()) ||
                            st.nisn.includes(searchStudent);
                          const matchStatus =
                            rombelStatusFilter === 'ALL' || st.today_status === rombelStatusFilter;
                          return matchSearch && matchStatus;
                        })
                        .map((st) => (
                          <tr key={st.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-bold text-slate-900">{st.name}</td>
                            <td className="py-3 px-4 font-semibold text-slate-700">{st.class_name}</td>
                            <td className="py-3 px-4">
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                                {st.rombel_name || assignedRombel}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {renderStatusBadge(st.today_status, st.today_completed_habits || 0)}
                            </td>
                            <td className="py-3 px-4 text-right font-black text-[#1c5ddc]">
                              {st.avg_score ? st.avg_score.toFixed(1) : '0'} / 100
                            </td>
                            <td className="py-3 px-4 text-right font-black text-emerald-700">
                              +{st.poin_hebat || 0}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => setSelectedStudentForReport(st.id)}
                                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs cursor-pointer"
                              >
                                Rapor Siswa
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {rombelTab === 'leaderboard' && (
              <LeaderboardTable
                students={allStudents}
                onSelectStudent={(s) => setSelectedStudentForReport(s.id)}
              />
            )}
          </div>
        )}

        {/* ===================================================================
            ROLE 3: GURU TIM 7 KAIH (SELURUH FITUR OPERASIONAL 7 KAIH SEKOLAH)
        =================================================================== */}
        {assignmentType === 'TIM_7_KAIH' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#0000fe] text-white flex items-center justify-center font-black text-xl shadow-md">
                    7KAIH
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                        {teacher.name}
                      </h2>
                      <span className="text-[11px] font-black bg-indigo-100 text-[#0000fe] px-2.5 py-0.5 rounded-full">
                        Guru Tim 7 KAIH • Koordinator Operasional Sekolah
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      NIP: {teacher.nip} • Otoritas Analitik Sekolah, Angkatan, Kelas, Rombel, Validasi Top 10 &amp; Jadwal 7 KAIH
                    </p>
                  </div>
                </div>

                {/* Sub-Tab Navigation for Guru Tim 7 KAIH */}
                <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl gap-1">
                  {[
                    { id: 'sekolah' as const, label: 'Sekolah & Angkatan' },
                    { id: 'kelas' as const, label: 'Analitik Kelas' },
                    { id: 'rombel' as const, label: 'Analitik Rombel' },
                    { id: 'validasi' as const, label: 'Validasi Top 10' },
                    { id: 'jadwal_koreksi' as const, label: 'Jadwal & Koreksi Nilai' },
                    { id: 'leaderboard' as const, label: 'Leaderboard' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTimTab(t.id)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                        timTab === t.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* School KPI Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-2xl">
                  <span className="text-xs font-bold text-slate-600 block">
                    Siswa Berpartisipasi (Sekolah)
                  </span>
                  <span className="text-2xl font-black text-[#1c5ddc] block mt-1">
                    {schoolData?.participatingStudents || 0} / {schoolData?.totalStudents || 0}
                  </span>
                  <span className="text-[11px] text-blue-700">Seluruh angkatan SMAN 28</span>
                </div>
                <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
                  <span className="text-xs font-bold text-slate-600 block">
                    Rata-Rata Capaian Sekolah
                  </span>
                  <span className="text-2xl font-black text-[#19ae5d] block mt-1">
                    {schoolData?.overallScore ? schoolData.overallScore.toFixed(1) : '0'} / 100
                  </span>
                  <span className="text-[11px] text-emerald-700">Indeks Karakter 7 KAIH</span>
                </div>
                <div className="p-4 bg-purple-50/70 border border-purple-100 rounded-2xl">
                  <span className="text-xs font-bold text-slate-600 block">
                    Kelas &amp; Rombel Aktif
                  </span>
                  <span className="text-2xl font-black text-purple-800 block mt-1">
                    {schoolData?.classes?.length || 4} Kelas • {schoolData?.rombels?.length || 3} Rombel
                  </span>
                  <span className="text-[11px] text-purple-700">Terpisah Kelas &amp; Rombel</span>
                </div>
                <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl">
                  <span className="text-xs font-bold text-slate-600 block">
                    Siswa Tervalidasi Lapangan
                  </span>
                  <span className="text-2xl font-black text-[#0000fe] block mt-1">
                    {allStudents.filter((s) => s.verification_score).length} Siswa
                  </span>
                  <span className="text-[11px] text-indigo-700">Skor kebenaran 1–10</span>
                </div>
              </div>
            </div>

            {/* SUB-TAB 1: ANALITIK SEKOLAH & ANGKATAN (COHORT) */}
            {timTab === 'sekolah' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs">
                    <h3 className="font-extrabold text-slate-900 text-sm sm:text-base mb-2">
                      Capaian 7 KAIH SMAN 28 Jakarta
                    </h3>
                    <RadarChart
                      data={(schoolData?.schoolRadar || []).map((r) => ({
                        habit: r.habit,
                        label: r.label,
                        score: r.avg_score,
                      }))}
                      size={260}
                    />
                  </div>
                  <div className="lg:col-span-3 bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-center items-center">
                    <GaugeChart
                      score={schoolData?.overallScore || 0}
                      title="SMAN 28 Jakarta"
                      size={220}
                    />
                  </div>
                  <div className="lg:col-span-4 bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
                    <h3 className="font-extrabold text-slate-900 text-sm sm:text-base mb-3">
                      Distribusi Skor Siswa Sekolah
                    </h3>
                    {schoolData?.distribution && (
                      <ScoreDistributionBar distribution={schoolData.distribution} />
                    )}
                  </div>
                </div>

                {/* Analitik Angkatan (Cohort) */}
                <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">
                      Analitik Perbandingan Angkatan (Cohort)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Ringkasan partisipasi dan rata-rata capaian 7 KAIH per angkatan
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {(schoolData?.cohortAnalytics || []).map((c) => (
                      <div
                        key={c.cohort}
                        className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5"
                      >
                        <span className="text-xs font-black text-[#1c5ddc] uppercase">
                          Angkatan {c.cohort}
                        </span>
                        <div className="flex items-baseline justify-between">
                          <span className="text-2xl font-black text-slate-900">
                            {c.avgScore} / 100
                          </span>
                          <span className="text-xs font-bold text-emerald-700">
                            {c.participatingCount}/{c.studentCount} siswa aktif
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SUB-TAB 2: ANALITIK KELAS & MONITORING */}
            {timTab === 'kelas' && (
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">
                      Inspeksi Analitik &amp; Monitoring Kelas
                    </h3>
                    <p className="text-xs text-slate-500">
                      Pilih kelas dan tanggal untuk memantau keterisian serta capaian siswa
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={inspectedClassDate}
                      onChange={(e) => setInspectedClassDate(e.target.value)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(schoolData?.classes || ['XI-MIPA-1', 'XI-MIPA-2', 'XI-MIPA-3', 'XII-MIPA-1']).map(
                    (cls) => (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => setInspectedClass(cls)}
                        className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                          inspectedClass === cls
                            ? 'border-[#0000fe] bg-indigo-50/70 ring-2 ring-[#0000fe]/20'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <Building2 className="w-4 h-4 text-[#0000fe] mb-1" />
                        <span className="font-bold text-slate-900 text-sm block">{cls}</span>
                      </button>
                    )
                  )}
                </div>

                {inspectedClassData && (
                  <div className="space-y-5 pt-4 border-t border-slate-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <RadarChart
                          data={inspectedClassData.classRadar.map((r) => ({
                            habit: r.habit,
                            label: r.label,
                            score: r.avg_score,
                          }))}
                          size={210}
                        />
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-center items-center">
                        <GaugeChart
                          score={inspectedClassData.classAverage}
                          title={inspectedClassData.className}
                          size={180}
                        />
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <ScoreDistributionBar distribution={inspectedClassData.distribution} />
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Nama Siswa</th>
                            <th className="py-2.5 px-3">NISN</th>
                            <th className="py-2.5 px-3">Rombel</th>
                            <th className="py-2.5 px-3 text-center">Status ({inspectedClassDate})</th>
                            <th className="py-2.5 px-3 text-right">Nilai Capaian</th>
                            <th className="py-2.5 px-3 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {inspectedClassData.students.map((st) => (
                            <tr key={st.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-bold text-slate-900">{st.name}</td>
                              <td className="py-2.5 px-3 font-mono text-slate-500">{st.nisn}</td>
                              <td className="py-2.5 px-3">{st.rombel_name || 'Rombel B'}</td>
                              <td className="py-2.5 px-3 text-center">
                                {renderStatusBadge(st.today_status, st.today_completed_habits || 0)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-[#1c5ddc]">
                                {st.avg_score ? st.avg_score.toFixed(1) : '0'} / 100
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => setSelectedStudentForReport(st.id)}
                                  className="px-2.5 py-1 bg-slate-800 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                                >
                                  Buka Rapor
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

            {/* SUB-TAB 3: ANALITIK ROMBEL */}
            {timTab === 'rombel' && (
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-6">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Inspeksi Analitik Rombel Sekolah
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pilih Rombel untuk melihat capaian lintas kelas dan tren harian
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {(schoolData?.rombels || ['Rombel A', 'Rombel B', 'Rombel C']).map((rmb) => (
                    <button
                      key={rmb}
                      type="button"
                      onClick={() => setInspectedRombel(rmb)}
                      className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                        inspectedRombel === rmb
                          ? 'border-purple-600 bg-purple-50/70 ring-2 ring-purple-600/20'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <Layers className="w-4 h-4 text-purple-600 mb-1" />
                      <span className="font-bold text-slate-900 text-sm block">{rmb}</span>
                    </button>
                  ))}
                </div>

                {inspectedRombelData && (
                  <div className="space-y-5 pt-4 border-t border-slate-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <RadarChart
                          data={inspectedRombelData.rombelRadar.map((r) => ({
                            habit: r.habit,
                            label: r.label,
                            score: r.avg_score,
                          }))}
                          size={210}
                        />
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-center items-center">
                        <GaugeChart
                          score={inspectedRombelData.rombelAverage}
                          title={inspectedRombelData.rombelName}
                          size={180}
                        />
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <ScoreDistributionBar distribution={inspectedRombelData.distribution} />
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Nama Siswa</th>
                            <th className="py-2.5 px-3">Kelas</th>
                            <th className="py-2.5 px-3">Rombel</th>
                            <th className="py-2.5 px-3 text-center">Status Hari Ini</th>
                            <th className="py-2.5 px-3 text-right">Nilai Capaian</th>
                            <th className="py-2.5 px-3 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {inspectedRombelData.students.map((st) => (
                            <tr key={st.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-bold text-slate-900">{st.name}</td>
                              <td className="py-2.5 px-3">{st.class_name}</td>
                              <td className="py-2.5 px-3 font-bold text-purple-800">
                                {st.rombel_name}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {renderStatusBadge(st.today_status, st.today_completed_habits || 0)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-[#1c5ddc]">
                                {st.avg_score ? st.avg_score.toFixed(1) : '0'} / 100
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => setSelectedStudentForReport(st.id)}
                                  className="px-2.5 py-1 bg-purple-700 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                                >
                                  Buka Rapor
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

            {/* SUB-TAB 4: VALIDASI TOP 10 LEADERBOARD */}
            {timTab === 'validasi' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                  <h4 className="font-extrabold text-slate-900 text-sm">
                    Formulir Validasi Observasi Top 10 Leaderboard
                  </h4>
                  {validationSuccess && (
                    <div className="p-3 bg-emerald-100 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      Skor validasi lapangan berhasil disimpan!
                    </div>
                  )}
                  <form onSubmit={handleSaveValidation} className="space-y-4 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Pilih Siswa (Top 10 Leaderboard):
                      </label>
                      <select
                        value={validationForm.studentId}
                        onChange={(e) =>
                          setValidationForm((prev) => ({ ...prev, studentId: e.target.value }))
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                        required
                      >
                        <option value="">-- Pilih Siswa --</option>
                        {allStudents.slice(0, 10).map((st, i) => (
                          <option key={st.id} value={st.id}>
                            #{i + 1} {st.name} ({st.class_name}) — {st.avg_score || 0} / 100
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-bold text-slate-700">Skor Kebenaran (1–10):</label>
                        <span className="font-black text-emerald-700">{validationForm.score}/10</span>
                      </div>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setValidationForm((prev) => ({ ...prev, score: num }))}
                            className={`flex-1 py-2 rounded-lg font-black text-xs cursor-pointer ${
                              validationForm.score === num
                                ? 'bg-[#19ae5d] text-white'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Catatan Observasi:
                      </label>
                      <textarea
                        rows={3}
                        value={validationForm.notes}
                        onChange={(e) =>
                          setValidationForm((prev) => ({ ...prev, notes: e.target.value }))
                        }
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-[#19ae5d] hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer flex items-center justify-center gap-2"
                    >
                      <CheckCheck className="w-4 h-4" />
                      Simpan Validasi
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-3">
                  <h4 className="font-extrabold text-slate-900 text-sm">
                    Daftar Siswa Top 10 &amp; Status Validasi
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Rank</th>
                          <th className="py-2.5 px-3">Nama Siswa</th>
                          <th className="py-2.5 px-3">Kelas / Rombel</th>
                          <th className="py-2.5 px-3 text-right">Nilai Capaian</th>
                          <th className="py-2.5 px-3 text-center">Skor Validasi</th>
                          <th className="py-2.5 px-3 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {allStudents.slice(0, 10).map((st, i) => (
                          <tr key={st.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-bold">#{i + 1}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">{st.name}</td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {st.class_name} • {st.rombel_name || 'Rombel B'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-black text-[#1c5ddc]">
                              {st.avg_score ? st.avg_score.toFixed(1) : '0'} / 100
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {st.verification_score ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                                  <Star className="w-3 h-3 fill-emerald-600 text-emerald-600" />
                                  {st.verification_score}/10
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px]">Belum Validasi</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  setValidationForm((prev) => ({ ...prev, studentId: st.id }))
                                }
                                className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
                              >
                                Pilih Validasi
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-TAB 5: JADWAL IBADAH & KOREKSI JURNAL 7 KAIH */}
            {timTab === 'jadwal_koreksi' && (
              <div className="space-y-6">
                <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-[#1c5ddc]" />
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base">
                        Pengaturan Jadwal Ibadah Harian (7 KAIH)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Perubahan jadwal langsung diterapkan pada kartu jadwal dan penguncian waktu formulir Beribadah siswa
                      </p>
                    </div>
                  </div>

                  {scheduleSavedMsg && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
                      {scheduleSavedMsg}
                    </div>
                  )}

                  <form onSubmit={handleSaveSchedule} className="grid grid-cols-2 sm:grid-cols-6 gap-3 items-end">
                    {[
                      { key: 'schedule_subuh', label: 'Subuh' },
                      { key: 'schedule_zuhur', label: 'Zuhur' },
                      { key: 'schedule_asar', label: 'Asar' },
                      { key: 'schedule_maghrib', label: 'Maghrib' },
                      { key: 'schedule_isya', label: 'Isya' },
                    ].map((item) => (
                      <div key={item.key}>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          {item.label}
                        </label>
                        <input
                          type="time"
                          value={(scheduleSettings as any)[item.key]}
                          onChange={(e) =>
                            setScheduleSettings((prev) => ({ ...prev, [item.key]: e.target.value }))
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                        />
                      </div>
                    ))}
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-[#1c5ddc] hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                    >
                      Simpan Jadwal
                    </button>
                  </form>
                </div>

                {/* Koreksi Nilai Jurnal Siswa */}
                <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base">
                        Koreksi Terkontrol Nilai Jurnal Siswa (14 Hari)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Setiap perubahan nilai wajib mencantumkan alasan koreksi dan tercatat di riwayat audit
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={journalFilterDate}
                        onChange={(e) => setJournalFilterDate(e.target.value)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs"
                      />
                      <select
                        value={journalFilterHabit}
                        onChange={(e) => setJournalFilterHabit(e.target.value)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold"
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
                        className="px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-bold cursor-pointer"
                      >
                        Filter
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Tanggal</th>
                          <th className="py-2.5 px-3">Siswa</th>
                          <th className="py-2.5 px-3">Kelas / Rombel</th>
                          <th className="py-2.5 px-3">Kebiasaan</th>
                          <th className="py-2.5 px-3 text-right">Nilai</th>
                          <th className="py-2.5 px-3 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {journalsList.slice(0, 40).map((j) => (
                          <tr key={j.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono">{j.log_date}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              {j.student_name}
                            </td>
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
                                className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-bold text-[11px] hover:bg-amber-200 cursor-pointer inline-flex items-center gap-1"
                              >
                                <Edit3 className="w-3 h-3" /> Koreksi
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-TAB 6: LEADERBOARD */}
            {timTab === 'leaderboard' && (
              <LeaderboardTable
                students={allStudents}
                onSelectStudent={(s) => setSelectedStudentForReport(s.id)}
              />
            )}
          </div>
        )}
      </div>

      {/* Modal Koreksi Nilai Jurnal */}
      {editingJournal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-xl space-y-4">
            <h4 className="font-extrabold text-slate-900 text-base">
              Koreksi Nilai Jurnal Siswa
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
                  placeholder="Tuliskan alasan perubahan nilai..."
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
                  className="px-4 py-2 rounded-xl bg-[#1c5ddc] text-white font-bold cursor-pointer"
                >
                  Simpan Koreksi
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
          onClose={() => {
            setSelectedStudentForReport(null);
            if (assignmentType === 'WALAS') loadWalasData();
            else if (assignmentType === 'WALI') loadWaliData();
            else loadTim7KaihData();
          }}
        />
      )}
    </div>
  );
};
