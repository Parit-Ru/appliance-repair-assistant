import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AdminRoute } from './components/auth/AdminRoute'
import { AuthProvider } from './components/auth/AuthProvider'
import { AppShell } from './components/layout/AppShell'
import { AdminAnalyticsPage } from './pages/AdminAnalyticsPage'
import { AdminDraftReviewPage } from './pages/AdminDraftReviewPage'
import { AdminDraftsPage } from './pages/AdminDraftsPage'
import { AdminFeedbackPage } from './pages/AdminFeedbackPage'
import { AllSymptomsPage } from './pages/AllSymptomsPage'
import { DevicesPage } from './pages/DevicesPage'
import { HistoryDetailPage } from './pages/HistoryDetailPage'
import { HistoryPage } from './pages/HistoryPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { RegisterPage } from './pages/RegisterPage'
import { SessionPage } from './pages/SessionPage'
import { SymptomsPage } from './pages/SymptomsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
})

/**
 * AuthProvider อยู่ใน QueryClientProvider (ล้างแคชตอน login/logout) และใน BrowserRouter (พาไปหน้าเข้าสู่ระบบ)
 * หน้าเดิมทั้งหมดไม่บังคับเข้าสู่ระบบ · เฉพาะ /admin/* ครอบด้วย AdminRoute (UX · backend ตรวจสิทธิ์จริง)
 */
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AuthProvider>
          <AppShell>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/devices" element={<DevicesPage />} />
              <Route path="/symptoms" element={<SymptomsPage />} />
              <Route path="/symptoms/all" element={<AllSymptomsPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/history/:sessionId" element={<HistoryDetailPage />} />
              <Route path="/session/:sessionId" element={<SessionPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/admin" element={<Navigate to="/admin/analytics" replace />} />
              <Route
                path="/admin/analytics"
                element={
                  <AdminRoute>
                    <AdminAnalyticsPage />
                  </AdminRoute>
                }/>
              <Route
                path="/admin/feedback"
                element={
                  <AdminRoute>
                    <AdminFeedbackPage />
                  </AdminRoute>
                }/>
              <Route
                path="/admin/drafts"
                element={
                  <AdminRoute>
                    <AdminDraftsPage />
                  </AdminRoute>
                }/>
              <Route
                path="/admin/drafts/:id"
                element={
                  <AdminRoute>
                    <AdminDraftReviewPage />
                  </AdminRoute>
                }/>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </AppShell>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
