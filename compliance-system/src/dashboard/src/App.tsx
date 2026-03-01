import { useState } from 'react'
import './index.css'
import './App.css'
import WorkflowBuilder from './components/WorkflowBuilder'

type PageType = 'dashboard' | 'workflows'

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard')
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | undefined>()

  if (currentPage === 'workflows') {
    return <WorkflowBuilder workflowId={selectedWorkflowId} onSave={() => setCurrentPage('dashboard')} />
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Ableka Lumina - Compliance Dashboard</h1>
        <p>AI-Driven Regulatory Technology Platform</p>
        <nav className="app-nav">
          <button className={`nav-btn ${currentPage === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentPage('dashboard')}>
            Dashboard
          </button>
            <button className={`nav-btn ${(currentPage as string) === 'workflows' ? 'active' : ''}`} onClick={() => { setSelectedWorkflowId(undefined); setCurrentPage('workflows') }}>
            Workflow Builder
          </button>
        </nav>
      </header>

      <main className="app-main">
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
          <p>Waiting for API connection...</p>
        </section>
      </main>

      <footer className="app-footer">
        <p>&copy; 2026 Ableka Lumina. All rights reserved.</p>
      </footer>
    </div>
  )
}

export default App
