/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Streak, Journal Summary & Student Aggregate Recalculation Service — VERTIKAL SMA JAWARA 28
 *
 * Implements Spesifikasi Final 7 KAIH:
 * - Evaluates daily habit scores per date (multi-session habits `ibadah` and `makan` are averaged
 *   across sessions on that date; single-session habits take their entry score).
 * - Calculates consecutive active/complete day streaks (`streak_records`).
 * - Updates `students` (`xp`, `poin_hebat`, `level`, `streak`, `best_streak`, `predicate`).
 */

import { RelationalDatabase } from '../../database/client.ts';
import { VALID_HABIT_CODES } from '../../shared/schemas/validation-schemas.ts';
import type { HabitCode } from '../../shared/schemas/validation-schemas.ts';

export interface DailyHabitEvaluation {
  date: string;
  scoresByHabit: Record<HabitCode, number>;
  habitStatuses: Record<HabitCode, 'BELUM_DIMULAI' | 'SEDANG_DIISI' | 'SELESAI' | 'BELUM_DIISI_TERLEWAT'>;
  completedHabits: HabitCode[];
  inProgressHabits: HabitCode[];
  missingHabits: HabitCode[];
  completedCount: number;
  dailyAverageScore: number;
  isCompleteDay: boolean;
  overallDayStatus: 'SELESAI' | 'SEDANG_DIISI' | 'BELUM_DIMULAI' | 'BELUM_DIISI_TERLEWAT';
}

export function computePredicate(avgScore: number): string {
  if (avgScore >= 90) return 'Sangat Terbiasa (Teladan)';
  if (avgScore >= 80) return 'Terbiasa Baik';
  if (avgScore >= 70) return 'Cukup Terbiasa';
  return 'Perlu Pembinaan';
}

export class StreaksService {
  private readonly db: RelationalDatabase;

  constructor(db: RelationalDatabase) {
    this.db = db;
  }

  /**
   * Evaluates a single student's journal on a given date from `habit_entries`.
   */
  public evaluateStudentDay(
    studentId: string,
    dateStr: string,
    todayDateStr: string,
    prebuiltRows?: any[]
  ): DailyHabitEvaluation {
    const rows =
      prebuiltRows ||
      this.db.queryAll<any>(
        `SELECT habit_code, sub_category, final_score, card_status, payload_json
         FROM habit_entries
         WHERE student_id = ? AND log_date = ?`,
        [studentId, dateStr]
      );

    const byHabit: Record<string, any[]> = {};
    for (const h of VALID_HABIT_CODES) byHabit[h] = [];
    for (const r of rows) {
      if (byHabit[r.habit_code]) {
        byHabit[r.habit_code].push(r);
      }
    }

    const scoresByHabit = {} as Record<HabitCode, number>;
    const habitStatuses = {} as Record<
      HabitCode,
      'BELUM_DIMULAI' | 'SEDANG_DIISI' | 'SELESAI' | 'BELUM_DIISI_TERLEWAT'
    >;
    const completedHabits: HabitCode[] = [];
    const inProgressHabits: HabitCode[] = [];
    const missingHabits: HabitCode[] = [];

    const isPastDay = dateStr < todayDateStr;

    for (const h of VALID_HABIT_CODES) {
      const hRows = byHabit[h];
      if (!hRows || hRows.length === 0) {
        scoresByHabit[h] = 0;
        habitStatuses[h] = isPastDay ? 'BELUM_DIISI_TERLEWAT' : 'BELUM_DIMULAI';
        missingHabits.push(h);
        continue;
      }

      if (h === 'makan') {
        // 3 meal sessions (pagi, siang, malam) or full entry
        const hasFull = hRows.some((r) => !r.sub_category || r.sub_category === '');
        const distinctSessions = new Set(
          hRows.map((r) => String(r.sub_category || 'pagi').toLowerCase())
        );
        const avg =
          hRows.reduce((acc, r) => acc + Number(r.final_score || 0), 0) /
          Math.max(1, hRows.length);
        scoresByHabit[h] = Math.min(100, Math.round(avg * 10) / 10);

        if (hasFull || distinctSessions.size >= 3) {
          habitStatuses[h] = 'SELESAI';
          completedHabits.push(h);
        } else {
          habitStatuses[h] = 'SEDANG_DIISI';
          inProgressHabits.push(h);
        }
      } else if (h === 'ibadah') {
        const avg =
          hRows.reduce((acc, r) => acc + Number(r.final_score || 0), 0) /
          Math.max(1, hRows.length);
        scoresByHabit[h] = Math.min(100, Math.round(avg * 10) / 10);
        habitStatuses[h] = 'SELESAI';
        completedHabits.push(h);
      } else {
        const topScore = Math.max(...hRows.map((r) => Number(r.final_score || 0)));
        scoresByHabit[h] = Math.min(100, Math.round(topScore * 10) / 10);
        habitStatuses[h] = 'SELESAI';
        completedHabits.push(h);
      }
    }

    const activeCount = completedHabits.length + inProgressHabits.length;
    const sumScores = VALID_HABIT_CODES.reduce((acc, h) => acc + scoresByHabit[h], 0);
    const dailyAverageScore =
      activeCount > 0 ? Math.round((sumScores / 7) * 10) / 10 : 0;

    let overallDayStatus: DailyHabitEvaluation['overallDayStatus'] = 'BELUM_DIMULAI';
    if (completedHabits.length === 7) {
      overallDayStatus = 'SELESAI';
    } else if (activeCount > 0) {
      overallDayStatus = 'SEDANG_DIISI';
    } else if (isPastDay) {
      overallDayStatus = 'BELUM_DIISI_TERLEWAT';
    }

    return {
      date: dateStr,
      scoresByHabit,
      habitStatuses,
      completedHabits,
      inProgressHabits,
      missingHabits,
      completedCount: completedHabits.length,
      dailyAverageScore,
      isCompleteDay: completedHabits.length === 7,
      overallDayStatus,
    };
  }

