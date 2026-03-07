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
}

const ResultPanel: React.FC<{ result: CheckResult; onClose: () => void }> = ({ result, onClose }) => {
  const isApproved  = result.status === 'APPROVED';
  const isRejected  = result.status === 'REJECTED';

  const statusClass = isApproved ? 'cc-result-approved' : isRejected ? 'cc-result-rejected' : 'cc-result-escalated';
  const statusIcon  = isApproved ? '✅' : isRejected ? '❌' : '⚠️';

  return (
    <div className="cc-result-panel" role="alert">
      <div className={`cc-result-header ${statusClass}`}>
        <span className="cc-result-icon">{statusIcon}</span>
        <div>
          <div className="cc-result-status">{result.status}</div>
          <div className="cc-result-id">Check ID: {result.check_id}</div>
        </div>
        <button className="cc-close-btn" onClick={onClose} aria-label="Dismiss result">✕</button>
      </div>
      <div className="cc-result-body">
        <div className="cc-result-scores">
          <div className="cc-score-item">
            <span className="cc-score-label">Risk Score</span>
            <span className={`cc-score-value ${result.risk_score >= 70 ? 'score-high' : result.risk_score >= 30 ? 'score-medium' : 'score-low'}`}>
              {result.risk_score}/100
            </span>
          </div>
          <div className="cc-score-item">
            <span className="cc-score-label">Confidence</span>
            <span className="cc-score-value">{Math.round(result.confidence * 100)}%</span>
          </div>
        </div>
        <div className="cc-result-reasoning">
          <strong>AI Reasoning:</strong>
          <p>{result.reasoning}</p>
        </div>
        {result.flags && result.flags.length > 0 && (
          <div className="cc-result-flags">
            <strong>Flags:</strong>
            <div className="cc-flag-chips">
              {result.flags.map((f) => (
                <span key={f} className="cc-flag-chip">{f}</span>
              ))}
            </div>
          </div>
        )}
        <div className="cc-result-time">
          Processed at: {new Date(result.timestamp).toLocaleString()}
        </div>
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
        <ResultPanel result={result} onClose={() => setResult(null)} />
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
