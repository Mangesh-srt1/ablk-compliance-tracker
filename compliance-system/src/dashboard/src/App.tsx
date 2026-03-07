import { useState, useEffect, useRef, useCallback } from 'react'
import './index.css'
import './App.css'
import WorkflowBuilder from './components/WorkflowBuilder'
import LoginPage from './components/LoginPage'
import RegisterPage from './components/RegisterPage'
import ApiKeysPage from './components/ApiKeysPage'
import TenantOnboardingPage from './components/TenantOnboardingPage'
import ComplianceDashboard from './components/ComplianceDashboard'
import ComplianceChecksPage from './components/ComplianceChecksPage'
import ArchitecturePage from './components/ArchitecturePage'
import AdminApprovalPage from './components/AdminApprovalPage'
import { authAPI, TokenClaims, getStoredClaims, isTokenExpired } from './services/authAPI'

type PageType = 'dashboard' | 'checks' | 'workflows' | 'api-keys' | 'tenant-onboarding' | 'architecture' | 'user-approvals' | 'alerts' | 'reports' | 'settings'
type AuthView = 'login' | 'register'

/** Extracts a short display name from JWT claims (uses local part of email or sub). */
function getDisplayNameFromClaims(c: TokenClaims): string {
  if (c.email) {
    const atIndex = c.email.indexOf('@')
    return atIndex > 0 ? c.email.slice(0, atIndex) : c.email
  }
  return c.sub ?? 'User'
}
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000   // 15 minutes
const WARNING_BEFORE_MS     = 2  * 60 * 1000   // show warning 2 min before expiry

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard')
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | undefined>()
  const [claims, setClaims] = useState<TokenClaims | null>(null)
  const [authView, setAuthView] = useState<AuthView>('login')

  // Welcome banner
  const [showWelcome, setShowWelcome] = useState(false)

  // Session timeout
  const [showSessionWarning, setShowSessionWarning] = useState(false)
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState(WARNING_BEFORE_MS / 1000)
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef    = useRef<ReturnType<typeof setInterval> | null>(null)

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Search
  const [searchQuery, setSearchQuery] = useState('')

  // Notifications
  const [showNotifications, setShowNotifications] = useState(false)
  const [notificationCount] = useState(3)

  // User menu dropdown
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const notifRef    = useRef<HTMLDivElement>(null)

  // On mount, restore session from localStorage
  useEffect(() => {
    if (!isTokenExpired()) {
      setClaims(getStoredClaims())
    }
  }, [])

  // ── Session timeout logic ───────────────────────────────────────────────────
  const clearAllTimers = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    if (warningTimer.current)    clearTimeout(warningTimer.current)
    if (countdownRef.current)    clearInterval(countdownRef.current)
    inactivityTimer.current = null
    warningTimer.current    = null
    countdownRef.current    = null
  }, [])

  const handleLogout = useCallback(async () => {
    clearAllTimers()
    setShowSessionWarning(false)
    await authAPI.logout().catch(() => {/* ignore network errors */})
    setClaims(null)
    setAuthView('login')
    setCurrentPage('dashboard')
  }, [clearAllTimers])

  const startSessionTimers = useCallback(() => {
    clearAllTimers()
    setShowSessionWarning(false)

    // Show warning 2 min before expiry
    warningTimer.current = setTimeout(() => {
      setSessionSecondsLeft(WARNING_BEFORE_MS / 1000)
      setShowSessionWarning(true)
      countdownRef.current = setInterval(() => {
        setSessionSecondsLeft((s) => {
          if (s <= 1) return 0
          return s - 1
        })
      }, 1000)
    }, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS)

    // Auto-logout after full timeout
    inactivityTimer.current = setTimeout(() => {
      handleLogout()
    }, INACTIVITY_TIMEOUT_MS)
  }, [clearAllTimers, handleLogout])

  const resetSessionTimers = useCallback(() => {
    if (!claims) return
    startSessionTimers()
  }, [claims, startSessionTimers])

  // Start timers when authenticated
  useEffect(() => {
    if (!claims) { clearAllTimers(); return }
    startSessionTimers()

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    const onActivity = () => resetSessionTimers()
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
    return () => {
      clearAllTimers()
      events.forEach((e) => window.removeEventListener(e, onActivity))
    }
  }, [claims, clearAllTimers, startSessionTimers, resetSessionTimers])

  // Auto-dismiss session warning when seconds reach 0
  useEffect(() => {
    if (sessionSecondsLeft <= 0 && showSessionWarning) {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [sessionSecondsLeft, showSessionWarning])

  // ── Click-outside to close dropdowns ──────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogin = (c: TokenClaims) => {
    setClaims(c)
    setCurrentPage('dashboard')
    setAuthView('login')
    setShowWelcome(true)
    setTimeout(() => setShowWelcome(false), 4000)
  }

  const handleStayLoggedIn = () => {
    setShowSessionWarning(false)
    startSessionTimers()
  }

  // ── Not authenticated ────────────────────────────────────────────────────
  if (!claims) {
    if (authView === 'register') {
      return (
        <RegisterPage
          onRegister={handleLogin}
          onSwitchToLogin={() => setAuthView('login')}
        />
      )
    }
    return (
      <LoginPage
        onLogin={handleLogin}
        onSwitchToRegister={() => setAuthView('register')}
      />
    )
  }

  // ── Workflow builder (full-screen) ────────────────────────────────────────
  if (currentPage === 'workflows') {
    return <WorkflowBuilder workflowId={selectedWorkflowId} onSave={() => setCurrentPage('dashboard')} />
  }

  const role = claims.role
  const isAdmin = role === 'admin'
  const isTenantAdmin = role === 'tenant_admin' || isAdmin
  const canManageApiKeys = isTenantAdmin
  const canEditWorkflows = ['admin', 'tenant_admin', 'compliance_officer'].includes(role)
  const canManageTenant  = isTenantAdmin
  const canApproveUsers  = isAdmin

  const displayName = getDisplayNameFromClaims(claims)

  // ── Sidebar nav items ─────────────────────────────────────────────────────
  type NavItem = {
    icon: string
    label: string
    page: PageType
    visible: boolean
    shortcut: string
  }
  const navItems: NavItem[] = [
    { icon: '📊', label: 'Home',               page: 'dashboard',         visible: true,             shortcut: 'Ctrl+H' },
    { icon: '✅', label: 'Compliance Checks',  page: 'checks',            visible: true,             shortcut: 'Ctrl+K' },
    { icon: '🔔', label: 'Real-Time Alerts',   page: 'alerts',            visible: true,             shortcut: 'Ctrl+A' },
    { icon: '🔧', label: 'Workflow Builder',   page: 'workflows',         visible: canEditWorkflows,  shortcut: 'Ctrl+W' },
    { icon: '📈', label: 'Reports & Analytics',page: 'reports',           visible: true,             shortcut: 'Ctrl+R' },
    { icon: '🔑', label: 'API Keys & OAuth',   page: 'api-keys',          visible: canManageApiKeys,  shortcut: '' },
    { icon: '🏗',  label: 'Architecture',       page: 'architecture',      visible: true,             shortcut: '' },
    { icon: '🏢', label: isAdmin ? 'Tenant Onboarding' : 'Tenant Settings', page: 'tenant-onboarding', visible: canManageTenant, shortcut: '' },
    { icon: '👥', label: 'User Approvals',     page: 'user-approvals',    visible: canApproveUsers,   shortcut: '' },
    { icon: '⚙️', label: 'Settings',           page: 'settings',          visible: true,             shortcut: 'Ctrl+,' },
  ]

  return (
    <div className="app app-sidebar-layout">

      {/* ── Session timeout warning modal ─────────────────────────────────── */}
      {showSessionWarning && (
        <div className="session-warning-overlay" role="dialog" aria-modal="true" aria-labelledby="session-warning-title">
          <div className="session-warning-modal">
            <div className="session-warning-icon">⏰</div>
            <h2 id="session-warning-title">Session Expiring Soon</h2>
            <p>
              Your session will expire in{' '}
              <strong>{Math.floor(sessionSecondsLeft / 60)}:{String(sessionSecondsLeft % 60).padStart(2, '0')}</strong>{' '}
              due to inactivity.
            </p>
            <div className="session-warning-actions">
              <button className="session-btn-primary" onClick={handleStayLoggedIn}>
                Stay Logged In
              </button>
              <button className="session-btn-secondary" onClick={handleLogout}>
                Logout Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <header className="app-topbar">
        {/* Left: hamburger + logo */}
        <div className="topbar-left">
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="Toggle sidebar navigation"
            title="Toggle sidebar"
          >
            ☰
          </button>
          <div className="topbar-brand">
            <span className="topbar-logo">⚖️</span>
            <div>
              <span className="topbar-title">Ableka Lumina</span>
              <span className="topbar-subtitle">AI Compliance Engine</span>
            </div>
          </div>
        </div>

        {/* Centre: search bar */}
        <div className="topbar-search">
          <span className="topbar-search-icon">🔍</span>
          <input
            type="search"
            className="topbar-search-input"
            placeholder="Search checks, wallets, jurisdictions…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Global search"
          />
        </div>

        {/* Right: notifications + user menu */}
        <div className="topbar-right">

          {/* Notifications */}
          <div className="topbar-notif-wrap" ref={notifRef}>
            <button
              className="topbar-icon-btn"
              onClick={() => { setShowNotifications((v) => !v); setShowUserMenu(false) }}
              aria-label={`Notifications – ${notificationCount} unread`}
              title="Notifications"
            >
              🔔
              {notificationCount > 0 && (
                <span className="topbar-badge">{notificationCount}</span>
              )}
            </button>
            {showNotifications && (
              <div className="topbar-dropdown notif-dropdown" role="menu">
                <div className="dropdown-header">Notifications</div>
                <div className="notif-item notif-critical" role="menuitem">
                  <span className="notif-dot" />
                  <div>
                    <strong>High-Risk Entity Detected</strong>
                    <span className="notif-time">2 min ago</span>
                  </div>
                </div>
                <div className="notif-item notif-warning" role="menuitem">
                  <span className="notif-dot" />
                  <div>
                    <strong>AML Threshold Exceeded</strong>
                    <span className="notif-time">14 min ago</span>
                  </div>
                </div>
                <div className="notif-item notif-info" role="menuitem">
                  <span className="notif-dot" />
                  <div>
                    <strong>KYC Verification Complete</strong>
                    <span className="notif-time">1 hr ago</span>
                  </div>
                </div>
                <button
                  className="notif-view-all"
                  onClick={() => { setCurrentPage('alerts'); setShowNotifications(false) }}
                >
                  View all alerts →
                </button>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="topbar-user-wrap" ref={userMenuRef}>
            <button
              className="topbar-user-btn"
              onClick={() => { setShowUserMenu((v) => !v); setShowNotifications(false) }}
              aria-label="User menu"
              title={claims.email}
            >
              <span className="topbar-avatar">{displayName.charAt(0).toUpperCase()}</span>
              <span className="topbar-user-name">{displayName}</span>
              <span className="topbar-caret">▾</span>
            </button>
            {showUserMenu && (
              <div className="topbar-dropdown user-dropdown" role="menu">
                <div className="dropdown-header">
                  <div className="user-menu-email">{claims.email}</div>
                  <div className="user-menu-role">{role}</div>
                  {claims.tenant && <div className="user-menu-tenant">🏢 {claims.tenant}</div>}
                </div>
                <button
                  className="dropdown-item"
                  role="menuitem"
                  onClick={() => { setCurrentPage('settings'); setShowUserMenu(false) }}
                >
                  👤 Profile Settings
                </button>
                <button
                  className="dropdown-item"
                  role="menuitem"
                  onClick={() => { setCurrentPage('settings'); setShowUserMenu(false) }}
                >
                  🔒 Change Password
                </button>
                <div className="dropdown-divider" />
                <button
                  className="dropdown-item dropdown-item-danger"
                  role="menuitem"
                  onClick={handleLogout}
                >
                  🚪 Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Body: sidebar + main ──────────────────────────────────────────── */}
      <div className="app-body">

        {/* Sidebar */}
        <aside className={`app-sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`} aria-label="Primary navigation">
          <nav className="sidebar-nav">
            {navItems.filter((n) => n.visible).map((item) => (
              <button
                key={item.page + item.label}
                className={`sidebar-nav-item ${currentPage === item.page ? 'active' : ''}`}
                onClick={() => {
                  if (item.page === 'workflows') {
                    setSelectedWorkflowId(undefined)
                  }
                  setCurrentPage(item.page)
                }}
                title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
                aria-current={currentPage === item.page ? 'page' : undefined}
              >
                <span className="sidebar-icon">{item.icon}</span>
                {sidebarOpen && <span className="sidebar-label">{item.label}</span>}
              </button>
            ))}
          </nav>

          {/* Sidebar footer: color-coding legend */}
          {sidebarOpen && (
            <div className="sidebar-legend">
              <div className="sidebar-legend-title">Risk Score</div>
              <div className="sidebar-legend-item">
                <span className="legend-dot legend-low" />
                <span>Low (0–29) — Auto-approved</span>
              </div>
              <div className="sidebar-legend-item">
                <span className="legend-dot legend-medium" />
                <span>Medium (30–69) — Review required</span>
              </div>
              <div className="sidebar-legend-item">
                <span className="legend-dot legend-high" />
                <span>High (70–100) — Escalated</span>
              </div>
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className="app-main">

          {/* Welcome banner */}
          {showWelcome && (
            <div className="welcome-banner" role="status">
              👋 Welcome back, <strong>{displayName}</strong>! Your session is active.
              <button className="welcome-close" onClick={() => setShowWelcome(false)} aria-label="Dismiss welcome message">×</button>
            </div>
          )}

          {currentPage === 'dashboard' && <ComplianceDashboard claims={claims} onNavigateToChecks={() => setCurrentPage('checks')} />}

          {currentPage === 'checks' && <ComplianceChecksPage />}

          {currentPage === 'alerts' && (
            <section className="dashboard-section">
              <h2>🔔 Real-Time Alerts</h2>
              <p className="placeholder-text">Real-time compliance alert monitoring will appear here. Connect the WebSocket stream to start receiving live alerts.</p>
              <div className="risk-legend-card">
                <h3>Risk Color Reference</h3>
                <div className="risk-legend-grid">
                  <div className="risk-legend-row">
                    <span className="risk-badge risk-low">Low 0–29</span>
                    <span>🟢 Auto-approved — no action required</span>
                  </div>
                  <div className="risk-legend-row">
                    <span className="risk-badge risk-medium">Medium 30–69</span>
                    <span>🟡 Review required — manual assessment needed</span>
                  </div>
                  <div className="risk-legend-row">
                    <span className="risk-badge risk-high">High 70–100</span>
                    <span>🔴 Escalated/Rejected — immediate action required</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {currentPage === 'reports' && (
            <section className="dashboard-section">
              <h2>📈 Reports &amp; Analytics</h2>
              <p className="placeholder-text">Compliance reports and analytics dashboards will be available here. Generate KYC/AML summary reports, audit trails, and risk trend analysis.</p>
            </section>
          )}

          {currentPage === 'settings' && (
            <section className="dashboard-section">
              <h2>⚙️ Settings</h2>
              <div className="settings-profile">
                <h3>Profile</h3>
                <p><strong>Email:</strong> {claims.email}</p>
                <p><strong>Role:</strong> {claims.role}</p>
                {claims.tenant && <p><strong>Tenant:</strong> {claims.tenant}</p>}
              </div>
              <div className="settings-section">
                <h3>Password Requirements</h3>
                <ul className="password-requirements-list">
                  <li>✅ Minimum 12 characters</li>
                  <li>✅ At least 1 uppercase letter (A–Z)</li>
                  <li>✅ At least 1 lowercase letter (a–z)</li>
                  <li>✅ At least 1 number (0–9)</li>
                  <li>✅ At least 1 special character (!@#$%^&amp;*)</li>
                  <li>✅ Cannot be same as previous 5 passwords</li>
                </ul>
              </div>
              <div className="settings-section">
                <h3>Session Management</h3>
                <p>Inactivity timeout: <strong>15 minutes</strong></p>
                <p>Warning shown: <strong>2 minutes</strong> before expiry</p>
                <p>Click <em>"Stay Logged In"</em> in the warning dialog to extend your session.</p>
              </div>
            </section>
          )}

          {currentPage === 'api-keys' && canManageApiKeys && <ApiKeysPage claims={claims} />}

          {currentPage === 'api-keys' && !canManageApiKeys && (
            <section className="dashboard-section">
              <h2>Access Denied</h2>
              <p>API Key management requires the <strong>tenant_admin</strong> or <strong>admin</strong> role.</p>
            </section>
          )}

          {currentPage === 'architecture' && <ArchitecturePage />}

          {currentPage === 'tenant-onboarding' && canManageTenant && <TenantOnboardingPage />}

          {currentPage === 'tenant-onboarding' && !canManageTenant && (
            <section className="dashboard-section">
              <h2>Access Denied</h2>
              <p>Tenant onboarding requires the <strong>admin</strong> role.</p>
            </section>
          )}

          {currentPage === 'user-approvals' && canApproveUsers && <AdminApprovalPage />}

          {currentPage === 'user-approvals' && !canApproveUsers && (
            <section className="dashboard-section">
              <h2>Access Denied</h2>
              <p>User approvals require the <strong>admin</strong> role.</p>
            </section>
          )}
        </main>
      </div>

      <footer className="app-footer">
        <p>&copy; 2026 Ableka Lumina. All rights reserved.</p>
      </footer>
    </div>
  )
}

export default App
