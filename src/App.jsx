import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import { UserPreferencesProvider } from './contexts/UserPreferencesContext'

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
import VerseMassUpload from './pages/admin/VerseMassUpload'
import HeroVerseList from './pages/admin/HeroVerseList'
import HeroVerseForm from './pages/admin/HeroVerseForm'
import Analytics from './pages/admin/Analytics'
import DuplicateVerses from './pages/admin/DuplicateVerses'

export default function App() {
  return (
    <AuthProvider>
      <UserPreferencesProvider>
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
            path="/admin/verses/upload"
            element={
              <ProtectedRoute>
                <AdminLayout><VerseMassUpload /></AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/verses/duplicates"
            element={
              <ProtectedRoute>
                <AdminLayout><DuplicateVerses /></AdminLayout>
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
            path="/admin/hero-verses"
            element={
              <ProtectedRoute>
                <AdminLayout><HeroVerseList /></AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/hero-verses/new"
            element={
              <ProtectedRoute>
                <AdminLayout><HeroVerseForm /></AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/hero-verses/:id/edit"
            element={
              <ProtectedRoute>
                <AdminLayout><HeroVerseForm /></AdminLayout>
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
      </UserPreferencesProvider>
    </AuthProvider>
  )
}
