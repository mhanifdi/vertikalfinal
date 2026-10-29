/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Home,
  CheckSquare,
  Trophy,
  User,
  Sun,
  Moon,
  Activity,
  Utensils,
  GraduationCap,
  Users,
  Heart,
  ChevronRight,
  Flame,
  Award,
  Sparkles,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Calendar,
  AlertTriangle,
  Palette,
  Check,
  Send,
  Star,
} from 'lucide-react';
import { Student, HabitLog } from '../../types';
import { api } from '../../utils/api';
import { HonestyCheckInModal } from '../common/HonestyCheckInModal';
import { LeaderboardTable } from '../common/LeaderboardTable';
import { RadarChart } from '../charts/RadarChart';
import { TrendLineChart } from '../charts/TrendLineChart';
import { GaugeChart } from '../charts/GaugeChart';
import { StudentProgressChart } from '../charts/StudentProgressChart';
import { THEME_OPTIONS, applyTheme, getSavedTheme } from '../../config/themeConfig';

interface StudentDashboardProps {
  student: Student;
  allStudents: Student[];
  onLogout: () => void;
  onOpenReport?: (studentId: string) => void;
}

type TabType = 'beranda' | 'kebiasaanku' | 'terlewat' | 'leaderboard' | 'profil';

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  student,
  allStudents,
  onLogout,
  onOpenReport,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('beranda');
  const [todayLogs, setTodayLogs] = useState<Record<string, HabitLog[]>>({
    bangun: [],
    ibadah: [],
    olahraga: [],
    makan: [],
    belajar: [],
    masyarakat: [],
    tidur: [],
  });
  const [activeFormModal, setActiveFormModal] = useState<string | null>(null);
  const [modalInitialHalangan, setModalInitialHalangan] = useState(false);
  const [loading, setLoading] = useState(false);
  const [studentStats, setStudentStats] = useState<any>(null);
  const [progressSeries, setProgressSeries] = useState<any[]>([]);
  const [prayerSchedule, setPrayerSchedule] = useState<Record<string, string>>({
    subuh: '04:00',
    zuhur: '11:40',
    asar: '14:55',
    maghrib: '17:50',
    isya: '19:05',
  });

  // Aktivitas Seru & Kegiatan state (Section 9)
  const [aktivitasSeruList, setAktivitasSeruList] = useState<any[]>([]);
  const [seruHabitType, setSeruHabitType] = useState('belajar');
  const [seruTitle, setSeruTitle] = useState('');
  const [seruStory, setSeruStory] = useState('');
  const [seruSubmitting, setSeruSubmitting] = useState(false);
  const [seruFeedback, setSeruFeedback] = useState('');

  // Calendar & Multi-date missed habit tracking (Riwayat Pengisian)
  const [missedDate, setMissedDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  });
  const [calendarDates, setCalendarDates] = useState<{
    date: string;
    dayName: string;
    formattedDate: string;
    completedCount: number;
    missingCount: number;
    isComplete: boolean;
    habitsDone: string[];
    missingHabits: string[];
    dailyScore: number;
  }[]>([]);
  const [hasAnyMissed, setHasAnyMissed] = useState(false);
  const [selectedDateLogs, setSelectedDateLogs] = useState<Record<string, HabitLog[]>>({});

  // Theme state
  const [activeTheme, setActiveTheme] = useState(() => getSavedTheme());
  const [themeToast, setThemeToast] = useState('');

  // Helper to check if student is fasting sunnah on a given logs set
  const isFastingOnLogs = (logsMap: Record<string, HabitLog[]>) => {
    const ibadahLogs = logsMap['ibadah'] || [];
    return ibadahLogs.some((l) => {
      try {
        const p = typeof l.payload === 'string' ? JSON.parse(l.payload) : l.payload;
        return !!p?.puasaSunnah;
      } catch {
        return false;
      }
    });
  };

  // Helper to check if female Muslim student has active Halangan mode on a given logs set
  const isHalanganOnLogs = (logsMap: Record<string, HabitLog[]>) => {
    const ibadahLogs = logsMap['ibadah'] || [];
    return ibadahLogs.some((l) => {
      if (l.sub_category === 'islam_halangan') return true;
      try {
        const p = typeof l.payload === 'string' ? JSON.parse(l.payload) : l.payload;
        return !!p?.isHalangan || p?.mode === 'HALANGAN';
      } catch {
        return false;
      }
    });
  };

  const getMaxCount = (habitId: string, logsMap: Record<string, HabitLog[]> = todayLogs) => {
    if (habitId === 'makan') {
      return isFastingOnLogs(logsMap) ? 2 : 3;
    }
    if (habitId === 'ibadah') {
      const rel = (student.religion || '').toLowerCase();
      if (rel.includes('hindu')) return 3;
      if (rel.includes('kristen') || rel.includes('katolik')) return 1; // Saved as single consolidated 5-component form
      if (isHalanganOnLogs(logsMap)) return 1; // Saved as single consolidated 5-component Halangan form
      return 5;
    }
    return 1;
  };

  // Compute habit card score (Nilai saat ini / 100) and status according to Section 1.3 & 1.4
  const getHabitProgressInfo = (
    habitId: string,
    logsMap: Record<string, HabitLog[]>,
    isPastDate = false
  ): {
    status: 'Belum dimulai' | 'Sedang diisi' | 'Selesai' | 'Belum diisi/terlewat';
    currentScore: number;
    sessionCount: number;
    maxSessions: number;
    halanganCheckedCount?: number;
  } => {
    const logs = logsMap[habitId] || [];
    const maxSessions = getMaxCount(habitId, logsMap);

    if (logs.length === 0) {
      return {
        status: isPastDate ? 'Belum diisi/terlewat' : 'Belum dimulai',
        currentScore: 0,
        sessionCount: 0,
        maxSessions,
      };
    }

    if (habitId === 'ibadah') {
      const rel = (student.religion || 'Islam').toLowerCase();
      if (isHalanganOnLogs(logsMap)) {
        const halLog = logs.find((l) => l.sub_category === 'islam_halangan') || logs[0];
        let checkedCount = 0;
        try {
          const p = typeof halLog.payload === 'string' ? JSON.parse(halLog.payload) : halLog.payload;
          checkedCount = Array.isArray(p?.checkedItems) ? p.checkedItems.length : Math.round((halLog.score || 0) / 20);
        } catch {
          checkedCount = Math.round((halLog.score || 0) / 20);
        }
        const score = Math.min(100, Math.round(halLog.score || checkedCount * 20));
        return {
          status: checkedCount >= 5 ? 'Selesai' : isPastDate ? 'Belum diisi/terlewat' : 'Sedang diisi',
          currentScore: score,
          sessionCount: checkedCount,
          maxSessions: 5,
          halanganCheckedCount: checkedCount,
        };
      }
      if (rel.includes('kristen') || rel.includes('katolik')) {
        const kLog = logs[0];
        const score = Math.min(100, Math.round(kLog?.score || 0));
        return {
          status: 'Selesai',
          currentScore: score,
          sessionCount: 1,
          maxSessions: 1,
        };
      }
      if (rel.includes('hindu')) {
        const sum = logs.slice(0, 3).reduce((acc, l) => acc + (l.score || 0), 0);
        const avg = Math.min(100, Math.round(sum / 3));
        const done = logs.length >= 3;
        return {
          status: done ? 'Selesai' : isPastDate ? 'Belum diisi/terlewat' : 'Sedang diisi',
          currentScore: avg,
          sessionCount: Math.min(3, logs.length),
          maxSessions: 3,
        };
      }
      // Islam 5 prayers averaged / 5
      const sum = logs.slice(0, 5).reduce((acc, l) => acc + (l.score || 0), 0);
      const avg = Math.min(100, Math.round(sum / 5));
      const done = logs.length >= 5;
      return {
        status: done ? 'Selesai' : isPastDate ? 'Belum diisi/terlewat' : 'Sedang diisi',
        currentScore: avg,
        sessionCount: Math.min(5, logs.length),
        maxSessions: 5,
      };
    }

    if (habitId === 'makan') {
      const fasting = isFastingOnLogs(logsMap);
      const divisor = fasting ? 2 : 3;
      const sum = logs.slice(0, divisor).reduce((acc, l) => acc + (l.score || 0), 0);
      const avg = Math.min(100, Math.round(sum / 3)); // Spec 4.2: Nilai harian = (Sarapan + Siang + Malam) / 3
      const done = logs.length >= divisor;
      return {
        status: done ? 'Selesai' : isPastDate ? 'Belum diisi/terlewat' : 'Sedang diisi',
        currentScore: avg,
        sessionCount: Math.min(divisor, logs.length),
        maxSessions: divisor,
      };
    }

    // Single-entry habits
    const score = Math.min(100, Math.round(logs[0]?.score || 0));
    return {
      status: 'Selesai',
      currentScore: score,
      sessionCount: 1,
      maxSessions: 1,
    };
  };

  // Load today's logs, report, progress series, aktivitas seru, settings & calendar summary
  const fetchTodayHabits = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const [todayData, report, calendarData, progData, seruData, settingsData] = await Promise.all([
        api.getTodayHabits(student.id),
        api.getStudentReport(student.id),
        api.getCalendarSummary(student.id, 14),
        api.getStudentProgress(student.id, 14),
        api.getAktivitasSeru(student.id, todayStr),
        api.getGlobalSettings(),
      ]);

      if (todayData?.habitsByType) {
        setTodayLogs(todayData.habitsByType);
      }
      setStudentStats(report);

      if (calendarData?.dates) {
        setCalendarDates(calendarData.dates);
        setHasAnyMissed(calendarData.hasAnyMissed);
      }
      if (progData?.series) {
        setProgressSeries(progData.series);
      }
      if (seruData?.entries) {
        setAktivitasSeruList(seruData.entries);
      }
      if (settingsData?.settings) {
        const s = settingsData.settings;
        setPrayerSchedule({
          subuh: s.schedule_subuh || '04:00',
          zuhur: s.schedule_zuhur || '11:40',
          asar: s.schedule_asar || '14:55',
          maghrib: s.schedule_maghrib || '17:50',
          isya: s.schedule_isya || '19:05',
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch logs for the selected missed date
  const fetchDateHabits = async (dateStr: string) => {
    try {
      const data = await api.getTodayHabits(student.id, dateStr);
      if (data?.habitsByType) {
        setSelectedDateLogs(data.habitsByType);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTodayHabits();
  }, [student.id]);

  useEffect(() => {
    if (activeTab === 'terlewat') {
      fetchDateHabits(missedDate);
    }
  }, [missedDate, activeTab]);

  // Apply theme on initial mount
  useEffect(() => {
    applyTheme(activeTheme.hex);
  }, []);

  const handleThemeChange = (hex: string) => {
    applyTheme(hex);
    const found = THEME_OPTIONS.find((t) => t.hex.toLowerCase() === hex.toLowerCase()) || THEME_OPTIONS[0];
    setActiveTheme(found);
    setThemeToast(`Tema berhasil diubah ke ${found.name}!`);
    setTimeout(() => setThemeToast(''), 3000);
  };

  // 7 KAIH master definition
  const HABIT_CARDS = [
    {
      id: 'bangun',
      title: 'Bangun Pagi',
      subtitle: 'Pukul 04.00 – 06.40 WIB',
      icon: Sun,
      color: '#1c5ddc',
      bgLight: 'bg-blue-50',
      borderLight: 'border-blue-200',
      isMulti: false,
      desc: 'Kedisiplinan mengawali hari dengan segar',
    },
    {
      id: 'ibadah',
      title: 'Beribadah',
      subtitle: 'Shalat / Doa Harian / Tri Sandhya',
      icon: Heart,
      color: '#19ae5d',
      bgLight: 'bg-emerald-50',
      borderLight: 'border-emerald-200',
      isMulti: true,
      desc: 'Ketaatan spiritual & penguatan nilai keimanan',
    },
    {
      id: 'olahraga',
      title: 'Berolahraga',
      subtitle: 'Aktivitas Fisik & Peregangan',
      icon: Activity,
      color: '#fc351c',
      bgLight: 'bg-red-50',
      borderLight: 'border-red-200',
      isMulti: false,
      desc: 'Kebugaran fisik, peregangan & stamina tubuh',
    },
    {
      id: 'makan',
      title: 'Makan Bergizi',
      subtitle: '3 Sesi Makan & Air Putih',
      icon: Utensils,
      color: '#feb52b',
      bgLight: 'bg-amber-50',
      borderLight: 'border-amber-200',
      isMulti: true,
      desc: 'Nutrisi seimbang karbohidrat, lauk, sayur & buah',
    },
    {
      id: 'belajar',
      title: 'Gemar Belajar',
      subtitle: 'Mandiri di luar jam sekolah',
      icon: GraduationCap,
      color: '#0000fe',
      bgLight: 'bg-indigo-50',
      borderLight: 'border-indigo-200',
      isMulti: false,
      desc: 'Membaca, review pelajaran & eksplorasi materi',
    },
    {
      id: 'masyarakat',
      title: 'Bermasyarakat',
      subtitle: 'Aksi Sosial & Kebersihan Lingkungan',
      icon: Users,
      color: '#19ae5d',
      bgLight: 'bg-emerald-50',
      borderLight: 'border-emerald-200',
      isMulti: false,
      desc: 'Kepedulian sosial di rumah, sekolah & masyarakat',
    },
    {
      id: 'tidur',
      title: 'Tidur Cepat',
      subtitle: 'Sebelum 21.30 – 22.30 WIB',
      icon: Moon,
      color: '#0000fe',
      bgLight: 'bg-indigo-50',
      borderLight: 'border-indigo-200',
      isMulti: false,
      desc: 'Pemulihan tubuh & ritme istirahat sehat',
    },
  ];

  // Check which habits have NOT reached 'Selesai' today
  const uncompletedHabits = HABIT_CARDS.filter((h) => {
    const info = getHabitProgressInfo(h.id, todayLogs, false);
    return info.status !== 'Selesai';
  });

  // Calculate my rank in all students
  const myRank =
    allStudents.findIndex((s) => s.id === student.id) !== -1
      ? allStudents.findIndex((s) => s.id === student.id) + 1
      : 1;

  // Handle submit habit log
  const handleHabitSubmit = async (
    habitType: string,
    score: number,
    payload: any,
    isCounter = false,
    subCategory?: string
  ) => {
    try {
      setLoading(true);
      const todayStr = new Date().toISOString().split('T')[0];
      const isPastDate = activeTab === 'terlewat';
      const targetDate = isPastDate ? missedDate : todayStr;
      const isMissed = isPastDate || !!payload?.isMissed;
      const finalSubCat =
        subCategory ||
        payload?.subCategory ||
        payload?.mealType ||
        payload?.detectedMeal ||
        payload?.detectedPrayer ||
        payload?.prayer ||
        payload?.doaTime ||
        payload?.sandhyaTime ||
        '';

      // If switching between Islam normal prayers and Halangan on the same date, clear previous ibadah logs first
      if (habitType === 'ibadah' && payload?.overwritePreviousMode) {
        await api.resetHabitForDate(student.id, 'ibadah', targetDate);
      }

      await api.submitHabit({
        student_id: student.id,
        habit_type: habitType,
        score,
        payload,
        sub_category: finalSubCat,
        is_counter_entry: isCounter ? 1 : 0,
        is_missed: isMissed ? 1 : 0,
        log_date: targetDate,
      });
      setActiveFormModal(null);
      setModalInitialHalangan(false);
      await fetchTodayHabits();
      if (isPastDate) {
        await fetchDateHabits(missedDate);
      }
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan kebiasaan');
    } finally {
      setLoading(false);
    }
  };

  // Handle Aktivitas Seru & Kegiatan submit (Section 9: +10 bonus)
  const handleSubmitAktivitasSeru = async (e: React.FormEvent) => {
    e.preventDefault();
    if (seruStory.trim().length < 10) {
      alert('Cerita minimal 10 karakter.');
      return;
    }
    try {
      setSeruSubmitting(true);
      await api.submitAktivitasSeru({
        student_id: student.id,
        habit_type: seruHabitType,
        activity_title: seruTitle.trim() || `Cerita Seru ${seruHabitType.toUpperCase()}`,
        story_text: seruStory.trim(),
      });
      setSeruTitle('');
      setSeruStory('');
      setSeruFeedback('Cerita Aktivitas Seru berhasil disimpan (+10 Poin Bonus)!');
      setTimeout(() => setSeruFeedback(''), 4000);
      await fetchTodayHabits();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan Aktivitas Seru');
    } finally {
      setSeruSubmitting(false);
    }
  };

  // Find missed count for past days
  const missedDaysCount = calendarDates.slice(1).filter((d) => !d.isComplete).length;

  const isFemaleIslam =
    student.gender === 'P' && (student.religion || 'Islam').toLowerCase().includes('islam');

  return (
    <div className="min-h-screen bg-kebaya-pattern flex flex-col pb-20 md:pb-6">
      {/* Toast Notification */}
      {themeToast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl shadow-lg border border-slate-700 animate-bounce flex items-center gap-2">
          <Palette className="w-4 h-4 text-[#feb52b]" />
          <span>{themeToast}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl text-white flex items-center justify-center font-black text-sm shadow-sm transition-colors"
            style={{ backgroundColor: 'var(--primary-color, #1c5ddc)' }}
          >
            28
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
                VERTIKAL SMA JAWARA 28
              </span>
              <span
                className="w-2.5 h-2.5 rounded-full transition-colors"
                style={{ backgroundColor: activeTheme.hex }}
                title={`Tema: ${activeTheme.name}`}
              />
            </div>
            <span className="text-[11px] text-slate-500 hidden sm:block">
              Instrumen Siswa • 7 Kebiasaan Anak Indonesia Hebat SMAN 28 Jakarta
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-xs font-bold text-slate-900 block">{student.name}</span>
            <span className="text-[10px] text-slate-500 font-semibold">
              {student.class_name} • {student.rombel_name || 'Rombel B'} • NISN {student.nisn}
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

      {/* Main 3-Column / Responsive Layout */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex-1 grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Fixed / Collapsible Sidebar (Col 1-3 on Desktop) */}
        <aside className="hidden md:block md:col-span-3 lg:col-span-3">
          <div className="sticky top-20 bg-white rounded-2xl border border-slate-200 p-3 shadow-xs space-y-1">
            <div className="px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-400">
              Menu Siswa
            </div>
            {[
              { id: 'beranda' as const, label: 'Beranda', icon: Home },
              {
                id: 'kebiasaanku' as const,
                label: 'Kebiasaanku (Hari Ini)',
                icon: CheckSquare,
                badge: uncompletedHabits.length > 0 ? `${uncompletedHabits.length}` : null,
              },
              {
                id: 'terlewat' as const,
                label: 'Riwayat Pengisian',
                icon: Calendar,
                badge: hasAnyMissed ? `${missedDaysCount} Hari` : null,
              },
              { id: 'leaderboard' as const, label: 'Leaderboard', icon: Trophy },
              { id: 'profil' as const, label: 'Profil Siswa', icon: User },
            ].map((menu) => {
              const Icon = menu.icon;
              const isActive = activeTab === menu.id;
              return (
                <button
                  key={menu.id}
                  type="button"
                  onClick={() => setActiveTab(menu.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    isActive
                      ? 'text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  style={{
                    backgroundColor: isActive ? 'var(--primary-color, #1c5ddc)' : undefined,
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{menu.label}</span>
                  </div>
                  {menu.badge && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                        isActive ? 'bg-white text-slate-900' : 'bg-red-500 text-white'
                      }`}
                    >
                      {menu.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Quick SMAN 28 Identity card in sidebar showing both Kelas & Rombel */}
            <div className="pt-4 mt-4 border-t border-slate-100 px-3 space-y-2.5">
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">
                  Guru Walas ({student.class_name})
                </span>
                <span className="text-xs font-bold text-slate-800 block mt-0.5">
                  {student.walas_name}
                </span>
                <span className="text-[10px] text-slate-500 block">NIP {student.walas_nip}</span>
              </div>
              {student.wali_name && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">
                    Guru Wali ({student.rombel_name || 'Rombel B'})
                  </span>
                  <span className="text-xs font-bold text-slate-800 block mt-0.5">
                    {student.wali_name}
                  </span>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Center Main Content (Col 4-9 on Desktop, full on tablet/mobile) */}
        <main className="md:col-span-9 lg:col-span-6 space-y-6">
          {/* TAB 1: BERANDA */}
          {activeTab === 'beranda' && (
            <div className="space-y-6">
              {/* Alert Banner ONLY IF THERE ARE MISSED PAST DATES */}
              {hasAnyMissed && (
                <div
                  onClick={() => setActiveTab('terlewat')}
                  className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-red-50 border border-amber-200/80 flex items-center justify-between cursor-pointer hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-amber-950">
                        Ada Jurnal Tanggal Sebelumnya yang Belum Lengkap
                      </h4>
                      <p className="text-[11px] text-amber-800">
                        Terdapat {missedDaysCount} hari di Riwayat Pengisian yang belum lengkap. Klik untuk membuka Formulir Terlewat (Tanpa pengurangan poin).
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-amber-700 shrink-0" />
                </div>
              )}

              {/* Profile Card (Nama, NISN, Kelas, Rombel, Streak, Nilai Capaian, Poin Hebat) */}
              <div
                className="bg-white rounded-3xl p-5 sm:p-6 border shadow-sm relative overflow-hidden transition-all"
                style={{ borderColor: 'var(--theme-soft-border, rgba(28, 93, 220, 0.25))' }}
              >
                <div
                  className="absolute top-0 right-0 w-36 h-36 rounded-bl-full pointer-events-none opacity-40 transition-colors"
                  style={{ backgroundColor: 'var(--theme-tint-bg, rgba(28, 93, 220, 0.05))' }}
                />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                  <div className="flex items-center gap-3.5">
                    <div
                      className="w-14 h-14 rounded-2xl text-white flex items-center justify-center font-black text-2xl shadow-md ring-4 ring-slate-100 transition-colors"
                      style={{ backgroundColor: 'var(--primary-color, #1c5ddc)' }}
                    >
                      {student.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                          {student.name}
                        </h2>
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-black text-white"
                          style={{ backgroundColor: 'var(--primary-color, #1c5ddc)' }}
                        >
                          Kelas {student.class_name}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-purple-100 text-purple-800 border border-purple-200">
                          {student.rombel_name || 'Rombel B'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        NISN: {student.nisn} • SMAN 28 Jakarta • Angkatan {student.angkatan}
                      </p>
                      <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
                        Agama: <strong>{student.religion}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* KPI metrics in Profile Card: Streak, Nilai Capaian, Poin Hebat, Peringkat */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4 border-t border-slate-100">
                  <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-100/80 text-center">
                    <span className="text-[10px] font-semibold text-amber-800 flex items-center justify-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-amber-500" /> Streak
                    </span>
                    <span className="text-xl font-black text-amber-950 block mt-0.5">
                      {studentStats?.streak ?? student.streak ?? 0}
                    </span>
                    <span className="text-[9px] text-amber-700 font-medium">Hari Lengkap (7/7)</span>
                  </div>

                  <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-100/80 text-center">
                    <span className="text-[10px] font-semibold text-[#1c5ddc] flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#1c5ddc]" /> Nilai Capaian
                    </span>
                    <span className="text-xl font-black text-blue-950 block mt-0.5">
                      {studentStats?.overallScore !== undefined
                        ? `${studentStats.overallScore.toFixed(1)}/100`
                        : `${(student.avg_score || 0).toFixed(1)}/100`}
                    </span>
                    <span className="text-[9px] text-blue-700 font-medium">Maksimal 100</span>
                  </div>

                  <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-100/80 text-center">
                    <span className="text-[10px] font-semibold text-emerald-800 flex items-center justify-center gap-1">
                      <Award className="w-3.5 h-3.5 text-emerald-500" /> Poin Hebat
                    </span>
                    <span className="text-xl font-black text-emerald-950 block mt-0.5">
                      +{studentStats?.poinHebat ?? student.poin_hebat ?? 0}
                    </span>
                    <span className="text-[9px] text-emerald-700 font-medium">Akumulasi Bonus</span>
                  </div>

                  <div className="p-3 bg-purple-50/70 rounded-2xl border border-purple-100/80 text-center">
                    <span className="text-[10px] font-semibold text-purple-800 flex items-center justify-center gap-1">
                      <Trophy className="w-3.5 h-3.5 text-purple-600" /> Peringkat
                    </span>
                    <span className="text-xl font-black text-purple-950 block mt-0.5">
                      #{myRank}
                    </span>
                    <span className="text-[9px] text-purple-700 font-medium">Leaderboard</span>
                  </div>
                </div>
              </div>

              {/* Container Kebiasaan Belum Selesai Hari Ini */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight flex items-center gap-2">
                      <span>Jurnal Kebiasaan Hari Ini</span>
                      {uncompletedHabits.length > 0 && (
                        <span className="w-2 h-2 rounded-full bg-[#eb30a2]" />
                      )}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {uncompletedHabits.length > 0
                        ? `Ada ${uncompletedHabits.length} kebiasaan yang belum selesai hari ini (Mode Fleksibel tanpa pengurangan poin).`
                        : 'Luar biasa! Seluruh 7 kebiasaan hari ini berstatus Selesai.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('kebiasaanku')}
                    className="text-xs font-bold hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
                    style={{ color: 'var(--primary-color, #1c5ddc)' }}
                  >
                    Semua Kartu (7 KAIH) →
                  </button>
                </div>

                {uncompletedHabits.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {uncompletedHabits.slice(0, 2).map((habit) => {
                      const Icon = habit.icon;
                      const info = getHabitProgressInfo(habit.id, todayLogs, false);
                      return (
                        <div
                          key={habit.id}
                          onClick={() => {
                            setModalInitialHalangan(false);
                            setActiveFormModal(habit.id);
                          }}
                          className="habit-card p-4 rounded-2xl border border-slate-200 bg-white hover:border-[#1c5ddc] cursor-pointer group shadow-xs"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div
                              className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                              style={{ backgroundColor: habit.color }}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                info.status === 'Sedang diisi'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-50 text-amber-800'
                              }`}
                            >
                              {info.status} • {info.currentScore} / 100
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-900 text-sm">{habit.title}</h4>
                          <p className="text-xs text-slate-500 font-medium line-clamp-1 mt-0.5">
                            {habit.subtitle}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-center bg-emerald-50/70 rounded-2xl border border-emerald-200">
                    <CheckCircle2 className="w-8 h-8 text-[#19ae5d] mx-auto mb-1.5" />
                    <span className="font-bold text-emerald-900 text-sm block">
                      Semua 7 Kebiasaan Hari Ini Telah Selesai!
                    </span>
                    <span className="text-xs text-emerald-700">
                      Streak harianmu bertambah. Terus pertahankan konsistensi Jawara 28!
                    </span>
                  </div>
                )}
              </div>

              {/* SECTION 9: AKTIVITAS SERU & KEGIATAN (Placed on Beranda after habit cards and before Report Summary) */}
              <div className="bg-gradient-to-br from-indigo-50/80 via-white to-blue-50/60 rounded-3xl p-5 sm:p-6 border border-indigo-200/80 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                      <Star className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                          Aktivitas Seru &amp; Kegiatan Hari Ini
                        </h3>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                          Bonus +10 Poin
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Pilih salah satu dari 7 kebiasaan dan ceritakan pengalaman positifmu hari ini. Jika Nilai Capaian sudah 100, bonus masuk ke Poin Hebat!
                      </p>
                    </div>
                  </div>
                </div>

                {seruFeedback && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{seruFeedback}</span>
                  </div>
                )}

                <form onSubmit={handleSubmitAktivitasSeru} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Pilih Kebiasaan Terkait
                      </label>
                      <select
                        value={seruHabitType}
                        onChange={(e) => setSeruHabitType(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800"
                      >
                        {HABIT_CARDS.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.title} (+10 Poin Bonus)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Judul Kegiatan Singkat
                      </label>
                      <input
                        type="text"
                        value={seruTitle}
                        onChange={(e) => setSeruTitle(e.target.value)}
                        placeholder="Contoh: Membantu kerja bakti taman sekolah"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        Cerita Pengalaman Seru (Minimal 10 karakter)
                      </label>
                      <span className="text-[10px] font-bold text-slate-400">
                        {seruStory.trim().length} karakter
                      </span>
                    </div>
                    <textarea
                      rows={2}
                      value={seruStory}
                      onChange={(e) => setSeruStory(e.target.value)}
                      placeholder="Tuliskan cerita aktivitas positif yang kamu lakukan hari ini..."
                      className="w-full p-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-800"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      Hanya berlaku untuk jurnal tanggal hari ini ({new Date().toISOString().split('T')[0]}).
                    </span>
                    <button
                      type="submit"
                      disabled={seruSubmitting || seruStory.trim().length < 10}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{seruSubmitting ? 'Menyimpan...' : 'Kirim Cerita (+10 Poin)'}</span>
                    </button>
                  </div>
                </form>

                {aktivitasSeruList.length > 0 && (
                  <div className="pt-3 border-t border-indigo-100 space-y-2">
                    <span className="text-[11px] font-bold text-indigo-900 block">
                      Cerita Aktivitas Seru yang Sudah Kamu Kirim Hari Ini:
                    </span>
                    {aktivitasSeruList.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-3 rounded-xl bg-white border border-indigo-100 flex items-start justify-between gap-2 text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-900">{entry.activity_title}</span>
                          <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold uppercase">
                            {entry.habit_type}
                          </span>
                          <p className="text-slate-600 text-[11px] mt-0.5">{entry.story_text}</p>
                        </div>
                        <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg shrink-0">
                          +{entry.bonus_awarded || 10} pt
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION 13: GRAFIK PERKEMBANGAN SISWA (14 HARI) */}
              <StudentProgressChart
                series={progressSeries}
                title="Grafik Perkembangan Harian 7 KAIH Saya"
              />

              {/* Container Ringkasan Rapor memuat: Ulasan guru & Capaian Skor Keseluruhan (%) */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight">
                    Ringkasan Rapor Pembiasaan
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('profil')}
                    className="text-xs font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    style={{ color: 'var(--primary-color, #1c5ddc)' }}
                  >
                    Buka Rapor Lengkap <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-1 p-4 rounded-2xl bg-gradient-to-b from-blue-50/80 to-white border border-blue-100 text-center flex flex-col justify-center items-center">
                    <span className="text-xs text-slate-500 font-semibold">Nilai Capaian</span>
                    <span
                      className="text-2xl font-black my-1"
                      style={{ color: 'var(--primary-color, #1c5ddc)' }}
                    >
                      {studentStats?.overallScore ? `${studentStats.overallScore} / 100` : '0 / 100'}
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                      Poin Hebat: +{studentStats?.poinHebat ?? student.poin_hebat ?? 0}
                    </span>
                  </div>
                  <div className="sm:col-span-2 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        Ulasan Guru Walas ({student.walas_name}):
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 italic">
                      "{student.walas_notes || 'Belum ada ulasan catatan dari wali kelas.'}"
                    </p>
                    {student.walas_recommendation && (
                      <p className="text-[11px] text-[#1c5ddc] font-medium pt-1 border-t border-slate-200">
                        <strong>Rekomendasi:</strong> {student.walas_recommendation}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: KEBIASAANKU (7 Cards Grid -> Form when clicked; NO +/- counter buttons!) */}
          {activeTab === 'kebiasaanku' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    Jurnal 7 Kebiasaan Hari Ini ({new Date().toISOString().split('T')[0]})
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Pengisian Tepat Hari &amp; Fleksibel sebelum pukul 00.00 WIB tanpa pengurangan poin. Kartu berstatus Selesai berubah hijau dan terkunci.
                  </p>
                </div>
              </div>

              {/* 7 Habit Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                {HABIT_CARDS.map((habit) => {
                  const Icon = habit.icon;
                  const info = getHabitProgressInfo(habit.id, todayLogs, false);
                  const isCompleted = info.status === 'Selesai';
                  const isHalanganActive = habit.id === 'ibadah' && isHalanganOnLogs(todayLogs);

                  return (
                    <div
                      key={habit.id}
                      className={`habit-card rounded-3xl p-5 border transition-all flex flex-col justify-between ${
                        isCompleted
                          ? 'bg-emerald-50/75 border-emerald-300 shadow-xs'
                          : info.status === 'Sedang diisi'
                          ? 'bg-white border-blue-300 hover:border-[#1c5ddc]'
                          : 'bg-white border-slate-200 hover:border-[#1c5ddc]'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between mb-3">
                          <div
                            className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xs"
                            style={{ backgroundColor: isCompleted ? '#19ae5d' : habit.color }}
                          >
                            <Icon className="w-5 h-5" />
                          </div>

                          {/* 4 Official Status Badges + Score Fraction */}
                          <div className="flex flex-col items-end gap-1">
                            {isCompleted ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-800 bg-emerald-200/80 px-2.5 py-0.5 rounded-full">
                                <Lock className="w-3 h-3" /> Selesai
                              </span>
                            ) : info.status === 'Sedang diisi' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 bg-blue-100 px-2.5 py-0.5 rounded-full">
                                <Clock className="w-3 h-3" /> Sedang diisi ({info.sessionCount}/{info.maxSessions})
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                                Belum dimulai
                              </span>
                            )}
                            <span className="text-[11px] font-black text-slate-700">
                              Nilai: {info.currentScore} / 100
                            </span>
                          </div>
                        </div>

                        <h4 className="font-extrabold text-slate-900 text-base">{habit.title}</h4>
                        <p className="text-xs font-medium text-slate-500 mb-1">{habit.subtitle}</p>
                        <p className="text-[11px] text-slate-400 mb-3 line-clamp-1">{habit.desc}</p>

                        {/* ADDENDUM B: Inline Female Muslim "Saya sedang berhalangan" toggle directly on Beribadah card */}
                        {habit.id === 'ibadah' && isFemaleIslam && (
                          <div className="mb-3 p-3 rounded-2xl bg-pink-50/90 border border-pink-200 space-y-1.5">
                            <label className="flex items-center justify-between gap-2 cursor-pointer">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isHalanganActive}
                                  disabled={isCompleted}
                                  onChange={() => {
                                    setModalInitialHalangan(true);
                                    setActiveFormModal('ibadah');
                                  }}
                                  className="w-4 h-4 rounded text-pink-600 focus:ring-pink-500"
                                />
                                <span className="text-xs font-extrabold text-pink-950">
                                  Saya sedang berhalangan
                                </span>
                              </div>
                              <span className="text-[10px] font-black text-pink-800 bg-pink-100 px-2 py-0.5 rounded-full">
                                {isHalanganActive
                                  ? `${info.halanganCheckedCount || 0}/5 komponen • ${info.currentScore}/100`
                                  : '5 Komponen @ 20 Poin'}
                              </span>
                            </label>
                            <p className="text-[10px] text-pink-800 leading-snug">
                              Menggantikan 5 kartu shalat wajib dengan 5 amalan pengganti (Dzikir, Muraja&apos;ah, Sedekah, Kajian, Kebersihan Diri).
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Bottom Action Bar (No + / - buttons!) */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        <span className="text-[11px] font-semibold text-slate-500">
                          {habit.isMulti
                            ? isHalanganActive
                              ? `Amalan Pengganti: ${info.sessionCount} / 5`
                              : `Progres Sesi: ${info.sessionCount} / ${info.maxSessions}`
                            : `Capaian: ${info.currentScore} / 100`}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            setModalInitialHalangan(isHalanganActive);
                            setActiveFormModal(habit.id);
                          }}
                          disabled={isCompleted}
                          className={`btn-interactive px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isCompleted
                              ? 'bg-emerald-200 text-emerald-900 cursor-not-allowed'
                              : 'bg-[#1c5ddc] text-white hover:bg-blue-700 shadow-xs'
                          }`}
                        >
                          {isCompleted
                            ? 'Selesai & Terkunci'
                            : info.status === 'Sedang diisi'
                            ? 'Lanjutkan Pengisian'
                            : 'Buka Formulir'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: RIWAYAT PENGISIAN & FORMULIR TERLEWAT (NO -5 PENALTY!) */}
          {activeTab === 'terlewat' && (
            <div className="space-y-6">
              {/* Header Box */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full bg-amber-600" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-200/70 px-2 py-0.5 rounded-full">
                        Riwayat Pengisian &amp; Formulir Terlewat
                      </span>
                    </div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">
                      Riwayat Pengisian Jurnal 14 Hari Terakhir
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Pilih tanggal pada kalender riwayat di bawah. Kartu hijau sudah berstatus <strong>Selesai</strong> (terkunci), sedangkan kartu berstatus <strong>Belum diisi/terlewat</strong> dapat dilengkapi menggunakan <strong>Formulir Terlewat</strong>.
                    </p>
                  </div>
                </div>

                {/* Interactive Multi-Date Calendar Strip (Past 14 Days) */}
                <div className="space-y-2 pt-2 border-t border-amber-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-amber-700" />
                      Pilih Tanggal Riwayat (14 Hari Terakhir):
                    </span>
                    <span className="text-[11px] text-slate-600">
                      Tanggal Jurnal: <strong>{missedDate}</strong>
                    </span>
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-2 pt-1">
                    {calendarDates.slice(1).map((dItem) => {
                      const isSelected = missedDate === dItem.date;
                      return (
                        <button
                          key={dItem.date}
                          type="button"
                          onClick={() => setMissedDate(dItem.date)}
                          className={`flex-shrink-0 p-3 rounded-2xl border text-center transition-all cursor-pointer min-w-[96px] ${
                            isSelected
                              ? 'ring-2 ring-slate-900 shadow-md scale-102'
                              : 'hover:scale-101'
                          } ${
                            dItem.isComplete
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                              : 'bg-amber-50 border-amber-300 text-amber-950'
                          }`}
                        >
                          <span className="text-[10px] font-bold block opacity-70">
                            {dItem.dayName}
                          </span>
                          <span className="text-sm font-black block my-0.5">
                            {dItem.formattedDate}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold inline-block ${
                              dItem.isComplete
                                ? 'bg-emerald-200 text-emerald-800'
                                : 'bg-amber-200 text-amber-900'
                            }`}
                          >
                            {dItem.isComplete ? '✓ Selesai (7/7)' : `${dItem.missingCount} Belum Diisi`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-3 bg-white/90 border border-amber-200 rounded-xl text-xs text-slate-700 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Aturan Penilaian Final:</strong> Melengkapi jurnal melalui <strong>Formulir Terlewat</strong> pada tanggal <strong>{missedDate}</strong> dinilai penuh sesuai komponen aktual <strong>tanpa pengurangan 5 poin</strong>.
                  </span>
                </div>
              </div>

              {/* 7 Habit Cards for the Selected Past Date */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Jurnal 7 Kebiasaan — Tanggal {missedDate}
                  </h3>
                  <span className="text-xs text-slate-500">
                    Klik &quot;Buka Formulir Terlewat&quot; untuk melengkapi kebiasaan yang belum selesai
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                  {HABIT_CARDS.map((habit) => {
                    const Icon = habit.icon;
                    const info = getHabitProgressInfo(habit.id, selectedDateLogs, true);
                    const isCompleteOnDate = info.status === 'Selesai';
                    const isHalanganOnDate = habit.id === 'ibadah' && isHalanganOnLogs(selectedDateLogs);

                    return (
                      <div
                        key={`missed-card-${habit.id}`}
                        className={`habit-card rounded-3xl p-5 border shadow-xs transition-all flex flex-col justify-between ${
                          isCompleteOnDate
                            ? 'bg-emerald-50/75 border-emerald-300'
                            : 'bg-white border-amber-300 hover:border-[#1c5ddc]'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between mb-3">
                            <div
                              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xs"
                              style={{ backgroundColor: isCompleteOnDate ? '#19ae5d' : habit.color }}
                            >
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span
                                className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                                  isCompleteOnDate
                                    ? 'bg-emerald-200 text-emerald-900'
                                    : 'bg-amber-100 text-amber-900'
                                }`}
                              >
                                {isCompleteOnDate ? '✓ Selesai' : 'Belum diisi/terlewat'}
                              </span>
                              <span className="text-[11px] font-black text-slate-700">
                                Nilai: {info.currentScore} / 100
                              </span>
                            </div>
                          </div>

                          <h4 className="font-extrabold text-slate-900 text-base">{habit.title}</h4>
                          <p className="text-xs font-medium text-slate-500 mb-1">{habit.subtitle}</p>
                          <p className="text-[11px] text-slate-400 mb-3">{habit.desc}</p>

                          {habit.id === 'ibadah' && isFemaleIslam && !isCompleteOnDate && (
                            <div className="mb-3 p-2.5 rounded-xl bg-pink-50 border border-pink-200 flex items-center justify-between">
                              <span className="text-[11px] font-bold text-pink-900">
                                Opsi Siswi Putri (Sedang Berhalangan)
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setModalInitialHalangan(true);
                                  setActiveFormModal('ibadah');
                                }}
                                className="text-[11px] font-black text-pink-700 underline cursor-pointer"
                              >
                                Isi 5 Komponen Pengganti →
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-slate-500">
                            {habit.isMulti
                              ? isHalanganOnDate
                                ? `Komponen: ${info.sessionCount} / 5`
                                : `Sesi: ${info.sessionCount} / ${info.maxSessions}`
                              : `Tanggal: ${missedDate}`}
                          </span>

                          {isCompleteOnDate ? (
                            <button
                              type="button"
                              disabled
                              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-200 text-emerald-900 cursor-not-allowed flex items-center gap-1"
                            >
                              <Lock className="w-3.5 h-3.5" /> Selesai &amp; Terkunci
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setModalInitialHalangan(isHalanganOnDate);
                                setActiveFormModal(habit.id);
                              }}
                              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#1c5ddc] hover:bg-blue-700 shadow-xs cursor-pointer transition-all"
                            >
                              Buka Formulir Terlewat
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LEADERBOARD */}
          {activeTab === 'leaderboard' && (
            <LeaderboardTable
              students={allStudents}
              currentUserId={student.id}
              onSelectStudent={(s) => onOpenReport?.(s.id)}
            />
          )}

          {/* TAB 5: PROFIL SISWA & PENGATURAN TEMA */}
          {activeTab === 'profil' && (
            <div className="space-y-6">
              {/* Profile Card Header */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-5">
                <div
                  className="w-20 h-20 rounded-3xl text-white flex items-center justify-center font-black text-3xl shadow-md transition-colors"
                  style={{ backgroundColor: activeTheme.hex }}
                >
                  {student.name.charAt(0)}
                </div>
                <div className="text-center sm:text-left flex-1">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                    <h2 className="text-xl font-black text-slate-900">{student.name}</h2>
                    <span
                      className="text-xs px-2.5 py-0.5 rounded-full font-bold text-white"
                      style={{ backgroundColor: activeTheme.hex }}
                    >
                      Kelas {student.class_name}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-purple-100 text-purple-800 border border-purple-200">
                      {student.rombel_name || 'Rombel B'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    NISN: {student.nisn} • Agama: {student.religion} • Angkatan: {student.angkatan}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Guru Walas ({student.class_name}): <strong>{student.walas_name}</strong> (NIP {student.walas_nip})
                    {student.wali_name ? ` • Guru Wali (${student.rombel_name || 'Rombel B'}): ${student.wali_name}` : ''}
                  </p>
                </div>
              </div>

              {/* PENGATURAN TEMA WARNA */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                  <Palette className="w-5 h-5 text-[#1c5ddc]" />
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                      Pengaturan Tema Warna Jawara 28
                    </h3>
                    <p className="text-xs text-slate-500">
                      Pilih palet warna dasar aplikasi. Warna dasar dan latar belakang akan otomatis menyesuaikan dengan warna pilihanmu.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {THEME_OPTIONS.map((theme) => {
                    const isSelected = activeTheme.hex.toLowerCase() === theme.hex.toLowerCase();
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => handleThemeChange(theme.hex)}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'ring-2 ring-slate-900 shadow-md bg-slate-50'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                        style={{
                          borderColor: isSelected ? theme.hex : undefined,
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className="w-7 h-7 rounded-full shadow-inner flex items-center justify-center text-white"
                            style={{ backgroundColor: theme.hex }}
                          >
                            {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 font-bold">
                            {theme.hex}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs font-extrabold text-slate-900 block">
                            {theme.name}
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            {theme.tagline}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Grafik Perkembangan Siswa (Line / Bar Toggle + Habit Filter) */}
              <StudentProgressChart
                series={progressSeries}
                title="Grafik Perkembangan Harian (7 Kebiasaan & Rata-rata)"
              />

              {/* Radar & Gauge */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
                  <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-700 mb-2">
                    Grafik Jaring 7 KAIH
                  </h4>
                  <RadarChart
                    data={(studentStats?.habitMetrics || []).map((m: any) => ({
                      habit: m.habit,
                      label: m.label,
                      score: m.studentScore,
                    }))}
                    size={280}
                  />
                </div>

                <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-center">
                  <GaugeChart
                    score={studentStats?.overallScore || 0}
                    title="Nilai Capaian Keseluruhan (Maks 100)"
                    size={240}
                  />
                </div>
              </div>

              {/* Trend Garis Komparasi */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-700 mb-1">
                  Grafik Komparasi Capaian 7 KAIH
                </h4>
                <p className="text-xs text-slate-500 mb-3">
                  Perbandingan Capaian Siswa vs Rata-Rata Kelas vs Rata-Rata Angkatan vs Rata-Rata Sekolah
                </p>
                <TrendLineChart metrics={studentStats?.habitMetrics || []} />
              </div>

              {/* Tabel Rincian Metrik Lengkap 7 KAIH */}
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700">
                  Rincian Metrik Lengkap 7 KAIH (Nilai Saat Ini / 100)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/60 text-slate-500 font-semibold border-b border-slate-100">
                      <tr>
                        <th className="py-2.5 px-4">Kebiasaan</th>
                        <th className="py-2.5 px-4 text-center">Nilai Capaian Saya</th>
                        <th className="py-2.5 px-4 text-center">Rata-rata Kelas</th>
                        <th className="py-2.5 px-4 text-center">Rata-rata Sekolah</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(studentStats?.habitMetrics || []).map((m: any) => (
                        <tr key={m.habit}>
                          <td className="py-2.5 px-4 font-bold text-slate-800">{m.label}</td>
                          <td className="py-2.5 px-4 text-center font-black text-[#1c5ddc]">
                            {m.studentScore} / 100
                          </td>
                          <td className="py-2.5 px-4 text-center text-slate-600">{m.classAvg} / 100</td>
                          <td className="py-2.5 px-4 text-center text-slate-600">{m.schoolAvg} / 100</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Catatan & Rekomendasi Walas */}
              <div className="bg-amber-50/60 rounded-3xl p-5 border border-amber-200/80 space-y-3">
                <h4 className="font-extrabold text-sm text-amber-950 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  Catatan &amp; Rekomendasi Guru Walas ({student.walas_name})
                </h4>
                <div className="p-3 bg-white rounded-2xl border border-amber-200 text-xs text-slate-700">
                  <strong className="block text-slate-900 mb-0.5">Catatan Evaluasi:</strong>
                  {student.walas_notes || 'Belum ada catatan tertulis dari wali kelas.'}
                </div>
                <div className="p-3 bg-white rounded-2xl border border-amber-200 text-xs text-slate-700">
                  <strong className="block text-slate-900 mb-0.5">Rekomendasi Tindak Lanjut:</strong>
                  {student.walas_recommendation || 'Belum ada rekomendasi tertulis dari wali kelas.'}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Right Info / Stats Column (Desktop >1024px) */}
        <aside className="hidden lg:block lg:col-span-3 space-y-5">
          {/* Jadwal Shalat (Configurable by Admin / Guru Tim 7 KAIH) */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
              Jadwal Ibadah Shalat
            </h4>
            <div className="space-y-1.5 text-xs">
              {[
                { name: 'Subuh', time: `${prayerSchedule.subuh} WIB` },
                { name: 'Zuhur', time: `${prayerSchedule.zuhur} WIB` },
                { name: 'Asar', time: `${prayerSchedule.asar} WIB` },
                { name: 'Maghrib', time: `${prayerSchedule.maghrib} WIB` },
                { name: 'Isya', time: `${prayerSchedule.isya} WIB` },
              ].map((s) => (
                <div key={s.name} className="flex justify-between py-1 border-b border-slate-100 last:border-none">
                  <span className="text-slate-600 font-medium">{s.name}</span>
                  <span className="font-bold text-slate-800">{s.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Prinsip Jawara 28 */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-5 border border-amber-200 shadow-xs">
            <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block mb-1">
              Prinsip Jawara 28
            </span>
            <h5 className="font-extrabold text-xs text-amber-950 mb-1">
              &quot;Karakter Unggul Dibentuk dari Kebiasaan Kecil yang Konsisten&quot;
            </h5>
            <p className="text-[11px] text-amber-800/80 leading-relaxed">
              Nilai Capaian harian maksimal 100. Setiap poin bonus tambahan yang melampaui 100 otomatis tersimpan ke dalam Poin Hebat!
            </p>
          </div>
        </aside>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-2 flex items-center justify-around shadow-lg">
        {[
          { id: 'beranda' as const, label: 'Beranda', icon: Home },
          {
            id: 'kebiasaanku' as const,
            label: 'Hari Ini',
            icon: CheckSquare,
            badge: uncompletedHabits.length > 0 ? `${uncompletedHabits.length}` : null,
          },
          {
            id: 'terlewat' as const,
            label: 'Riwayat',
            icon: Calendar,
            badge: hasAnyMissed ? '!' : null,
          },
          { id: 'leaderboard' as const, label: 'Peringkat', icon: Trophy },
          { id: 'profil' as const, label: 'Profil', icon: User },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] rounded-xl text-[10px] font-bold transition-all relative ${
                isActive ? 'text-[#1c5ddc]' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="absolute top-1 right-2 w-4 h-4 bg-[#eb30a2] text-white text-[9px] rounded-full flex items-center justify-center font-black">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Clean Single-Modal Container for Habit Check-In */}
      {activeFormModal && (
        <HonestyCheckInModal
          habitId={activeFormModal}
          studentReligion={student.religion}
          studentGender={student.gender}
          todayLogs={activeTab === 'terlewat' ? selectedDateLogs : todayLogs}
          isMissedEntry={activeTab === 'terlewat'}
          targetDate={activeTab === 'terlewat' ? missedDate : undefined}
          initialHalangan={modalInitialHalangan}
          prayerSchedule={prayerSchedule as any}
          isPuasaSunnah={isFastingOnLogs(activeTab === 'terlewat' ? selectedDateLogs : todayLogs)}
          onSuccess={(score, payload, isMulti, subCategory) =>
            handleHabitSubmit(activeFormModal, score, payload, isMulti, subCategory)
          }
          onCancel={() => {
            setActiveFormModal(null);
            setModalInitialHalangan(false);
          }}
        />
      )}
    </div>
  );
};
