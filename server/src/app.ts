/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Modular Application Router & Request Dispatcher — VERTIKAL SMA JAWARA 28
 *
 * Provides:
 * 1. `JawaraApplication` with `dispatch(req)` for zero-overhead HTTP & integration test routing.
 * 2. `mountOnExpress(expressApp, jawaraApp)` for Express integration in `server.ts`.
 */

import { RelationalDatabase, getDb } from './database/client.ts';
import { AuthService } from './modules/auth/auth.service.ts';
import { JournalsService } from './modules/journals/journals.service.ts';
import { UsersAcademicService } from './modules/users/users-academic.service.ts';
import { AnalyticsReportsService } from './modules/analytics/analytics-reports.service.ts';
import { AuditService } from './modules/audit/audit.service.ts';
import { resolveAuthSession, extractBearerToken } from './middleware/authentication.ts';
import {
  assertAuthenticated,
  assertHasAnyRole,
  assertStudentAccessScope,
  assertClassAccessScope,
  assertRombelAccessScope,
} from './middleware/authorization.ts';
import { formatErrorResponse } from './middleware/error-handler.ts';
import { NotFoundError } from './shared/errors/app-error.ts';

export interface AppRequest {
  method: string;
  path: string;
  query?: Record<string, string | undefined>;
  headers?: Record<string, string | string[] | undefined>;
  body?: any;
  ip?: string;
}

export interface AppResponse {
  statusCode: number;
  body: any;
}

export class JawaraApplication {
  public readonly db: RelationalDatabase;
  public readonly authService: AuthService;
  public readonly journalsService: JournalsService;
  public readonly usersAcademicService: UsersAcademicService;
  public readonly analyticsReportsService: AnalyticsReportsService;
  public readonly auditService: AuditService;
  private simulatedTodayDate: string | null = null;

  constructor(customDb?: RelationalDatabase) {
    this.db = customDb || getDb();
    this.authService = new AuthService(this.db);
    this.journalsService = new JournalsService(this.db);
    this.usersAcademicService = new UsersAcademicService(this.db);
    this.analyticsReportsService = new AnalyticsReportsService(this.db);
    this.auditService = new AuditService(this.db);
  }

  public getTodayDateStr(): string {
    if (this.simulatedTodayDate) return this.simulatedTodayDate;
    // Default school reference date or current Jakarta date
    return process.env.SCHOOL_TODAY_DATE || '2026-10-27';
  }

  public setSimulatedTodayDate(dateStr: string | null): void {
    this.simulatedTodayDate = dateStr;
  }

