import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './features/auth/AuthContext'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default 'online' mode pauses (rather than errors) queries when the
      // browser's reported connectivity state is unreliable, which can
      // leave a query stuck "loading" indefinitely instead of surfacing a
      // real fetch failure. 'always' makes query state reflect the actual
      // fetch outcome.
      networkMode: 'always',
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
