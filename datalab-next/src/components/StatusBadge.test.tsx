import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from './StatusBadge'

/**
 * A minimal smoke test — this sprint's goal is proving the Vitest +
 * Testing Library setup itself works (jsdom environment, `@testing-
 * library/jest-dom` matchers, the `test`/`test:watch` scripts), not broad
 * component coverage. `StatusBadge` was picked because it's pure and
 * dependency-free — no providers, no routing, no query client needed to
 * render it — so a failure here can only mean the test infrastructure
 * itself is broken, not a fixture/setup mistake in the test.
 */
describe('StatusBadge', () => {
  it('renders the status text for a known status', () => {
    render(<StatusBadge status="approved" />)

    expect(screen.getByText('approved')).toBeInTheDocument()
  })

  it('falls back to the default style for an unrecognized status', () => {
    render(<StatusBadge status="something-unexpected" />)

    expect(screen.getByText('something-unexpected')).toBeInTheDocument()
  })
})
