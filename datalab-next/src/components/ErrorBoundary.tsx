import { Component, type ReactNode } from 'react'
import { ErrorState } from './ErrorState'

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
}

/** Sprint 31 — a single, top-level boundary (wrapped around the whole
 * route tree in `App.tsx`) so a render-time exception anywhere shows a
 * fallback instead of unmounting the entire app. Reuses `ErrorState`'s
 * existing visuals rather than a new one-off error screen. A class
 * component because React has no hook-based error boundary API. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center p-6">
          <ErrorState
            message="Something went wrong. Try reloading the page."
            onRetry={() => window.location.reload()}
          />
        </div>
      )
    }

    return this.props.children
  }
}
