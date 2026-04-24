import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // Log to console in dev; swap for a real error service (Sentry etc.) in prod
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center"
          style={{ backgroundColor: '#F9FAFB' }}>
          <div className="text-5xl mb-4">🌿</div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: '#1B4332' }}>
            Something went wrong
          </h1>
          <p className="text-gray-500 mb-6 max-w-md">
            An unexpected error occurred. Please refresh the page or return home.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold"
              style={{ backgroundColor: '#2D6A4F' }}
            >
              Refresh Page
            </button>
            <a
              href="/"
              className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Go Home
            </a>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
