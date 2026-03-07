/**
 * SettingsPage – Section 11 of the Compliance Dashboard
 * Implements:
 *   11.1 User Profile Settings (profile info, 2FA, change password)
 *   11.2 Notification Preferences (email / in-app / SMS, quiet hours)
 *   11.3 System Configuration – Admin Only (jurisdictions, API integrations, DB, audit)
 */

import React, { useState } from 'react';
import { TokenClaims } from '../services/authAPI';
import '../styles/SettingsPage.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SettingsPageProps {
  claims: TokenClaims;
}

type SettingsTab = 'profile' | 'notifications' | 'system';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels: [string, string][] = [
    ['Very Weak', '#ef4444'],
    ['Weak',      '#f97316'],
    ['Fair',      '#f59e0b'],
    ['Good',      '#3b82f6'],
    ['Strong',    '#10b981'],
  ];
  const idx = Math.min(score, 4);
  return { score, label: labels[idx][0], color: labels[idx][1] };
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────

const ProfileTab: React.FC<{ claims: TokenClaims }> = ({ claims }) => {
  const [saved,        setSaved]        = useState(false);
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [showQr,       setShowQr]       = useState(false);
  const [twoFaCode,    setTwoFaCode]    = useState('');
  const [twoFaVerified, setTwoFaVerified] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw,     setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaved,   setPwSaved]   = useState(false);
  const [pwError,   setPwError]   = useState('');

  const strength = passwordStrength(newPw);

  const handleSaveProfile = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleEnable2FA = () => {
    setShowQr(true);
  };

  const handleVerify2FA = () => {
    if (twoFaCode.length === 6) {
      setTwoFaVerified(true);
      setTwoFaEnabled(true);
      setShowQr(false);
    }
  };

  const handleChangePw = () => {
    setPwError('');
    if (!currentPw) { setPwError('Current password required.'); return; }
    if (newPw.length < 12) { setPwError('New password must be at least 12 characters.'); return; }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return; }
    setPwSaved(true);
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
    setTimeout(() => setPwSaved(false), 3000);
  };

  return (
    <div className="sp-panel">
      {/* Personal Information */}
      <section className="sp-section">
        <h3 className="sp-section-title">👤 Personal Information</h3>
        <div className="sp-form-grid">
          <label className="sp-form-label">
            Full Name
            <input type="text" className="sp-input" defaultValue="Compliance Officer" />
          </label>
          <label className="sp-form-label">
            Email
            <input type="email" className="sp-input" value={claims.email ?? ''} readOnly disabled />
            <span className="sp-input-note">Cannot be changed – contact admin</span>
          </label>
          <label className="sp-form-label">
            Phone Number
            <input type="tel" className="sp-input" placeholder="+1-555-123-4567" />
          </label>
          <label className="sp-form-label">
            Role
            <input type="text" className="sp-input" value={claims.role ?? '—'} readOnly disabled />
            <span className="sp-input-note">Assigned by administrator</span>
          </label>
          <label className="sp-form-label">
            Timezone
            <select className="sp-select">
              <option>UTC+00:00 (Coordinated Universal Time)</option>
              <option>UTC+05:30 (India Standard Time)</option>
              <option>UTC+04:00 (Gulf Standard Time)</option>
              <option>UTC-05:00 (Eastern Standard Time)</option>
              <option>UTC+08:00 (Singapore Standard Time)</option>
              <option>UTC+00:00 (Greenwich Mean Time)</option>
            </select>
          </label>
          <label className="sp-form-label">
            Language
            <select className="sp-select">
              <option>English (US)</option>
              <option>English (UK)</option>
              <option>Arabic</option>
              <option>Hindi</option>
              <option>Chinese (Simplified)</option>
            </select>
          </label>
        </div>
        <button className="sp-btn-primary" onClick={handleSaveProfile}>Save Changes</button>
        {saved && <span className="sp-success-msg">✅ Profile saved!</span>}
      </section>

      {/* 2FA */}
      <section className="sp-section">
        <h3 className="sp-section-title">🔒 Two-Factor Authentication (2FA)</h3>
        {!twoFaEnabled && !showQr && (
          <div className="sp-2fa-box">
            <div className="sp-2fa-status sp-status-off">❌ Disabled</div>
            <p className="sp-2fa-note">⚠️ Recommended: Enable 2FA for extra security on your account.</p>
            <button className="sp-btn-primary" onClick={handleEnable2FA}>Enable 2FA</button>
          </div>
        )}
        {!twoFaEnabled && showQr && (
          <div className="sp-2fa-box">
            <p>Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):</p>
            <div className="sp-qr-placeholder" aria-label="QR Code placeholder">
              <div className="sp-qr-inner">📷 QR Code</div>
            </div>
            <p className="sp-2fa-note">Alternatively, enter the setup key manually: <code>ABCDEFGHIJ234567</code></p>
            <label className="sp-form-label" style={{ maxWidth: '200px' }}>
              Enter 6-digit code
              <input
                type="text"
                className="sp-input"
                maxLength={6}
                placeholder="123456"
                value={twoFaCode}
                onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, ''))}
              />
            </label>
            <div className="sp-inline-actions">
              <button className="sp-btn-secondary" onClick={() => setShowQr(false)}>Cancel</button>
              <button className="sp-btn-primary" onClick={handleVerify2FA} disabled={twoFaCode.length !== 6}>Verify & Enable</button>
            </div>
          </div>
        )}
        {twoFaEnabled && (
          <div className="sp-2fa-box">
            <div className="sp-2fa-status sp-status-on">✅ Enabled</div>
            {twoFaVerified && <p className="sp-success-text">2FA has been activated. Store your backup codes safely.</p>}
            <div className="sp-2fa-actions">
              <button className="sp-btn-secondary" onClick={() => window.alert('Backup codes generated and displayed. Store them securely.')}>
                🔑 View Backup Codes
              </button>
              <button className="sp-btn-danger" onClick={() => { setTwoFaEnabled(false); setTwoFaVerified(false); }}>
                Disable 2FA
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Change Password */}
      <section className="sp-section">
        <h3 className="sp-section-title">🔑 Change Password</h3>
        <div className="sp-pw-form">
          <label className="sp-form-label">
            Current Password *
            <input
              type="password"
              className="sp-input"
              placeholder="••••••••••••"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
            />
          </label>
          <label className="sp-form-label">
            New Password *
            <input
              type="password"
              className="sp-input"
              placeholder="••••••••••••"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
            {newPw && (
              <div className="sp-pw-strength">
                <div className="sp-pw-bar-track">
                  <div
                    className="sp-pw-bar-fill"
                    style={{ width: `${(strength.score / 5) * 100}%`, background: strength.color }}
                  />
                </div>
                <span className="sp-pw-label" style={{ color: strength.color }}>{strength.label}</span>
              </div>
            )}
          </label>
          <label className="sp-form-label">
            Confirm New Password *
            <input
              type="password"
              className="sp-input"
              placeholder="••••••••••••"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
            />
          </label>
        </div>
        <div className="sp-pw-rules">
          <p className="sp-rules-title">Password must contain:</p>
          <ul className="sp-rules-list">
            {[
              ['Minimum 12 characters',                     newPw.length >= 12],
              ['At least 1 uppercase letter (A–Z)',         /[A-Z]/.test(newPw)],
              ['At least 1 lowercase letter (a–z)',         /[a-z]/.test(newPw)],
              ['At least 1 number (0–9)',                   /[0-9]/.test(newPw)],
              ['At least 1 special character (!@#$%^&*)',   /[^A-Za-z0-9]/.test(newPw)],
              ['Cannot be same as previous 5 passwords',   false],
            ].map(([label, met]) => (
              <li key={label as string} className={`sp-rule ${met ? 'sp-rule-met' : ''}`}>
                {met ? '✅' : '○'} {label as string}
              </li>
            ))}
          </ul>
        </div>
        {pwError && <div className="sp-error-msg">{pwError}</div>}
        <button className="sp-btn-primary" onClick={handleChangePw}>Update Password</button>
        {pwSaved && <span className="sp-success-msg">✅ Password updated!</span>}
      </section>

      {/* Session Management */}
      <section className="sp-section sp-section-info">
        <h3 className="sp-section-title">🕐 Session Management</h3>
        <div className="sp-info-grid">
          <div>Inactivity timeout: <strong>15 minutes</strong></div>
          <div>Warning shown: <strong>2 minutes</strong> before expiry</div>
          <div>Click <em>"Stay Logged In"</em> in the warning dialog to extend your session.</div>
        </div>
      </section>
    </div>
  );
};

