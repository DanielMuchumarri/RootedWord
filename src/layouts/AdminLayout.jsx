import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard, BookOpen, BarChart2, LogOut, Home, X, Menu,
} from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

const nav = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/verses', label: 'Verses', icon: BookOpen },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart2 },
]

export default function AdminLayout({ children }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    toast.success('Signed out')
    navigate('/')
  }

  const Sidebar = () => (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--green-deep)' }}>
      <div className="p-5 border-b border-green-700">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌿</span>
          <div>
            <p className="font-serif-display font-bold text-white text-lg leading-none">RootedWord</p>
            <p className="text-green-300 text-xs mt-0.5">Admin Portal</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-green-700 text-white'
                  : 'text-green-200 hover:bg-green-800 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-green-700 space-y-2">
        <NavLink
          to="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-green-300 hover:text-white hover:bg-green-800 transition-colors"
        >
          <Home size={18} />
          Public Site
        </NavLink>
        <div className="px-3 py-2">
          <p className="text-green-300 text-xs truncate">{profile?.email}</p>
          <p className="text-green-400 text-xs capitalize">{profile?.role}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-300 hover:text-white hover:bg-red-800 transition-colors w-full"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#F9FAFB' }}>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-col flex-shrink-0 fixed inset-y-0 left-0 z-30">
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-60 flex-shrink-0 flex flex-col z-50">
            <Sidebar />
            <button
              className="absolute top-4 right-4 text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={20} />
            </button>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-20">
          <button
            className="lg:hidden p-1 text-gray-500 hover:text-gray-700"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: 'var(--green-mid)' }}>
              {profile?.full_name?.[0] ?? profile?.email?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <span className="text-sm text-gray-600 hidden sm:block">
              {profile?.full_name ?? profile?.email}
            </span>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
