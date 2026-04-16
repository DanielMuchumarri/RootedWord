import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'

import PublicLayout from './layouts/PublicLayout'
import AdminLayout from './layouts/AdminLayout'
import ProtectedRoute from './components/ProtectedRoute'

import CalendarHome from './pages/CalendarHome'
import VerseDetail from './pages/VerseDetail'
import NotFound from './pages/NotFound'

import AdminLogin from './pages/admin/AdminLogin'
import Dashboard from './pages/admin/Dashboard'
import VerseList from './pages/admin/VerseList'
import VerseForm from './pages/admin/VerseForm'
import Analytics from './pages/admin/Analytics'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { fontSize: '14px' },
            success: { iconTheme: { primary: '#2D6A4F', secondary: '#fff' } },
          }}
        />
        <Routes>
          {/* Public */}
          <Route path="/" element={<PublicLayout><CalendarHome /></PublicLayout>} />
          <Route path="/verse/:id" element={<PublicLayout><VerseDetail /></PublicLayout>} />

          {/* Admin login */}
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* Admin protected */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout><Dashboard /></AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/verses"
            element={
              <ProtectedRoute>
                <AdminLayout><VerseList /></AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/verses/new"
            element={
              <ProtectedRoute>
                <AdminLayout><VerseForm /></AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/verses/:id/edit"
            element={
              <ProtectedRoute>
                <AdminLayout><VerseForm /></AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/analytics"
            element={
              <ProtectedRoute>
                <AdminLayout><Analytics /></AdminLayout>
              </ProtectedRoute>
            }
          />

          {/* 404 */}
          <Route path="*" element={<PublicLayout><NotFound /></PublicLayout>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