// ─── Notifications Tab ────────────────────────────────────────────────────────

interface NotifToggleState { [key: string]: boolean }
function useNotificationToggles(initial: NotifToggleState) {
  const [state, setState] = useState(initial);
  const toggle = (key: string) => setState((s) => ({ ...s, [key]: !s[key] }));
  return { state, toggle };
}

const NotificationsTab: React.FC = () => {
  const email  = useNotificationToggles({ critical: true, high: true, medium: true, low: false, workflowFail: true, maintenance: true, updates: false });
  const inApp  = useNotificationToggles({ allAlerts: true, assigned: true, comments: true, weeklySummary: false });
  const [quietEnabled, setQuietEnabled] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const EmailRow: React.FC<{ id: string; label: string }> = ({ id, label }) => (
    <label className="sp-notif-row">
      <input type="checkbox" checked={email.state[id] ?? false} onChange={() => email.toggle(id)} />
      {label}
    </label>
  );

  const InAppRow: React.FC<{ id: string; label: string }> = ({ id, label }) => (
    <label className="sp-notif-row">
      <input type="checkbox" checked={inApp.state[id] ?? false} onChange={() => inApp.toggle(id)} />
      {label}
    </label>
  );

  return (
    <div className="sp-panel">
      <section className="sp-section">
        <h3 className="sp-section-title">📧 Email Notifications</h3>
        <div className="sp-notif-list">
          <EmailRow id="critical"     label="Critical alerts (immediate)" />
          <EmailRow id="high"         label="High priority alerts (immediate)" />
          <EmailRow id="medium"       label="Medium priority alerts (daily digest at 9 AM)" />
          <EmailRow id="low"          label="Low priority alerts (weekly digest, Friday 5 PM)" />
          <EmailRow id="workflowFail" label="Workflow execution failures" />
          <EmailRow id="maintenance"  label="System maintenance notices" />
          <EmailRow id="updates"      label="Product updates & news" />
        </div>
      </section>

      <section className="sp-section">
        <h3 className="sp-section-title">🔔 In-App Notifications</h3>
        <div className="sp-notif-list">
          <InAppRow id="allAlerts"    label="All compliance alerts" />
          <InAppRow id="assigned"     label="Checks assigned to me" />
          <InAppRow id="comments"     label="Comments on my checks" />
          <InAppRow id="weeklySummary" label="Weekly performance summary" />
        </div>
      </section>

      <section className="sp-section">
        <h3 className="sp-section-title">📱 SMS Notifications <span className="sp-badge-info">Additional charges may apply</span></h3>
        <div className="sp-sms-form">
          <label className="sp-form-label" style={{ maxWidth: '260px' }}>
            Phone Number
            <div className="sp-phone-row">
              <input type="tel" className="sp-input" placeholder="+1-555-123-4567" />
              <button className="sp-btn-secondary" onClick={() => window.alert('Verification SMS sent.')}>Verify</button>
            </div>
          </label>
          <label className="sp-notif-row">
            <input type="checkbox" defaultChecked />
            Critical alerts only
          </label>
          <label className="sp-notif-row">
            <input type="checkbox" />
            High priority alerts
          </label>
        </div>
      </section>

      <section className="sp-section">
        <h3 className="sp-section-title">🌙 Quiet Hours</h3>
        <label className="sp-notif-row">
          <input type="checkbox" checked={quietEnabled} onChange={(e) => setQuietEnabled(e.target.checked)} />
          Enable quiet hours
        </label>
        {quietEnabled && (
          <div className="sp-quiet-row">
            <label>
              From
              <select className="sp-select-sm">
                <option>10:00 PM</option>
                <option>09:00 PM</option>
                <option>11:00 PM</option>
              </select>
            </label>
            <label>
              To
              <select className="sp-select-sm">
                <option>07:00 AM</option>
                <option>06:00 AM</option>
                <option>08:00 AM</option>
              </select>
            </label>
          </div>
        )}
        <p className="sp-input-note" style={{ marginTop: '0.4rem' }}>Critical alerts bypass quiet hours.</p>
      </section>

      <div className="sp-save-bar">
        <button className="sp-btn-primary" onClick={handleSave}>Save Preferences</button>
        {saved && <span className="sp-success-msg">✅ Preferences saved!</span>}
      </div>
    </div>
  );
};

