import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <Helmet>
        <title>Page Not Found — RootedWord</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="text-6xl mb-4">🍃</div>
      <h1 className="font-serif-display text-4xl font-bold mb-2" style={{ color: 'var(--green-deep)' }}>
        404
      </h1>
      <p className="text-gray-500 mb-6">This page could not be found.</p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold"
        style={{ backgroundColor: 'var(--green-mid)' }}
      >
        Back to Calendar
      </Link>
    </div>
  )
}
