import './index.css'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Ableka Lumina - Compliance Dashboard</h1>
        <p>AI-Driven Regulatory Technology Platform</p>
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
