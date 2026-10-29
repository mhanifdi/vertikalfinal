/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Student, Teacher } from './types';
import { api } from './utils/api';
import { PublicDashboard } from './components/public/PublicDashboard';
import { LoginPage } from './components/auth/LoginPage';
import { StudentDashboard } from './components/student/StudentDashboard';
import { TeacherDashboard } from './components/teacher/TeacherDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { StudentReportModal } from './components/common/StudentReportModal';
import { applyTheme, getSavedTheme } from './config/themeConfig';

type AppView = 'public' | 'login' | 'admin_login' | 'student' | 'teacher' | 'admin';

export default function App() {
  const isInitialAdminRoute = () => {
    if (typeof window === 'undefined') return false;
    return (
      window.location.pathname === '/admin' ||
      window.location.pathname.startsWith('/admin/') ||
      window.location.hash === '#/admin'
    );
  };

  const [currentView, setCurrentView] = useState<AppView>(() =>
    isInitialAdminRoute() ? 'admin_login' : 'login'
  );
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  // Active authenticated user
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [currentTeacher, setCurrentTeacher] = useState<Teacher | null>(null);
  const [currentAdmin, setCurrentAdmin] = useState<Teacher | null>(null);

  // Global report modal (can be opened from any view)
  const [openedReportStudentId, setOpenedReportStudentId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [stList, tchList] = await Promise.all([
        api.getStudents(),
        api.getTeachers(),
      ]);
      setStudents(stList);
      setTeachers(tchList);
      if (stList.length > 0 && !currentStudent) {
        setCurrentStudent(stList[0]);
      }
      const regTeacher = tchList.find((t) => t.assignment_type !== 'ADMIN');
      if (regTeacher && !currentTeacher) {
        setCurrentTeacher(regTeacher);
      }
      const adm = tchList.find(
        (t) => t.assignment_type === 'ADMIN' || t.role?.includes('Admin')
      );
      if (adm && !currentAdmin) {
        setCurrentAdmin(adm);
      }
    } catch (e) {
      console.error('Failed to load initial school data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    applyTheme(getSavedTheme().hex);
    loadData();

    const handlePopState = () => {
      if (isInitialAdminRoute()) {
        setCurrentView((prev) => (prev === 'admin' ? 'admin' : 'admin_login'));
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToAdminLogin = () => {
    try {
      window.history.pushState({}, '', '/admin');
    } catch {
      window.location.hash = '#/admin';
    }
    setCurrentView('admin_login');
  };

  const navigateToMainLogin = () => {
    try {
      window.history.pushState({}, '', '/');
    } catch {
      window.location.hash = '';
    }
    setCurrentView('login');
  };

  const handleStudentLogin = (s: Student) => {
    setCurrentStudent(s);
    setCurrentView('student');
  };

  const handleTeacherLogin = (t: Teacher) => {
    setCurrentTeacher(t);
    setCurrentView('teacher');
  };

  const handleAdminLogin = (a: Teacher) => {
    setCurrentAdmin(a);
    setCurrentView('admin');
  };

  const handleLogout = () => {
    if (currentView === 'admin') {
      navigateToAdminLogin();
    } else {
      navigateToMainLogin();
    }
    loadData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-kebaya-pattern flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-4 max-w-sm w-full">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#1c5ddc] to-[#0000fe] text-white flex items-center justify-center font-black text-xl mx-auto shadow-md">
            28
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              VERTIKAL SMA JAWARA 28
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Menyiapkan Sistem Pemantauan 7 KAIH SMAN 28 Jakarta...
            </p>
          </div>
          <div className="w-6 h-6 border-2 border-[#1c5ddc] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {currentView === 'public' && (
        <PublicDashboard
          students={students}
          onGoToLogin={() => navigateToMainLogin()}
          onOpenReport={(id) => setOpenedReportStudentId(id)}
        />
      )}

      {currentView === 'login' && (
        <LoginPage
          students={students}
          teachers={teachers}
          isAdminLogin={false}
          onLoginStudent={handleStudentLogin}
          onLoginTeacher={handleTeacherLogin}
          onLoginAdmin={handleAdminLogin}
          onSwitchToAdminLogin={navigateToAdminLogin}
          onBackToPublic={() => setCurrentView('public')}
        />
      )}

      {currentView === 'admin_login' && (
        <LoginPage
          students={students}
          teachers={teachers}
          isAdminLogin={true}
          onLoginStudent={handleStudentLogin}
          onLoginTeacher={handleTeacherLogin}
          onLoginAdmin={handleAdminLogin}
          onSwitchToMainLogin={navigateToMainLogin}
          onBackToPublic={() => setCurrentView('public')}
        />
      )}

      {currentView === 'student' && currentStudent && (
        <StudentDashboard
          student={currentStudent}
          allStudents={students}
          onLogout={handleLogout}
          onOpenReport={(id) => setOpenedReportStudentId(id)}
        />
      )}

      {currentView === 'teacher' && currentTeacher && (
        <TeacherDashboard
          teacher={currentTeacher}
          allStudents={students}
          onLogout={handleLogout}
          onRefreshStudents={loadData}
        />
      )}

      {currentView === 'admin' && currentAdmin && (
        <AdminDashboard
          admin={currentAdmin}
          allStudents={students}
          onLogout={handleLogout}
          onRefreshStudents={loadData}
        />
      )}

      {/* Global Student Report Inspection Modal */}
      {openedReportStudentId && (
        <StudentReportModal
          studentId={openedReportStudentId}
          canEditNotes={currentView === 'teacher' || currentView === 'admin'}
          onClose={() => {
            setOpenedReportStudentId(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
