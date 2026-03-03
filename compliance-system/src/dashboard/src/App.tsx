import { useState, useEffect } from 'react'
import './index.css'
import './App.css'
import WorkflowBuilder from './components/WorkflowBuilder'
import LoginPage from './components/LoginPage'
import TenantBadge from './components/TenantBadge'
import ApiKeysPage from './components/ApiKeysPage'
import TenantOnboardingPage from './components/TenantOnboardingPage'
import { authAPI, TokenClaims, getStoredClaims, isTokenExpired } from './services/authAPI'

type PageType = 'dashboard' | 'workflows' | 'api-keys' | 'tenant-onboarding'

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard')
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | undefined>()
  const [claims, setClaims] = useState<TokenClaims | null>(null)

  // On mount, restore session from localStorage
  useEffect(() => {
    if (!isTokenExpired()) {
      setClaims(getStoredClaims())
    }
  }, [])

  const handleLogin = (c: TokenClaims) => {
    setClaims(c)
    setCurrentPage('dashboard')
  }

  const handleLogout = async () => {
    await authAPI.logout().catch(() => {/* ignore network errors */})
    setClaims(null)
    setCurrentPage('dashboard')
  }

  // ── Not authenticated ────────────────────────────────────────────────────
  if (!claims) {
    return <LoginPage onLogin={handleLogin} />
  }

  // ── Workflow builder (full-screen) ────────────────────────────────────────
  if (currentPage === 'workflows') {
    return <WorkflowBuilder workflowId={selectedWorkflowId} onSave={() => setCurrentPage('dashboard')} />
  }

  const isAdmin = claims.role === 'admin'

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-top">
          <div>
            <h1>Ableka Lumina</h1>
            <p>AI-Driven Regulatory Technology Platform</p>
          </div>
          <TenantBadge claims={claims} onLogout={handleLogout} />
        </div>

        <nav className="app-nav">
          <button
            className={`nav-btn ${currentPage === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentPage('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={`nav-btn ${(currentPage as string) === 'workflows' ? 'active' : ''}`}
            onClick={() => { setSelectedWorkflowId(undefined); setCurrentPage('workflows') }}
          >
            Workflow Builder
          </button>
          <button
            className={`nav-btn ${currentPage === 'api-keys' ? 'active' : ''}`}
            onClick={() => setCurrentPage('api-keys')}
          >
            API Keys &amp; OAuth
          </button>
          {isAdmin && (
            <button
              className={`nav-btn ${currentPage === 'tenant-onboarding' ? 'active' : ''}`}
              onClick={() => setCurrentPage('tenant-onboarding')}
            >
              Tenant Onboarding
            </button>
          )}
        </nav>
      </header>

      <main className="app-main">
        {currentPage === 'dashboard' && (
          <>
            <section className="dashboard-section">
              <h2>Compliance Status Overview</h2>
              <div className="stats-grid">
                <div className="stat-card">
                  <h3>Total Checks</h3>
                  <p className="stat-value">0</p>
                </div>
                <div className="stat-card">
                  <h3>Approved</h3>
                  <p className="stat-value">0</p>
                </div>
                <div className="stat-card">
                  <h3>Escalated</h3>
                  <p className="stat-value">0</p>
                </div>
                <div className="stat-card">
                  <h3>Rejected</h3>
                  <p className="stat-value">0</p>
                </div>
              </div>
            </section>

            <section className="dashboard-section">
              <h2>Recent Transactions</h2>
              <p>Waiting for API connection…</p>
            </section>
          </>
        )}

        {currentPage === 'api-keys' && <ApiKeysPage claims={claims} />}

        {currentPage === 'tenant-onboarding' && isAdmin && <TenantOnboardingPage />}

        {currentPage === 'tenant-onboarding' && !isAdmin && (
          <section className="dashboard-section">
            <h2>Access Denied</h2>
            <p>Tenant onboarding requires the <strong>admin</strong> role.</p>
          </section>
        )}
      </main>

      <footer className="app-footer">
        <p>&copy; 2026 Ableka Lumina. All rights reserved.</p>
      </footer>
    </div>
  )
}

export default App
