import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Schedule from './pages/Schedule'
import Calendar from './pages/Calendar'
import Users from './pages/Users'
import Settings from './pages/Settings'
import Notes from './pages/Notes'
import Reminders from './pages/Reminders'
import Expenses from './pages/Expenses'
import Quotes from './pages/Quotes'
import Clients from './pages/Clients'
import ClientDetail from './pages/ClientDetail'
import CustomerSatisfaction from './pages/CustomerSatisfaction'
import EmailNotifications from './pages/EmailNotifications'
import { RoleGuard } from './components/RoleGuard'
import { useAuth } from './contexts/AuthContext'

// Wake up backend immediately when app loads
const BACKEND_URL = 'https://brightsbrokscleanproclean2026.onrender.com'

function wakeUpBackend() {
  // Ping health endpoint to wake up sleeping backend
  fetch(`${BACKEND_URL}/api/health`, { 
    method: 'GET',
    mode: 'cors',
  }).then(() => {
    console.log('[App] Backend is awake')
  }).catch(() => {
    // Retry after 5 seconds if first attempt fails
    setTimeout(() => {
      fetch(`${BACKEND_URL}/api/health`, { mode: 'cors' }).catch(() => {})
    }, 5000)
  })
}

// Wake up immediately on script load
wakeUpBackend()

function LandingRedirect() {
  const { user } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  // Employees go to schedule, admins go to dashboard
  const target = user?.role === 'employee' ? '/schedule' : '/dashboard'
  return <Navigate to={target} replace />
}

function App() {
  // Keep backend awake while app is open
  useEffect(() => {
    // Ping every 10 minutes to prevent sleeping
    const interval = setInterval(() => {
      fetch(`${BACKEND_URL}/api/health`, { mode: 'cors' }).catch(() => {})
    }, 10 * 60 * 1000) // 10 minutes
    
    return () => clearInterval(interval)
  }, [])

  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<LandingRedirect />} />
              <Route
                path="dashboard"
                element={
                  <RoleGuard requiredPermission="dashboard">
                    <Dashboard />
                  </RoleGuard>
                }
              />
              <Route
                path="schedule"
                element={
                  <RoleGuard requiredPermission="schedule">
                    <Schedule />
                  </RoleGuard>
                }
              />
              <Route
                path="calendar"
                element={
                  <RoleGuard requiredPermission="calendar">
                    <Calendar />
                  </RoleGuard>
                }
              />
              <Route
                path="users"
                element={
                  <RoleGuard requiredPermission="users">
                    <Users />
                  </RoleGuard>
                }
              />
              <Route
                path="settings"
                element={
                  <RoleGuard requiredPermission="settings">
                    <Settings />
                  </RoleGuard>
                }
              />
              <Route
                path="notes"
                element={
                  <RoleGuard requiredPermission="notes">
                    <Notes />
                  </RoleGuard>
                }
              />
              <Route
                path="reminders"
                element={
                  <RoleGuard requiredPermission="reminders">
                    <Reminders />
                  </RoleGuard>
                }
              />
              <Route
                path="expenses"
                element={
                  <RoleGuard requiredPermission="expenses">
                    <Expenses />
                  </RoleGuard>
                }
              />
              <Route
                path="quotes"
                element={
                  <RoleGuard requiredPermission="quotes">
                    <Quotes />
                  </RoleGuard>
                }
              />
              <Route
                path="clients"
                element={
                  <RoleGuard requiredPermission="clients">
                    <Clients />
                  </RoleGuard>
                }
              />
              <Route
                path="clients/:id"
                element={
                  <RoleGuard requiredPermission="clients">
                    <ClientDetail />
                  </RoleGuard>
                }
              />
              <Route
                path="customer-satisfaction"
                element={
                  <RoleGuard requiredPermission="clients">
                    <CustomerSatisfaction />
                  </RoleGuard>
                }
              />
              <Route
                path="email-notifications"
                element={
                  <RoleGuard allowedRoles={['superadmin']}>
                    <EmailNotifications />
                  </RoleGuard>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
