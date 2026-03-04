import { useState, useEffect } from 'react'
import './index.css'
import './App.css'
import WorkflowBuilder from './components/WorkflowBuilder'
import LoginPage from './components/LoginPage'
import RegisterPage from './components/RegisterPage'
import TenantBadge from './components/TenantBadge'
import ApiKeysPage from './components/ApiKeysPage'
import TenantOnboardingPage from './components/TenantOnboardingPage'
import ComplianceDashboard from './components/ComplianceDashboard'
import ArchitecturePage from './components/ArchitecturePage'
import AdminApprovalPage from './components/AdminApprovalPage'
import { authAPI, TokenClaims, getStoredClaims, isTokenExpired } from './services/authAPI'

type PageType = 'dashboard' | 'workflows' | 'api-keys' | 'tenant-onboarding' | 'architecture' | 'user-approvals'
type AuthView = 'login' | 'register'

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard')
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | undefined>()
  const [claims, setClaims] = useState<TokenClaims | null>(null)
  const [authView, setAuthView] = useState<AuthView>('login')

  // On mount, restore session from localStorage
  useEffect(() => {
    if (!isTokenExpired()) {
      setClaims(getStoredClaims())
    }
  }, [])

  const handleLogin = (c: TokenClaims) => {
    setClaims(c)
    setCurrentPage('dashboard')
    setAuthView('login')
  }

  const handleLogout = async () => {
    await authAPI.logout().catch(() => {/* ignore network errors */})
    setClaims(null)
    setAuthView('login')
    setCurrentPage('dashboard')
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
  // Roles that can access API keys: tenant_admin, admin
  const canManageApiKeys = isTenantAdmin
  // Roles that can trigger workflow builder: compliance_officer, tenant_admin, admin
  const canEditWorkflows = ['admin', 'tenant_admin', 'compliance_officer'].includes(role)

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
            📊 Dashboard
          </button>
          {canEditWorkflows && (
            <button
              className={`nav-btn ${(currentPage as string) === 'workflows' ? 'active' : ''}`}
              onClick={() => { setSelectedWorkflowId(undefined); setCurrentPage('workflows') }}
            >
              ⚙️ Workflows
            </button>
          )}
          {canManageApiKeys && (
            <button
              className={`nav-btn ${currentPage === 'api-keys' ? 'active' : ''}`}
              onClick={() => setCurrentPage('api-keys')}
            >
              🔑 API Keys &amp; OAuth
            </button>
          )}
          <button
            className={`nav-btn ${currentPage === 'architecture' ? 'active' : ''}`}
            onClick={() => setCurrentPage('architecture')}
          >
            🏗 Architecture
          </button>
          {isAdmin && (
            <button
              className={`nav-btn ${currentPage === 'tenant-onboarding' ? 'active' : ''}`}
              onClick={() => setCurrentPage('tenant-onboarding')}
            >
              🏢 Tenant Onboarding
            </button>
          )}
          {isAdmin && (
            <button
              className={`nav-btn ${currentPage === 'user-approvals' ? 'active' : ''}`}
              onClick={() => setCurrentPage('user-approvals')}
            >
              👥 User Approvals
            </button>
          )}
        </nav>
      </header>

      <main className="app-main">
        {currentPage === 'dashboard' && <ComplianceDashboard claims={claims} />}

        {currentPage === 'api-keys' && canManageApiKeys && <ApiKeysPage claims={claims} />}

        {currentPage === 'architecture' && <ArchitecturePage />}

        {currentPage === 'tenant-onboarding' && isAdmin && <TenantOnboardingPage />}

        {currentPage === 'tenant-onboarding' && !isAdmin && (
          <section className="dashboard-section">
            <h2>Access Denied</h2>
            <p>Tenant onboarding requires the <strong>admin</strong> role.</p>
          </section>
        )}

        {currentPage === 'user-approvals' && isAdmin && <AdminApprovalPage />}

        {currentPage === 'user-approvals' && !isAdmin && (
          <section className="dashboard-section">
            <h2>Access Denied</h2>
            <p>User approvals require the <strong>admin</strong> role.</p>
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