  public async dispatch(req: AppRequest): Promise<AppResponse> {
    const method = (req.method || 'GET').toUpperCase();
    const rawPath = (req.path || '/').split('?')[0];
    const query = req.query || {};
    const headers = req.headers || {};
    const body = req.body || {};
    const todayDateStr = this.getTodayDateStr();

    try {
      // ======================================================================
      // 1. PUBLIC & BOOTSTRAP ENDPOINTS
      // ======================================================================
      if (method === 'GET' && rawPath === '/api/status') {
        return {
          statusCode: 200,
          body: {
            status: 'ok',
            app: 'VERTIKAL SMA JAWARA 28',
            scoringVersion: '7KAIH-FINAL-2026.1',
            todayDate: todayDateStr,
          },
        };
      }

      if (method === 'POST' && rawPath === '/api/login') {
        const result = this.authService.login({
          username: body.username,
          password: body.password,
          roleCategory: body.role === 'guru' ? 'guru' : 'siswa',
          ipAddress: req.ip,
          userAgent: String(headers['user-agent'] || ''),
        });
        return { statusCode: 200, body: result };
      }

      if (method === 'POST' && rawPath === '/api/admin/login') {
        const result = this.authService.login({
          username: body.username,
          password: body.password,
          roleCategory: 'admin',
          ipAddress: req.ip,
          userAgent: String(headers['user-agent'] || ''),
        });
        return { statusCode: 200, body: result };
      }

      if (method === 'POST' && rawPath === '/api/logout') {
        const token = extractBearerToken(headers);
        if (token) {
          this.authService.revokeSession(token, 'USER_LOGOUT');
        }
        return { statusCode: 200, body: { status: 'ok' } };
      }

      if (method === 'GET' && rawPath === '/api/auth/me') {
        const auth = resolveAuthSession(this.db, headers, true);
        return { statusCode: 200, body: { status: 'ok', session: auth } };
      }

      if (method === 'GET' && rawPath === '/api/settings') {
        return {
          statusCode: 200,
          body: this.analyticsReportsService.getGlobalSettings(),
        };
      }

      if (method === 'GET' && rawPath === '/api/dashboard-widgets') {
        return {
          statusCode: 200,
          body: this.analyticsReportsService.getDashboardWidgets(),
        };
      }

      if (method === 'GET' && rawPath === '/api/school/analytics') {
        return {
          statusCode: 200,
          body: this.analyticsReportsService.getSchoolAnalytics(todayDateStr),
        };
      }

      if (method === 'GET' && rawPath === '/api/leaderboard') {
        return {
          statusCode: 200,
          body: this.analyticsReportsService.getLeaderboard({
            periodType: (query.period as any) || 'ALL_TIME',
            scopeType: (query.scope as any) || 'SCHOOL',
            scopeId: query.scope_id,
            limit: query.limit ? Number(query.limit) : 50,
            todayDateStr,
          }),
        };
      }

      if (method === 'GET' && rawPath === '/api/teachers') {
        return {
          statusCode: 200,
          body: this.usersAcademicService.getTeachers(),
        };
      }

      if (method === 'GET' && rawPath === '/api/students') {
        const includeArchived = query.include_archived === 'true';
        if (includeArchived) {
          const auth = resolveAuthSession(this.db, headers, true);
          assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH']);
        }
        return {
          statusCode: 200,
          body: this.usersAcademicService.getStudents(includeArchived),
        };
      }

      const studentByIdMatch = rawPath.match(/^\/api\/students\/([^/]+)$/);
      if (method === 'GET' && studentByIdMatch) {
        const studentId = decodeURIComponent(studentByIdMatch[1]);
        const auth = resolveAuthSession(this.db, headers, true);
        assertStudentAccessScope(auth, studentId, this.db, 'READ');
        return {
          statusCode: 200,
          body: this.usersAcademicService.getStudentById(studentId),
        };
      }

      // ======================================================================
      // 2. STUDENT HABITS, JOURNALS & AKTIVITAS SERU (PROTECTED BY RBAC SCOPE)
      // ======================================================================
      if (method === 'GET' && rawPath === '/api/habits/today') {
        const studentId = String(query.student_id || '').trim();
        const dateStr = String(query.date || todayDateStr).trim();
        const auth = resolveAuthSession(this.db, headers, true);
        assertStudentAccessScope(auth, studentId, this.db, 'READ');
        return {
          statusCode: 200,
          body: this.journalsService.getStudentTodayJournal(studentId, dateStr, todayDateStr),
        };
      }

      if (method === 'GET' && rawPath === '/api/habits/calendar-summary') {
        const studentId = String(query.student_id || '').trim();
        const days = Number(query.days || 14);
        const auth = resolveAuthSession(this.db, headers, true);
        assertStudentAccessScope(auth, studentId, this.db, 'READ');
        return {
          statusCode: 200,
          body: this.journalsService.getStudentCalendarSummary(studentId, days, todayDateStr),
        };
      }

      const progressMatch = rawPath.match(/^\/api\/student\/([^/]+)\/progress$/);
      if (method === 'GET' && progressMatch) {
        const studentId = decodeURIComponent(progressMatch[1]);
        const days = Number(query.days || 14);
        const auth = resolveAuthSession(this.db, headers, true);
        assertStudentAccessScope(auth, studentId, this.db, 'READ');
        return {
          statusCode: 200,
          body: this.journalsService.getStudentProgressSeries(studentId, days, todayDateStr),
        };
      }

      const reportMatch = rawPath.match(/^\/api\/student\/([^/]+)\/report$/);
      if (method === 'GET' && reportMatch) {
        const studentId = decodeURIComponent(reportMatch[1]);
        const auth = resolveAuthSession(this.db, headers, true);
        assertStudentAccessScope(auth, studentId, this.db, 'READ');
        return {
          statusCode: 200,
          body: this.analyticsReportsService.getStudentReport(studentId),
        };
      }

      if (method === 'POST' && rawPath === '/api/habits') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertStudentAccessScope(auth, String(body.student_id || ''), this.db, 'WRITE_SELF');
        return {
          statusCode: 200,
          body: this.journalsService.submitHabitEntry(body, todayDateStr, auth),
        };
      }

      if (method === 'DELETE' && rawPath === '/api/habits/reset') {
        const studentId = String(query.student_id || '').trim();
        const habitType = String(query.habit_type || '').trim();
        const dateStr = String(query.date || todayDateStr).trim();
        const auth = resolveAuthSession(this.db, headers, true);
        assertStudentAccessScope(auth, studentId, this.db, 'WRITE_SELF');
        return {
          statusCode: 200,
          body: this.journalsService.resetHabitOnDate(
            studentId,
            habitType,
            dateStr,
            todayDateStr,
            auth
          ),
        };
      }

      if (method === 'GET' && rawPath === '/api/aktivitas-seru') {
        const studentId = String(query.student_id || '').trim();
        const auth = resolveAuthSession(this.db, headers, true);
        assertStudentAccessScope(auth, studentId, this.db, 'READ');
        return {
          statusCode: 200,
          body: this.journalsService.getAktivitasSeru(studentId, query.date),
        };
      }

      if (method === 'POST' && rawPath === '/api/aktivitas-seru') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertStudentAccessScope(auth, String(body.student_id || ''), this.db, 'WRITE_SELF');
        return {
          statusCode: 200,
          body: this.journalsService.submitAktivitasSeru(body, todayDateStr, auth),
        };
      }

