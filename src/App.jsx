import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import { UserPreferencesProvider } from './contexts/UserPreferencesContext'

import PublicLayout from './layouts/PublicLayout'
import AdminLayout from './layouts/AdminLayout'
import ProtectedRoute from './components/ProtectedRoute'

// Public pages — loaded eagerly (on the critical path for every visitor)
import CalendarHome from './pages/CalendarHome'
import VerseDetail from './pages/VerseDetail'
import NotFound from './pages/NotFound'

// Admin pages — lazy-loaded so they are never included in the public bundle.
// ExcelJS (~1.5 MB) and Recharts are only pulled in when an admin navigates here.
const AdminLogin     = lazy(() => import('./pages/admin/AdminLogin'))
const Dashboard      = lazy(() => import('./pages/admin/Dashboard'))
const VerseList      = lazy(() => import('./pages/admin/VerseList'))
const VerseForm      = lazy(() => import('./pages/admin/VerseForm'))
const VerseMassUpload = lazy(() => import('./pages/admin/VerseMassUpload'))
const HeroVerseList  = lazy(() => import('./pages/admin/HeroVerseList'))
const HeroVerseForm  = lazy(() => import('./pages/admin/HeroVerseForm'))
const Analytics      = lazy(() => import('./pages/admin/Analytics'))
const DuplicateVerses = lazy(() => import('./pages/admin/DuplicateVerses'))

// Minimal fallback shown while an admin chunk is loading
function AdminLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-4xl animate-bounce">🌿</div>
    </div>
  )
}

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
          <Route path="/admin/login" element={
            <Suspense fallback={<AdminLoader />}><AdminLogin /></Suspense>
          } />

          {/* Admin protected */}
          <Route path="/admin" element={
            <ProtectedRoute>
              <Suspense fallback={<AdminLoader />}>
                <AdminLayout><Dashboard /></AdminLayout>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/admin/verses" element={
            <ProtectedRoute>
              <Suspense fallback={<AdminLoader />}>
                <AdminLayout><VerseList /></AdminLayout>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/admin/verses/upload" element={
            <ProtectedRoute>
              <Suspense fallback={<AdminLoader />}>
                <AdminLayout><VerseMassUpload /></AdminLayout>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/admin/verses/duplicates" element={
            <ProtectedRoute>
              <Suspense fallback={<AdminLoader />}>
                <AdminLayout><DuplicateVerses /></AdminLayout>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/admin/verses/new" element={
            <ProtectedRoute>
              <Suspense fallback={<AdminLoader />}>
                <AdminLayout><VerseForm /></AdminLayout>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/admin/verses/:id/edit" element={
            <ProtectedRoute>
              <Suspense fallback={<AdminLoader />}>
                <AdminLayout><VerseForm /></AdminLayout>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/admin/hero-verses" element={
            <ProtectedRoute>
              <Suspense fallback={<AdminLoader />}>
                <AdminLayout><HeroVerseList /></AdminLayout>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/admin/hero-verses/new" element={
            <ProtectedRoute>
              <Suspense fallback={<AdminLoader />}>
                <AdminLayout><HeroVerseForm /></AdminLayout>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/admin/hero-verses/:id/edit" element={
            <ProtectedRoute>
              <Suspense fallback={<AdminLoader />}>
                <AdminLayout><HeroVerseForm /></AdminLayout>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/admin/analytics" element={
            <ProtectedRoute>
              <Suspense fallback={<AdminLoader />}>
                <AdminLayout><Analytics /></AdminLayout>
              </Suspense>
            </ProtectedRoute>
          } />

          {/* 404 */}
          <Route path="*" element={<PublicLayout><NotFound /></PublicLayout>} />
        </Routes>
        </BrowserRouter>
      </UserPreferencesProvider>
    </AuthProvider>
  )
}
