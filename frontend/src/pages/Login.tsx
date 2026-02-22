import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Mail, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { apiClient } from '../services/api'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false)
  const { login, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) {
      // Small delay to ensure state is updated before navigation
      const timer = setTimeout(() => {
        navigate('/dashboard', { replace: true })
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [user, navigate])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    try {
      await login(username.trim(), password)
      toast.success('Welcome to Bright Works', { icon: '✨' })
      // Navigate after successful login - don't rely on useEffect
      setTimeout(() => {
        navigate('/dashboard', { replace: true })
      }, 300)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to sign in right now'
      toast.error(message)
      setLoading(false)
    }
  }

  const handleForgotPassword = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!forgotPasswordEmail.trim()) {
      toast.error('Please enter your email address')
      return
    }
    
    setForgotPasswordLoading(true)
    try {
      await apiClient.post('/api/auth/forgot-password', { email: forgotPasswordEmail.trim() })
      toast.success('Password reset email sent! Check your inbox.', { icon: '📧', duration: 5000 })
      setShowForgotPassword(false)
      setForgotPasswordEmail('')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to send password reset email'
      toast.error(message)
    } finally {
      setForgotPasswordLoading(false)
    }
  }

  if (user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#0ea5e9_0,transparent_55%)] opacity-40" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,#6366f1_0,transparent_55%)] opacity-30" />

      <div className="relative z-10 w-full max-w-lg">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl shadow-slate-900/70 backdrop-blur">
          <div className="mb-8 flex flex-col items-center gap-5 text-center">
            <img 
              src="/brightworkslogo.png"
              alt="Bright Works" 
              className="h-32 w-32 rounded-full border-2 border-primary-500/50 object-cover shadow-lg shadow-primary-500/40"
              loading="eager"
              decoding="async"
            />
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-primary-300">Bright Works</p>
              <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Professional Control</h1>
              <p className="mt-2 text-sm text-slate-400">Sign in to manage schedules, clients, and premium reports.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Username
              </label>
              <input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
                placeholder="admin"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
                placeholder="••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl border border-primary-500/40 bg-gradient-to-r from-primary-500 via-primary-600 to-primary-500 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-primary-500/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span className="flex items-center justify-center gap-2">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Verifying…' : 'Sign in'}
              </span>
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-slate-400 underline transition hover:text-primary-400"
            >
              Forgot password?
            </button>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowForgotPassword(false)}>
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Recover Password</h3>
              <button
                onClick={() => setShowForgotPassword(false)}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-400">
              Enter your email address and we'll send you a temporary password.
            </p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label htmlFor="recovery-email" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Email Address
                </label>
                <input
                  id="recovery-email"
                  type="email"
                  value={forgotPasswordEmail}
                  onChange={(event) => setForgotPasswordEmail(event.target.value)}
                  autoComplete="email"
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
                  placeholder="your.email@example.com"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={forgotPasswordLoading}
                className="w-full rounded-xl border border-primary-500/40 bg-gradient-to-r from-primary-500 via-primary-600 to-primary-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-500/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="flex items-center justify-center gap-2">
                  {forgotPasswordLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Mail className="h-4 w-4" />
                  {forgotPasswordLoading ? 'Sending...' : 'Send Password Reset Email'}
                </span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