      // ======================================================================
      // 3. TEACHER CLASS & ROMBEL MONITORING ENDPOINTS (STRICT SCOPE CHECK)
      // ======================================================================
      const classAnalyticsMatch = rawPath.match(/^\/api\/class\/([^/]+)\/analytics$/);
      if (method === 'GET' && classAnalyticsMatch) {
        const className = decodeURIComponent(classAnalyticsMatch[1]);
        const auth = resolveAuthSession(this.db, headers, true);
        assertClassAccessScope(auth, className);
        return {
          statusCode: 200,
          body: this.analyticsReportsService.getClassAnalytics(
            className,
            query.date,
            todayDateStr
          ),
        };
      }

      const rombelAnalyticsMatch = rawPath.match(/^\/api\/rombel\/([^/]+)\/analytics$/);
      if (method === 'GET' && rombelAnalyticsMatch) {
        const rombelName = decodeURIComponent(rombelAnalyticsMatch[1]);
        const days = Number(query.days || 14);
        const auth = resolveAuthSession(this.db, headers, true);
        assertRombelAccessScope(auth, rombelName);
        return {
          statusCode: 200,
          body: this.analyticsReportsService.getRombelAnalytics(
            rombelName,
            days,
            todayDateStr
          ),
        };
      }

      if (method === 'POST' && rawPath === '/api/teacher/notes') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertStudentAccessScope(auth, String(body.student_id || ''), this.db, 'WRITE_WALAS');
        return {
          statusCode: 200,
          body: this.usersAcademicService.saveTeacherNotes(
            String(body.student_id || ''),
            String(body.walas_notes || ''),
            String(body.walas_recommendation || ''),
            auth
          ),
        };
      }

      // ======================================================================
      // 4. ADMIN & TIM 7 KAIH CONTROL PANEL ENDPOINTS
      // ======================================================================
      if (method === 'POST' && rawPath === '/api/admin/validate') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['TIM_7_KAIH', 'SUPER_ADMIN']);
        return {
          statusCode: 200,
          body: this.analyticsReportsService.saveAdminValidation(body, auth),
        };
      }

      if (method === 'GET' && rawPath === '/api/admin/validations-summary') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['TIM_7_KAIH', 'SUPER_ADMIN']);
        return {
          statusCode: 200,
          body: this.analyticsReportsService.getAdminValidationsSummary(),
        };
      }

      if (method === 'GET' && rawPath === '/api/admin/overview') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH']);
        return {
          statusCode: 200,
          body: this.analyticsReportsService.getAdminOverview(),
        };
      }

      if (method === 'POST' && rawPath === '/api/admin/students') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN']);
        return {
          statusCode: 200,
          body: this.usersAcademicService.saveStudent(body, todayDateStr, auth),
        };
      }

      const deleteStudentMatch = rawPath.match(/^\/api\/admin\/students\/([^/]+)$/);
      if (method === 'DELETE' && deleteStudentMatch) {
        const studentId = decodeURIComponent(deleteStudentMatch[1]);
        const mode = (String(query.mode || 'ARCHIVE').toUpperCase() as any) || 'ARCHIVE';
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN']);
        return {
          statusCode: 200,
          body: this.usersAcademicService.deleteOrArchiveStudent(studentId, mode, auth),
        };
      }

      if (method === 'POST' && rawPath === '/api/admin/import-students') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN']);
        return {
          statusCode: 200,
          body: this.usersAcademicService.importStudentsBatch(
            body.rows || [],
            todayDateStr,
            auth
          ),
        };
      }

      if (method === 'POST' && rawPath === '/api/admin/teachers') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN']);
        return {
          statusCode: 200,
          body: this.usersAcademicService.saveTeacher(body, todayDateStr, auth),
        };
      }

      const deleteTeacherMatch = rawPath.match(/^\/api\/admin\/teachers\/([^/]+)$/);
      if (method === 'DELETE' && deleteTeacherMatch) {
        const teacherId = decodeURIComponent(deleteTeacherMatch[1]);
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN']);
        return {
          statusCode: 200,
          body: this.usersAcademicService.deleteTeacher(teacherId, auth),
        };
      }

      if (method === 'GET' && rawPath === '/api/admin/classes-rombels') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH']);
        return {
          statusCode: 200,
          body: this.usersAcademicService.getClassesAndRombels(),
        };
      }

      if (method === 'POST' && rawPath === '/api/admin/classes') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN']);
        return {
          statusCode: 200,
          body: this.usersAcademicService.saveClass(body, auth),
        };
      }

      if (method === 'POST' && rawPath === '/api/admin/rombels') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN']);
        return {
          statusCode: 200,
          body: this.usersAcademicService.saveRombel(body, auth),
        };
      }

      if (method === 'POST' && rawPath === '/api/admin/move-student-group') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN']);
        return {
          statusCode: 200,
          body: this.usersAcademicService.moveStudentGroup(
            String(body.student_id || ''),
            body.target_class_name,
            body.target_rombel_name,
            todayDateStr,
            auth,
            body.reason
          ),
        };
      }

      if (method === 'GET' && rawPath === '/api/admin/journals') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH']);
        return {
          statusCode: 200,
          body: this.journalsService.queryAdminJournals(query as any),
        };
      }

      if (method === 'POST' && rawPath === '/api/admin/journals/correct') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH']);
        return {
          statusCode: 200,
          body: this.journalsService.correctJournalEntry(body, todayDateStr, auth),
        };
      }

      if (method === 'POST' && rawPath === '/api/admin/dashboard-widgets') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH']);
        return {
          statusCode: 200,
          body: this.analyticsReportsService.saveDashboardWidget(body, auth),
        };
      }

      if (method === 'POST' && rawPath === '/api/admin/settings') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH']);
        return {
          statusCode: 200,
          body: this.analyticsReportsService.saveGlobalSettings(body, auth),
        };
      }

      if (method === 'GET' && rawPath === '/api/admin/audit-logs') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN']);
        return {
          statusCode: 200,
          body: this.auditService.getRecentAuditLogs(
            Number(query.limit || 100),
            query.entity_type
          ),
        };
      }

      throw new NotFoundError(`Endpoint '${method} ${rawPath}' tidak ditemukan.`);
    } catch (err) {
      return formatErrorResponse(err);
    }
  }
}

export function mountJawaraRoutesOnExpress(expressApp: any, jawaraApp: JawaraApplication): void {
  expressApp.use('/api', async (req: any, res: any) => {
    const response = await jawaraApp.dispatch({
      method: req.method,
      path: req.originalUrl || req.url,
      query: req.query as Record<string, string>,
      headers: req.headers,
      body: req.body,
      ip: req.ip,
    });
    res.status(response.statusCode).json(response.body);
  });
}
