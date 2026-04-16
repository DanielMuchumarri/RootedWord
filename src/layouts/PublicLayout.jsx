import { Link } from 'react-router-dom'

export default function PublicLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--parchment)' }}>
      <header style={{ backgroundColor: 'var(--green-deep)' }} className="sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">🌿</span>
            <div>
              <span className="font-serif-display text-xl font-bold text-white tracking-wide">RootedWord</span>
              <p className="text-xs text-green-200 hidden sm:block leading-none">Plant the Word. Grow in Faith.</p>
            </div>
          </Link>
          <Link
            to="/admin/login"
            className="text-xs text-green-300 hover:text-white transition-colors"
          >
            Admin
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer style={{ backgroundColor: 'var(--green-deep)' }} className="mt-auto py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="font-serif-display italic text-green-200 text-sm mb-1">
            "Let the word of Christ dwell in you richly" — Colossians 3:16
          </p>
          <p className="text-green-400 text-xs">
            © {new Date().getFullYear()} RootedWord · A Faith-Based Bible Memory App
          </p>
        </div>
      </footer>
    </div>
  )
}
