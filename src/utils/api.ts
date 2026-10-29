/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Student,
  Teacher,
  HabitLog,
  HabitMetricComparison,
  ClassAnalytics,
  RombelAnalytics,
  SchoolAnalytics,
  AktivitasSeruEntry,
  DashboardWidgetConfig,
  DataCorrectionRecord,
} from '../types';

const AUTH_TOKEN_STORAGE_KEY = 'jawara28_auth_token';
let inMemoryAuthToken: string | null = null;

function getStoredToken(): string | null {
  if (inMemoryAuthToken) return inMemoryAuthToken;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage access errors
  }
  return null;
}

function buildHeaders(includeJsonContentType = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  setAuthToken(token: string | null) {
    inMemoryAuthToken = token;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (token) {
          window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
        } else {
          window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        }
      }
    } catch {
      // ignore storage access errors
    }
  },

  clearAuthToken() {
    this.setAuthToken(null);
  },

  async getStatus() {
    const res = await fetch('/api/status', { headers: buildHeaders() });
    return res.json();
  },

  async loginAdmin(username: string, password: string) {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login Admin gagal' }));
      throw new Error(err.error || 'Login Admin gagal');
    }
    const json = await res.json();
    if (json.token) {
      this.setAuthToken(json.token);
    }
    return json;
  },

  async logout() {
    await fetch('/api/logout', {
      method: 'POST',
      headers: buildHeaders(true),
    }).catch(() => {});
    this.clearAuthToken();
  },

  async getTeachers(): Promise<Teacher[]> {
    const res = await fetch('/api/teachers', { headers: buildHeaders() });
    return res.json();
  },

  async getStudents(includeArchived = false): Promise<Student[]> {
    const res = await fetch(`/api/students${includeArchived ? '?include_archived=true' : ''}`, {
      headers: buildHeaders(),
    });
    return res.json();
  },

  async getStudent(id: string): Promise<Student> {
    const res = await fetch(`/api/students/${id}`, { headers: buildHeaders() });
    return res.json();
  },

  async getTodayHabits(studentId: string, date?: string): Promise<{
    date: string;
    student_id: string;
    logs: HabitLog[];
    habitsByType: Record<string, HabitLog[]>;
    totalToday: number;
    dailyEval?: any;
    aktivitasSeru?: AktivitasSeruEntry | null;
  }> {
    const url = `/api/habits/today?student_id=${studentId}${date ? `&date=${date}` : ''}`;
    const res = await fetch(url, { headers: buildHeaders() });
    return res.json();
  },

  async getCalendarSummary(studentId: string, days = 14): Promise<{
    student_id: string;
    hasAnyMissed: boolean;
    dates: {
      date: string;
      dayName: string;
      formattedDate: string;
      completedCount: number;
      missingCount: number;
      isComplete: boolean;
      overallDayStatus?: string;
      habitStatuses?: Record<string, string>;
      habitsDone: string[];
      missingHabits: string[];
      dailyScore: number;
      scoresByHabit?: Record<string, number>;
    }[];
  }> {
    const res = await fetch(`/api/habits/calendar-summary?student_id=${studentId}&days=${days}`, {
      headers: buildHeaders(),
    });
    return res.json();
  },

  async getStudentProgress(studentId: string, days = 14): Promise<{
    student_id: string;
    days: number;
    series: {
      dayIndex: number;
      date: string;
      label: string;
      fullLabel: string;
      bangun: number;
      ibadah: number;
      olahraga: number;
      makan: number;
      belajar: number;
      masyarakat: number;
      tidur: number;
      rataRata: number;
      completedCount: number;
      status: string;
    }[];
  }> {
    const res = await fetch(`/api/student/${studentId}/progress?days=${days}`, {
      headers: buildHeaders(),
    });
    return res.json();
  },

  async submitHabit(data: {
    student_id: string;
    habit_type: string;
    score: number;
    base_score?: number;
    bonus_score?: number;
    overflow_bonus_points?: number;
    payload: any;
    sub_category?: string;
    is_counter_entry?: number;
    is_missed?: number;
    log_date?: string;
    overwrite?: boolean;
  }) {
    const res = await fetch('/api/habits', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Gagal mencatat kebiasaan' }));
      throw new Error(err.error || 'Gagal mencatat');
    }
    return res.json();
  },

  async resetHabitOnDate(studentId: string, habitType: string, date?: string) {
    const url = `/api/habits/reset?student_id=${studentId}&habit_type=${habitType}${date ? `&date=${date}` : ''}`;
    const res = await fetch(url, { method: 'DELETE', headers: buildHeaders() });
    return res.json();
  },

  async getAktivitasSeru(studentId: string, date?: string): Promise<AktivitasSeruEntry[]> {
    const url = `/api/aktivitas-seru?student_id=${studentId}${date ? `&date=${date}` : ''}`;
    const res = await fetch(url, { headers: buildHeaders() });
    return res.json();
  },

  async submitAktivitasSeru(data: {
    student_id: string;
    habit_type: string;
    story: string;
    log_date?: string;
  }) {
    const res = await fetch('/api/aktivitas-seru', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Gagal menyimpan cerita Aktivitas Seru' }));
      throw new Error(err.error || 'Gagal menyimpan');
    }
    return res.json();
  },

  async getStudentReport(id: string): Promise<{
    student: Student;
    habitMetrics: HabitMetricComparison[];
    overallScore: number;
    poinHebat?: number;
    totalEntries: number;
    streak?: number;
    activeDays?: number;
    verification_score?: number | null;
    recentLogs: HabitLog[];
  }> {
    const res = await fetch(`/api/student/${id}/report`, { headers: buildHeaders() });
    return res.json();
  },

  async getClassAnalytics(className: string, date?: string): Promise<ClassAnalytics & {
    filterDate?: string;
    statusSummary?: { selesai: number; sedangDiisi: number; belumDimulai: number; terlewat: number };
  }> {
    const url = `/api/class/${encodeURIComponent(className)}/analytics${date ? `?date=${date}` : ''}`;
    const res = await fetch(url, { headers: buildHeaders() });
    return res.json();
  },

  async getRombelAnalytics(rombelName: string, days = 14): Promise<RombelAnalytics> {
    const res = await fetch(`/api/rombel/${encodeURIComponent(rombelName)}/analytics?days=${days}`, {
      headers: buildHeaders(),
    });
    return res.json();
  },

  async getSchoolAnalytics(): Promise<SchoolAnalytics & {
    rombels?: string[];
    cohorts?: { cohortName: string; studentCount: number; participatingCount: number; avgScore: number }[];
  }> {
    const res = await fetch('/api/school/analytics', { headers: buildHeaders() });
    return res.json();
  },

  async saveAdminValidation(data: {
    student_id: string;
    verification_score: number;
    verified_by?: string;
    notes?: string;
  }) {
    const res = await fetch('/api/admin/validate', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async saveTeacherNotes(data: {
    student_id: string;
    walas_notes: string;
    walas_recommendation: string;
  }) {
    const res = await fetch('/api/teacher/notes', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async getAdminValidationsSummary(): Promise<{
    totalCount: number;
    avgScore: number;
    distribution: Record<number, number>;
    validations: any[];
  }> {
    const res = await fetch('/api/admin/validations-summary', { headers: buildHeaders() });
    return res.json();
  },

  // ============================================================================
  // CONTROL PANEL ADMIN API METHODS
  // ============================================================================
  async getAdminOverview() {
    const res = await fetch('/api/admin/overview', { headers: buildHeaders() });
    return res.json();
  },

  async saveAdminStudent(studentData: any) {
    const res = await fetch('/api/admin/students', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(studentData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Gagal menyimpan akun siswa' }));
      throw new Error(err.error || 'Gagal menyimpan');
    }
    return res.json();
  },

  async deleteAdminStudent(studentId: string, mode: 'ARCHIVE' | 'INACTIVE' | 'DELETE' = 'ARCHIVE') {
    const res = await fetch(`/api/admin/students/${studentId}?mode=${mode}`, {
      method: 'DELETE',
      headers: buildHeaders(),
    });
    return res.json();
  },

  async saveAdminTeacher(teacherData: any) {
    const res = await fetch('/api/admin/teachers', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(teacherData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Gagal menyimpan akun guru' }));
      throw new Error(err.error || 'Gagal menyimpan');
    }
    return res.json();
  },

  async deleteAdminTeacher(teacherId: string) {
    const res = await fetch(`/api/admin/teachers/${teacherId}`, {
      method: 'DELETE',
      headers: buildHeaders(),
    });
    return res.json();
  },

  async getAdminClassesAndRombels() {
    const res = await fetch('/api/admin/classes-rombels', { headers: buildHeaders() });
    return res.json();
  },

  async saveAdminClass(classData: any) {
    const res = await fetch('/api/admin/classes', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(classData),
    });
    return res.json();
  },

  async saveAdminRombel(rombelData: any) {
    const res = await fetch('/api/admin/rombels', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(rombelData),
    });
    return res.json();
  },

  async moveStudentGroup(student_id: string, target_class_name?: string, target_rombel_name?: string) {
    const res = await fetch('/api/admin/move-student-group', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify({ student_id, target_class_name, target_rombel_name }),
    });
    return res.json();
  },

  async getAdminJournals(filters: {
    student_id?: string;
    class_name?: string;
    rombel_name?: string;
    habit_type?: string;
    date_from?: string;
    date_to?: string;
  } = {}): Promise<{ logs: any[]; corrections: DataCorrectionRecord[] }> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    const res = await fetch(`/api/admin/journals?${params.toString()}`, {
      headers: buildHeaders(),
    });
    return res.json();
  },

  async correctAdminJournal(data: {
    log_id?: number;
    student_id?: string;
    log_date?: string;
    habit_type?: string;
    sub_category?: string;
    new_score: number;
    new_base_score?: number;
    new_bonus_score?: number;
    new_payload?: any;
    reason: string;
    actor_name?: string;
  }) {
    const res = await fetch('/api/admin/journals/correct', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Gagal menyimpan koreksi jurnal' }));
      throw new Error(err.error || 'Gagal menyimpan koreksi');
    }
    return res.json();
  },

  async getDashboardWidgets(): Promise<DashboardWidgetConfig[]> {
    const res = await fetch('/api/dashboard-widgets', { headers: buildHeaders() });
    return res.json();
  },

  async saveDashboardWidget(widget: Partial<DashboardWidgetConfig>) {
    const res = await fetch('/api/admin/dashboard-widgets', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(widget),
    });
    return res.json();
  },

  async getGlobalSettings() {
    const res = await fetch('/api/settings', { headers: buildHeaders() });
    return res.json();
  },

  async saveGlobalSettings(data: { settings?: Record<string, string>; prayerSchedule?: any }) {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async importAdminStudents(rows: any[]) {
    const res = await fetch('/api/admin/import-students', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify({ rows }),
    });
    return res.json();
  },
};
