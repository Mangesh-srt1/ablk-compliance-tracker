/**
 * ComplianceChecksPage
 * Submit and view compliance checks (KYC/AML/Transfer).
 */

import React, { useState } from 'react';
import { complianceAPI } from '../services/complianceAPI';
import '../styles/ComplianceChecksPage.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const JURISDICTIONS = [
  { code: 'AE', label: 'AE — United Arab Emirates (Dubai / DFSA)' },
  { code: 'US', label: 'US — United States (SEC / FinCEN)' },
  { code: 'IN', label: 'IN — India (SEBI)' },
  { code: 'SG', label: 'SG — Singapore (MAS)' },
  { code: 'UK', label: 'UK — United Kingdom (FCA)' },
  { code: 'EU', label: 'EU — European Union (MiCA / AMLD)' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'INR', 'SGD'];

// ─── Result Panel ─────────────────────────────────────────────────────────────

interface CheckResult {
  check_id: string;
  status: string;
  risk_score: number;
  confidence: number;
  reasoning: string;
  flags?: string[];
  timestamp: string;
  // Component risk scores (optional, derived from backend checks)
  kyc_risk?: number;
  aml_risk?: number;
  sanctions_risk?: number;
  jurisdiction_risk?: number;
  // Transaction context
  from_address?: string;
  to_address?: string;
  amount?: number;
  currency?: string;
  jurisdiction?: string;
}

// ─── Risk Score Row ────────────────────────────────────────────────────────────

interface RiskRowProps {
  label: string;
  icon: string;
  score: number;
  statusText: string;
}