// ─── System Configuration Tab ─────────────────────────────────────────────────

const JURISDICTIONS_LIST = [
  { code: 'AE', name: 'United Arab Emirates – Dubai',  active: true  },
  { code: 'US', name: 'United States – SEC',            active: true  },
  { code: 'IN', name: 'India – SEBI',                   active: true  },
  { code: 'SG', name: 'Singapore – MAS',                active: true  },
  { code: 'UK', name: 'United Kingdom – FCA',           active: true  },
  { code: 'EU', name: 'European Union – MiFID II',      active: false },
  { code: 'HK', name: 'Hong Kong – SFC',                active: false },
];

const SystemConfigTab: React.FC<{ isAdmin: boolean }> = ({ isAdmin }) => {
  const [jActive, setJActive] = useState<Set<string>>(
    new Set(JURISDICTIONS_LIST.filter((j) => j.active).map((j) => j.code))
  );
  const [auditSaved, setAuditSaved] = useState(false);

  if (!isAdmin) {
    return (
      <div className="sp-panel">
        <div className="sp-access-denied">
          <div className="sp-access-icon">🔒</div>
          <h3>Admin Access Required</h3>
          <p>System configuration requires the <strong>admin</strong> role. Contact your system administrator if you need access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sp-panel">
      {/* Jurisdiction Rules */}
      <section className="sp-section">
        <h3 className="sp-section-title">🌍 Jurisdiction Rules Management</h3>
        <div className="sp-j-grid">
          {JURISDICTIONS_LIST.map((j) => (
            <label key={j.code} className="sp-j-row">
              <input
                type="checkbox"
                checked={jActive.has(j.code)}
                onChange={() => {
                  setJActive((prev) => {
                    const next = new Set(prev);
                    if (next.has(j.code)) next.delete(j.code); else next.add(j.code);
                    return next;
                  });
                }}
              />
              <span className="sp-j-code">{j.code}</span>
              <span className="sp-j-name">{j.name}</span>
            </label>
          ))}
        </div>
        <div className="sp-j-actions">
          <button className="sp-btn-secondary" onClick={() => window.alert('Jurisdiction rule editor opened.')}>Edit Rules</button>
          <button className="sp-btn-secondary" onClick={() => window.alert('Add jurisdiction wizard opened.')}>Add Jurisdiction</button>
          <button className="sp-btn-secondary" onClick={() => window.alert('YAML import dialog opened.')}>Import YAML</button>
        </div>
        <p className="sp-input-note">Rules last updated: Mar 1, 2026 · <button className="sp-link-btn" onClick={() => window.alert('Viewing changelog…')}>View Changelog</button></p>
      </section>

      {/* API Integrations */}
      <section className="sp-section">
        <h3 className="sp-section-title">🔌 External API Integrations</h3>
        <div className="sp-api-grid">
          {[
            { name: 'KYC Provider (Ballerine)',                    key: 'bal_••••••••••••1234', status: 'Connected' },
            { name: 'AML Provider (Marble)',                       key: 'mar_••••••••••••5678', status: 'Connected' },
            { name: 'Sanctions Screening (Chainalysis)',           key: 'cha_••••••••••••9012', status: 'Connected (Public blockchain only)' },
            { name: 'LLM Provider (Grok 4.1)',                     key: 'grok_••••••••••3456',  status: 'Connected', extra: 'Model: grok-4.1-turbo' },
          ].map((api) => (
            <div key={api.name} className="sp-api-card">
              <div className="sp-api-name">{api.name}</div>
              <div className="sp-api-status">
                <span className="sp-status-dot sp-status-green" /> {api.status}
              </div>
              <div className="sp-api-key">API Key: <code>{api.key}</code></div>
              {api.extra && <div className="sp-api-extra">{api.extra}</div>}
              <div className="sp-api-actions">
                <button className="sp-btn-sm" onClick={() => window.alert(`Testing ${api.name}… Connected ✅`)}>Test</button>
                <button className="sp-btn-sm" onClick={() => window.alert(`Update API key for ${api.name}.`)}>Update Key</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Database Configuration */}
      <section className="sp-section">
        <h3 className="sp-section-title">🗄️ Database Configuration</h3>
        <div className="sp-db-grid">
          <div className="sp-db-card">
            <div className="sp-db-title">PostgreSQL</div>
            <div className="sp-db-row"><span>Host</span><code>postgres:5432</code></div>
            <div className="sp-db-row"><span>Database</span><code>compliance_db</code></div>
            <div className="sp-db-row"><span>Status</span><span className="sp-status-ok">✅ Connected</span></div>
            <div className="sp-db-row"><span>Pool Size</span><span>20 connections</span></div>
          </div>
          <div className="sp-db-card">
            <div className="sp-db-title">Redis Cache</div>
            <div className="sp-db-row"><span>Host</span><code>redis:6379</code></div>
            <div className="sp-db-row"><span>Status</span><span className="sp-status-ok">✅ Connected</span></div>
            <div className="sp-db-row"><span>Memory</span><span>142 MB / 512 MB</span></div>
            <div className="sp-db-row"><span>Hit Rate</span><span>87.3%</span></div>
          </div>
          <div className="sp-db-card">
            <div className="sp-db-title">PGVector (AI Embeddings)</div>
            <div className="sp-db-row"><span>Status</span><span className="sp-status-ok">✅ Enabled</span></div>
            <div className="sp-db-row"><span>Vectors</span><span>12,456 stored</span></div>
            <div className="sp-db-row"><span>Dimensions</span><span>1,536</span></div>
          </div>
        </div>
        <div className="sp-db-actions">
          <button className="sp-btn-secondary" onClick={() => window.alert('Database stats page opened.')}>View Stats</button>
          <button className="sp-btn-secondary" onClick={() => window.alert('Running maintenance: VACUUM ANALYZE…')}>Run Maintenance</button>
        </div>
      </section>

      {/* Audit Log Settings */}
      <section className="sp-section">
        <h3 className="sp-section-title">📝 Audit & Compliance Logging</h3>
        <div className="sp-audit-grid">
          <div>
            <div className="sp-subheading">Audit Trail</div>
            {['Log all user actions', 'Log all compliance decisions', 'Log all system changes', 'Log API requests'].map((item) => (
              <label key={item} className="sp-notif-row">
                <input type="checkbox" defaultChecked />
                {item}
              </label>
            ))}
          </div>
          <div>
            <div className="sp-subheading">Retention Period</div>
            <label className="sp-form-label" style={{ marginBottom: '0.5rem' }}>
              Audit Logs
              <select className="sp-select">
                <option>7 years (regulatory requirement)</option>
                <option>5 years</option>
                <option>10 years</option>
              </select>
            </label>
            <label className="sp-form-label">
              System Logs
              <select className="sp-select">
                <option>90 days</option>
                <option>30 days</option>
                <option>180 days</option>
              </select>
            </label>
          </div>
          <div>
            <div className="sp-subheading">Compliance Reports</div>
            <label className="sp-notif-row">
              <input type="checkbox" defaultChecked />
              Auto-generate monthly regulatory reports
            </label>
            <label className="sp-notif-row">
              <input type="checkbox" defaultChecked />
              Archive all reports for 10 years
            </label>
          </div>
        </div>
        <div className="sp-save-bar" style={{ marginTop: '1rem' }}>
          <button className="sp-btn-secondary" onClick={() => window.alert('Audit log export started…')}>Export Audit Log</button>
          <button className="sp-btn-primary" onClick={() => { setAuditSaved(true); setTimeout(() => setAuditSaved(false), 3000); }}>Save Settings</button>
          {auditSaved && <span className="sp-success-msg">✅ Settings saved!</span>}
        </div>
      </section>
    </div>
  );
};

// ─── Main SettingsPage ────────────────────────────────────────────────────────

const SettingsPage: React.FC<SettingsPageProps> = ({ claims }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const isAdmin = claims.role === 'admin' || claims.role === 'tenant_admin';

  return (
    <div className="sp-root">
      {/* Header */}
      <div className="sp-page-header">
        <h2 className="sp-page-title">⚙️ Settings</h2>
        <p className="sp-page-subtitle">Manage your profile, notifications, and system configuration.</p>
      </div>

      {/* Tab bar */}
      <div className="sp-tabs" role="tablist">
        {([
          { id: 'profile',       label: '👤 Profile' },
          { id: 'notifications', label: '🔔 Notifications' },
          { id: 'system',        label: `🔧 System Config${isAdmin ? '' : ' 🔒'}` },
        ] as { id: SettingsTab; label: string }[]).map((tab) => (
          <button
            key={tab.id}
            className={`sp-tab ${activeTab === tab.id ? 'sp-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'profile'       && <ProfileTab      claims={claims} />}
      {activeTab === 'notifications' && <NotificationsTab />}
      {activeTab === 'system'        && <SystemConfigTab  isAdmin={isAdmin} />}
    </div>
  );
};

export default SettingsPage;