  /**
   * Synchronizes the `journals` row for (studentId, dateStr), recalculates `streak_records`,
   * and updates `students` aggregate metrics (`xp`, `poin_hebat`, `level`, `streak`, `best_streak`, `predicate`).
   */
  public syncStudentJournalAndAggregates(studentId: string, targetDateStr: string, todayDateStr: string): void {
    const student = this.db.queryOne<any>(
      `SELECT id, class_id, rombel_id FROM students WHERE id = ?`,
      [studentId]
    );
    if (!student) return;

    const evalDay = this.evaluateStudentDay(studentId, targetDateStr, todayDateStr);
    const journalId = `jrn-${studentId}-${targetDateStr}`;

    this.db.execute(
      `INSERT INTO journals
       (id, student_id, journal_date, academic_year_id, class_id_snapshot, rombel_id_snapshot,
        completed_habits_count, in_progress_habits_count, missed_habits_count,
        daily_average_score, journal_status, is_locked, completed_at, updated_at)
       VALUES (?, ?, ?, 'ay-2026-2027-1', ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(student_id, journal_date) DO UPDATE SET
        completed_habits_count = excluded.completed_habits_count,
        in_progress_habits_count = excluded.in_progress_habits_count,
        missed_habits_count = excluded.missed_habits_count,
        daily_average_score = excluded.daily_average_score,
        journal_status = excluded.journal_status,
        is_locked = excluded.is_locked,
        completed_at = excluded.completed_at,
        updated_at = datetime('now')`,
      [
        journalId,
        studentId,
        targetDateStr,
        student.class_id || null,
        student.rombel_id || null,
        evalDay.completedCount,
        evalDay.inProgressHabits.length,
        evalDay.missingHabits.length,
        evalDay.dailyAverageScore,
        evalDay.overallDayStatus,
        evalDay.isCompleteDay ? 1 : 0,
        evalDay.isCompleteDay ? new Date().toISOString() : null,
      ]
    );

    this.recalculateStudentAggregates(studentId, todayDateStr);
  }

  public recalculateStudentAggregates(studentId: string, todayDateStr: string): void {
    const allEntries = this.db.queryAll<{
      log_date: string;
      final_score: number;
      overflow_bonus_points: number;
    }>(
      `SELECT log_date, final_score, overflow_bonus_points
       FROM habit_entries
       WHERE student_id = ?
       ORDER BY log_date ASC`,
      [studentId]
    );

    const distinctDates = Array.from(new Set(allEntries.map((e) => e.log_date))).sort();
    let currentStreak = 0;
    let longestStreak = 0;
    let prevDateMs: number | null = null;

    for (const d of distinctDates) {
      const dMs = new Date(`${d}T00:00:00Z`).getTime();
      if (prevDateMs === null) {
        currentStreak = 1;
      } else {
        const diffDays = Math.round((dMs - prevDateMs) / 86400000);
        if (diffDays === 1) {
          currentStreak += 1;
        } else if (diffDays > 1) {
          currentStreak = 1;
        }
      }
      if (currentStreak > longestStreak) {
        longestStreak = currentStreak;
      }
      prevDateMs = dMs;
    }

    const totalXpFromEntries = Math.round(
      allEntries.reduce((acc, r) => acc + Number(r.final_score || 0), 0)
    );
    const avgScore =
      allEntries.length > 0
        ? allEntries.reduce((acc, r) => acc + Number(r.final_score || 0), 0) / allEntries.length
        : 0;

    const poinHebatRow = this.db.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM point_transactions
       WHERE student_id = ? AND point_bucket = 'POIN_HEBAT'`,
      [studentId]
    );
    const overflowSum = Math.round(
      allEntries.reduce((acc, r) => acc + Number(r.overflow_bonus_points || 0), 0)
    );
    const poinHebat = Math.max(Number(poinHebatRow?.total || 0), overflowSum);

    const totalXp = totalXpFromEntries + poinHebat;
    const level = Math.max(1, Math.floor(totalXp / 250) + 1);
    const predicate = computePredicate(avgScore);
    const lastDate = distinctDates.length > 0 ? distinctDates[distinctDates.length - 1] : null;

    const completeDaysRow = this.db.queryOne<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM journals WHERE student_id = ? AND completed_habits_count = 7`,
      [studentId]
    );

    this.db.execute(
      `INSERT INTO streak_records
       (id, student_id, current_streak, longest_streak, total_complete_days, total_active_days, last_completed_date, last_evaluated_date, streak_status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(student_id) DO UPDATE SET
        current_streak = excluded.current_streak,
        longest_streak = MAX(streak_records.longest_streak, excluded.longest_streak),
        total_complete_days = excluded.total_complete_days,
        total_active_days = excluded.total_active_days,
        last_completed_date = excluded.last_completed_date,
        last_evaluated_date = excluded.last_evaluated_date,
        streak_status = excluded.streak_status,
        updated_at = datetime('now')`,
      [
        `str-${studentId}`,
        studentId,
        currentStreak,
        longestStreak,
        Number(completeDaysRow?.cnt || 0),
        distinctDates.length,
        lastDate,
        todayDateStr,
        currentStreak > 0 ? 'ACTIVE' : 'INACTIVE',
      ]
    );

    this.db.execute(
      `UPDATE students
       SET xp = ?,
           poin_hebat = ?,
           level = ?,
           streak = ?,
           best_streak = MAX(best_streak, ?),
           predicate = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
      [totalXp, poinHebat, level, currentStreak, longestStreak, predicate, studentId]
    );
  }
}