const RiskRow: React.FC<RiskRowProps> = ({ label, icon, score, statusText }) => {
  const cls = score >= 70 ? 'score-high' : score >= 30 ? 'score-medium' : 'score-low';
  const pct = Math.min(100, score);
  return (
    <div className="cc-risk-row">
      <span className="cc-risk-row-icon">{icon}</span>
      <div className="cc-risk-row-info">
        <span className="cc-risk-row-label">{label}</span>
        <span className={`cc-risk-row-status ${cls}`}>{statusText}</span>
      </div>
      <div className="cc-risk-bar-wrap">
        <div className="cc-risk-bar-bg">
          <div className={`cc-risk-bar-fill ${cls}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`cc-risk-bar-score ${cls}`}>{score}/100</span>
      </div>
    </div>
  );
};

function kycStatusText(score: number): string {
  if (score <= 10) return '✅ VERIFIED';
  if (score <= 30) return '🟡 PARTIAL';
  if (score <= 70) return '🟠 PENDING';
  return '❌ FAILED';
}
function amlStatusText(score: number): string {
  if (score <= 20) return '✅ CLEAR';
  if (score <= 50) return '🟡 MEDIUM RISK';
  if (score <= 80) return '🟠 HIGH RISK';
  return '❌ VERY HIGH';
}
function sanctionsStatusText(score: number): string {
  if (score === 0) return '✅ NO MATCH';
  if (score < 100) return '🟡 POTENTIAL MATCH';
  return '❌ CONFIRMED MATCH';
}
function jurisdictionStatusText(score: number): string {
  if (score <= 10) return '✅ COMPLIANT';
  if (score <= 50) return '🟡 REVIEW';
  return '❌ NON-COMPLIANT';
}

const ResultPanel: React.FC<{ result: CheckResult; onClose: () => void; onRecheck: () => void }> = ({
  result,
  onClose,
  onRecheck,
}) => {
  const isApproved  = result.status === 'APPROVED';
  const isRejected  = result.status === 'REJECTED';

  const statusClass = isApproved ? 'cc-result-approved' : isRejected ? 'cc-result-rejected' : 'cc-result-escalated';
  const statusIcon  = isApproved ? '✅' : isRejected ? '❌' : '⚠️';
  const riskLabel   = result.risk_score >= 70 ? '🔴 High Risk' : result.risk_score >= 30 ? '🟡 Medium Risk' : '🟢 Low Risk';

  // Use provided component scores or fall back to the overall risk score as a
  // consistent proxy when individual components are unavailable.
  const kycRisk          = result.kyc_risk          ?? result.risk_score;
  const amlRisk          = result.aml_risk          ?? result.risk_score;
  const sanctionsRisk    = result.sanctions_risk    ?? 0;
  const jurisdictionRisk = result.jurisdiction_risk ?? 0;

  const handleDownloadSummary = () => {
    const lines = [
      `Compliance Check Report`,
      `Check ID: ${result.check_id}`,
      `Submitted: ${new Date(result.timestamp).toLocaleString()}`,
      `Status: ${result.status}`,
      `Risk Score: ${result.risk_score}/100 (${riskLabel})`,
      ``,
      `Risk Breakdown`,
      `  KYC Verification:  ${kycRisk}/100 — ${kycStatusText(kycRisk)}`,
      `  AML Screening:     ${amlRisk}/100 — ${amlStatusText(amlRisk)}`,
      `  Sanctions Check:   ${sanctionsRisk}/100 — ${sanctionsStatusText(sanctionsRisk)}`,
      `  Jurisdiction:      ${jurisdictionRisk}/100 — ${jurisdictionStatusText(jurisdictionRisk)}`,
      ``,
      `AI Reasoning`,
      result.reasoning,
      ``,
      `Transaction Details`,
      `  From: ${result.from_address ?? 'N/A'}`,
      `  To:   ${result.to_address   ?? 'N/A'}`,
      `  Amount: ${result.amount != null ? `${result.amount} ${result.currency ?? ''}` : 'N/A'}`,
      `  Jurisdiction: ${result.jurisdiction ?? 'N/A'}`,
      ``,
      `Flags: ${result.flags && result.flags.length > 0 ? result.flags.join(', ') : 'None'}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `compliance-report-${result.check_id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [showAuditInfo, setShowAuditInfo] = useState(false);

  return (
    <div className="cc-result-panel" role="alert">
      {/* ── Header ── */}
      <div className={`cc-result-header ${statusClass}`}>
        <span className="cc-result-icon">{statusIcon}</span>
        <div className="cc-result-header-text">
          <div className="cc-result-status">{result.status}</div>
          <div className="cc-result-meta">
            <span>Check ID: {result.check_id}</span>
            <span className="cc-result-meta-sep">·</span>
            <span>Submitted: {new Date(result.timestamp).toLocaleString()}</span>
          </div>
          <div className="cc-result-risk-badge">
            Risk Score: {result.risk_score}/100 {riskLabel}
          </div>
        </div>
        <button className="cc-close-btn" onClick={onClose} aria-label="Dismiss result">✕</button>
      </div>

      <div className="cc-result-body">
        {/* ── Risk Breakdown ── */}
        <div className="cc-section">
          <h4 className="cc-section-title">📊 Risk Breakdown</h4>
          <div className="cc-risk-breakdown">
            <RiskRow label="KYC Verification"  icon="🪪" score={kycRisk}          statusText={kycStatusText(kycRisk)}                  />
            <RiskRow label="AML Screening"     icon="🛡️" score={amlRisk}          statusText={amlStatusText(amlRisk)}                  />
            <RiskRow label="Sanctions Check"   icon="⛓️" score={sanctionsRisk}    statusText={sanctionsStatusText(sanctionsRisk)}      />
            <RiskRow label="Jurisdiction Rules" icon="🌍" score={jurisdictionRisk} statusText={jurisdictionStatusText(jurisdictionRisk)} />
          </div>
          <div className="cc-formula-note">
            Total Risk = (KYC × 30%) + (AML × 35%) + (Sanctions × 30%) + (Jurisdiction × 5%)
          </div>
        </div>

        {/* ── AI Reasoning ── */}
        <div className="cc-section">
          <h4 className="cc-section-title">🤖 AI Reasoning</h4>
          <p className="cc-reasoning-text">{result.reasoning}</p>
        </div>

        {/* ── Transaction Details ── */}
        {(result.from_address || result.to_address || result.amount != null) && (
          <div className="cc-section">
            <h4 className="cc-section-title">📋 Transaction Details</h4>
            <div className="cc-tx-details">
              {result.from_address && (
                <div className="cc-tx-row">
                  <span className="cc-tx-label">From</span>
                  <code className="cc-tx-value">{result.from_address}</code>
                </div>
              )}
              {result.to_address && (
                <div className="cc-tx-row">
                  <span className="cc-tx-label">To</span>
                  <code className="cc-tx-value">{result.to_address}</code>
                </div>
              )}
              {result.amount != null && (
                <div className="cc-tx-row">
                  <span className="cc-tx-label">Amount</span>
                  <span className="cc-tx-value">
                    {result.amount.toLocaleString()} {result.currency ?? ''}
                  </span>
                </div>
              )}
              {result.jurisdiction && (
                <div className="cc-tx-row">
                  <span className="cc-tx-label">Jurisdiction</span>
                  <span className="cc-tx-value">{result.jurisdiction}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Flags ── */}
        {result.flags && result.flags.length > 0 && (
          <div className="cc-section">
            <h4 className="cc-section-title">⚠️ Flags</h4>
            <div className="cc-flag-chips">
              {result.flags.map((f) => (
                <span key={f} className="cc-flag-chip">{f}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="cc-result-actions">
          <button className="cc-action-btn" onClick={handleDownloadSummary} title="Download compliance check summary as text file">
            📄 Download Summary
          </button>
          <button className="cc-action-btn" onClick={() => setShowAuditInfo((v) => !v)} title="View audit trail info">
            🔍 View Audit Trail
          </button>
          <button className="cc-action-btn cc-action-btn-recheck" onClick={onRecheck} title="Submit another compliance check">
            🔄 New Check
          </button>
        </div>
        {showAuditInfo && (
          <div className="cc-audit-info" role="note">
            <strong>Audit Trail:</strong> Check <code>{result.check_id}</code> has been
            recorded in the compliance database with a tamper-evident audit log entry.
            Full audit trail history is available to compliance officers via the Reports
            &amp; Analytics section.
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

interface FormState {
  from_address: string;
  to_address: string;
  amount: string;
  currency: string;
  jurisdiction: string;
  from_name: string;
  to_name: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  from_address: '',
  to_address: '',
  amount: '',
  currency: 'USD',
  jurisdiction: 'AE',
  from_name: '',
  to_name: '',
  notes: '',
};

const ETH_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

const ComplianceChecksPage: React.FC = () => {
  const [form, setForm]           = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [result, setResult]       = useState<CheckResult | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setFieldErrors((fe) => ({ ...fe, [key]: undefined }));
  };

  const validate = (): boolean => {
    const errors: Partial<Record<keyof FormState, string>> = {};

    if (!ETH_ADDRESS_REGEX.test(form.from_address)) errors.from_address = 'Invalid wallet address (must be 0x + 40 hex chars)';
    if (!ETH_ADDRESS_REGEX.test(form.to_address)) errors.to_address = 'Invalid wallet address (must be 0x + 40 hex chars)';
    if (form.from_address.toLowerCase() === form.to_address.toLowerCase()) errors.to_address = 'Recipient address cannot be the same as sender address';
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt < 1) errors.amount = 'Amount must be a number ≥ 1';
    if (!form.from_name.trim()) errors.from_name = 'Required';
    if (!form.to_name.trim()) errors.to_name = 'Required';
    if (form.notes.length > 500) errors.notes = 'Max 500 characters';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await complianceAPI.submitTransferCheck({
        from_address: form.from_address,
        to_address: form.to_address,
        amount: parseFloat(form.amount),
        currency: form.currency,
        jurisdiction: form.jurisdiction,
        from_name: form.from_name,
        to_name: form.to_name,
        notes: form.notes || undefined,
      });
      setResult(res);
      setForm(EMPTY_FORM);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string; error?: string } }; message?: string };
      setError(err?.response?.data?.message ?? err?.response?.data?.error ?? err?.message ?? 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setForm(EMPTY_FORM);
    setError(null);
    setResult(null);
    setFieldErrors({});
  };

  const allRequired = form.from_address && form.to_address && form.amount && form.from_name && form.to_name;

  return (
    <div className="cc-root">
      <div className="cc-header">
        <h2 className="cc-title">✅ Compliance Checks</h2>
        <p className="cc-subtitle">Submit a manual transfer compliance check (KYC + AML + Sanctions)</p>
      </div>

      {result && (
        <ResultPanel result={result} onClose={() => setResult(null)} onRecheck={() => { setResult(null); setForm(EMPTY_FORM); }} />
      )}

      {error && (
        <div className="cc-error-banner" role="alert">
          <strong>⚠ Error:</strong> {error}
          <button className="cc-close-inline" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="cc-form-card">
        <h3 className="cc-form-title">Transfer Compliance Check</h3>

        <div className="cc-form-grid">
          {/* From Wallet */}
          <label className="cc-label cc-span2">
            From Wallet Address <span className="cc-required">*</span>
            <input
              className={`cc-input ${fieldErrors.from_address ? 'cc-input-error' : ''}`}
              value={form.from_address}
              onChange={set('from_address')}
              placeholder="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
              spellCheck={false}
            />
            {fieldErrors.from_address && <span className="cc-field-error">{fieldErrors.from_address}</span>}
          </label>

          {/* To Wallet */}
          <label className="cc-label cc-span2">
            To Wallet Address <span className="cc-required">*</span>
            <input
              className={`cc-input ${fieldErrors.to_address ? 'cc-input-error' : ''}`}
              value={form.to_address}
              onChange={set('to_address')}
              placeholder="0x8626f8abCD0A929B9c8f5F08E5B5C6A3f7dD9e12"
              spellCheck={false}
            />
            {fieldErrors.to_address && <span className="cc-field-error">{fieldErrors.to_address}</span>}
          </label>

          {/* Amount */}
          <label className="cc-label">
            Transfer Amount <span className="cc-required">*</span>
            <input
              className={`cc-input ${fieldErrors.amount ? 'cc-input-error' : ''}`}
              type="number"
              min={1}
              value={form.amount}
              onChange={set('amount')}
              placeholder="50000"
            />
            {fieldErrors.amount && <span className="cc-field-error">{fieldErrors.amount}</span>}
          </label>

          {/* Currency */}
          <label className="cc-label">
            Currency
            <select className="cc-select" value={form.currency} onChange={set('currency')}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          {/* Jurisdiction */}
          <label className="cc-label cc-span2">
            Jurisdiction <span className="cc-required">*</span>
            <select className="cc-select" value={form.jurisdiction} onChange={set('jurisdiction')}>
              {JURISDICTIONS.map((j) => (
                <option key={j.code} value={j.code}>{j.label}</option>
              ))}
            </select>
            <span className="cc-hint">Determines applicable compliance rules</span>
          </label>

          {/* From Name */}
          <label className="cc-label">
            Entity Name (From) <span className="cc-required">*</span>
            <input
              className={`cc-input ${fieldErrors.from_name ? 'cc-input-error' : ''}`}
              value={form.from_name}
              onChange={set('from_name')}
              placeholder="John Doe"
            />
            {fieldErrors.from_name && <span className="cc-field-error">{fieldErrors.from_name}</span>}
          </label>

          {/* To Name */}
          <label className="cc-label">
            Entity Name (To) <span className="cc-required">*</span>
            <input
              className={`cc-input ${fieldErrors.to_name ? 'cc-input-error' : ''}`}
              value={form.to_name}
              onChange={set('to_name')}
              placeholder="ABC Corporation Ltd"
            />
            {fieldErrors.to_name && <span className="cc-field-error">{fieldErrors.to_name}</span>}
          </label>

          {/* Notes */}
          <label className="cc-label cc-span2">
            Additional Notes <span className="cc-optional">(optional, max 500 chars)</span>
            <textarea
              className={`cc-textarea ${fieldErrors.notes ? 'cc-input-error' : ''}`}
              value={form.notes}
              onChange={set('notes')}
              rows={3}
              maxLength={500}
              placeholder="e.g. First-time investor, source of funds verified separately"
            />
            <span className="cc-char-count">{form.notes.length}/500</span>
            {fieldErrors.notes && <span className="cc-field-error">{fieldErrors.notes}</span>}
          </label>
        </div>

        {/* Validation summary */}
        <div className="cc-validation-summary">
          <div className={`cc-val-item ${ETH_ADDRESS_REGEX.test(form.from_address) ? 'val-ok' : 'val-pending'}`}>
            {ETH_ADDRESS_REGEX.test(form.from_address) ? '✅' : '⬜'} Valid from address
          </div>
          <div className={`cc-val-item ${ETH_ADDRESS_REGEX.test(form.to_address) ? 'val-ok' : 'val-pending'}`}>
            {ETH_ADDRESS_REGEX.test(form.to_address) ? '✅' : '⬜'} Valid to address
          </div>
          <div className={`cc-val-item ${parseFloat(form.amount) >= 1 ? 'val-ok' : 'val-pending'}`}>
            {parseFloat(form.amount) >= 1 ? '✅' : '⬜'} Amount ≥ 1
          </div>
          <div className={`cc-val-item ${form.jurisdiction ? 'val-ok' : 'val-pending'}`}>
            {form.jurisdiction ? '✅' : '⬜'} Jurisdiction selected
          </div>
          <div className={`cc-val-item ${form.from_name.trim() && form.to_name.trim() ? 'val-ok' : 'val-pending'}`}>
            {form.from_name.trim() && form.to_name.trim() ? '✅' : '⬜'} Entity names filled
          </div>
        </div>

        <div className="cc-form-actions">
          <button className="cc-btn-secondary" onClick={handleReset} disabled={loading}>
            Reset
          </button>
          <button
            className="cc-btn-primary"
            onClick={handleSubmit}
            disabled={!allRequired || loading}
          >
            {loading ? (
              <>
                <span className="cc-spinner" />
                Processing…
              </>
            ) : (
              'Submit Compliance Check'
            )}
          </button>
        </div>

        {loading && (
          <div className="cc-processing-msg" role="status">
            <span className="cc-spinner" />
            Processing compliance check… (~2–5 seconds)
          </div>
        )}
      </div>

      {/* Info panel */}
      <div className="cc-info-card">
        <h3 className="cc-info-title">ℹ️ What happens when you submit?</h3>
        <ol className="cc-info-list">
          <li>🪪 AI agents check KYC database</li>
          <li>🛡️ AML risk scoring (Marble AI)</li>
          <li>⛓️ Sanctions screening (Chainalysis)</li>
          <li>🌍 Jurisdiction rules applied ({JURISDICTIONS.find(j => j.code === form.jurisdiction)?.label ?? form.jurisdiction})</li>
          <li>🤖 LLM reasoning generated</li>
        </ol>
        <div className="cc-risk-legend">
          <div className="cc-legend-item">
            <span className="cc-legend-dot dot-low" /> <strong>0–29:</strong> Auto-approved
          </div>
          <div className="cc-legend-item">
            <span className="cc-legend-dot dot-medium" /> <strong>30–69:</strong> Pending review
          </div>
          <div className="cc-legend-item">
            <span className="cc-legend-dot dot-high" /> <strong>70–100:</strong> Rejected / Escalated
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComplianceChecksPage;
