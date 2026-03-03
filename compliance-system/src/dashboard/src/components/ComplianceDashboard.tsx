/**
 * ComplianceDashboard – Flow 2
 * Live compliance monitoring view for tenant users.
 * Pulls aggregated metrics + risk trends + cases from the backend.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  complianceAPI,
  DashboardData,
  ComplianceCase,
  CaseType,
} from '../services/complianceAPI';
import type { TokenClaims } from '../services/authAPI';
import '../styles/ComplianceDashboard.css';

// ─── constants ────────────────────────────────────────────────────────────────

const DEFAULT_CASE_LIMIT = 10;

// ─── Role helper ──────────────────────────────────────────────────────────────

/** Returns true for roles that can create/manage compliance cases. */
function canManageCases(role: string): boolean {
  return role === 'compliance_officer' || role === 'admin';
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  OPEN: '#ef4444',
  INVESTIGATING: '#f59e0b',
  PENDING_INFO: '#3b82f6',
  RESOLVED: '#10b981',
  REPORTED: '#8b5cf6',
};

const CASE_TYPE_ICON: Record<CaseType, string> = {
  SUSPICIOUS_ACTIVITY: '🚨',
  FAILED_KYC: '🪪',
  SANCTIONS_HIT: '🛑',
  CORPORATE_ACTION_DISPUTE: '🏢',
  DATA_BREACH: '🔓',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Simple inline bar chart (no external lib) ───────────────────────────────

interface BarChartProps {
  data: Array<{ label: string; value: number }>;
  max?: number;
  color?: string;
}

const BarChart: React.FC<BarChartProps> = ({ data, max, color = '#667eea' }) => {
  const peak = max ?? Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="cd-bar-chart">
      {data.map((d) => (
        <div key={d.label} className="cd-bar-row">
          <span className="cd-bar-label">{d.label}</span>
          <div className="cd-bar-track">
            <div
              className="cd-bar-fill"
              style={{ width: `${Math.round((d.value / peak) * 100)}%`, background: color }}
            />
          </div>
          <span className="cd-bar-value">{d.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Trend sparkline ─────────────────────────────────────────────────────────

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 200,
  height = 48,
  color = '#667eea',
}) => {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data
    .map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 4) - 2}`)
    .join(' ');
  return (
    <svg
      className="cd-sparkline"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: `${height}px` }}
    >
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
};

// ─── New-case mini form ───────────────────────────────────────────────────────

interface NewCaseFormProps {
  onCreated: (c: ComplianceCase) => void;
  onClose: () => void;
}

const CASE_TYPES: CaseType[] = [
  'SUSPICIOUS_ACTIVITY',
  'FAILED_KYC',
  'SANCTIONS_HIT',
  'CORPORATE_ACTION_DISPUTE',
  'DATA_BREACH',
];

const NewCaseForm: React.FC<NewCaseFormProps> = ({ onCreated, onClose }) => {
  const [caseType, setCaseType] = useState<CaseType>('SUSPICIOUS_ACTIVITY');
  const [entityId, setEntityId] = useState('');
  const [jurisdiction, setJurisdiction] = useState('AE');
  const [summary, setSummary] = useState('');
  const [riskScore, setRiskScore] = useState<number>(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const c = await complianceAPI.createCase({
        caseType,
        entityId,
        jurisdiction,
        summary,
        riskScore,
      });
      onCreated(c);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e.message ?? 'Failed to create case');
    } finally {
      setLoading(false);
    }
  };

  const valid = entityId.trim() && jurisdiction.trim() && summary.trim();

  return (
    <div className="cd-modal-backdrop" onClick={onClose}>
      <div className="cd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cd-modal-header">
          <h3>Open New Compliance Case</h3>
          <button className="cd-close-btn" onClick={onClose}>✕</button>
        </div>

        {error && <div className="cd-error">{error}</div>}

        <div className="cd-form-grid">
          <label>
            Case Type
            <select value={caseType} onChange={(e) => setCaseType(e.target.value as CaseType)}>
              {CASE_TYPES.map((t) => (
                <option key={t} value={t}>{CASE_TYPE_ICON[t]} {t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </label>

          <label>
            Entity ID
            <input
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              placeholder="wallet / entity ID"
            />
          </label>

          <label>
            Jurisdiction
            <input
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value.toUpperCase())}
              placeholder="AE / US / IN"
              maxLength={10}
            />
          </label>

          <label>
            Risk Score (0–100)
            <input
              type="number"
              min={0}
              max={100}
              value={riskScore}
              onChange={(e) => setRiskScore(Number(e.target.value))}
            />
          </label>

          <label className="cd-span2">
            Summary
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              placeholder="Brief description of the compliance concern…"
            />
          </label>
        </div>

        <div className="cd-modal-actions">
          <button className="cd-btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            className="cd-btn-primary"
            onClick={submit}
            disabled={!valid || loading}
          >
            {loading ? 'Creating…' : 'Create Case'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  claims: TokenClaims;
}

const ComplianceDashboard: React.FC<Props> = ({ claims }) => {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [cases, setCases] = useState<ComplianceCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewCase, setShowNewCase] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const isComplianceOfficer = canManageCases(claims.role);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dash, caseList] = await Promise.all([
        complianceAPI.getDashboard(),
        complianceAPI.listCases({ limit: DEFAULT_CASE_LIMIT }),
      ]);
      setDashboard(dash);
      setCases(caseList);
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(
        e?.response?.data?.error ??
          e.message ??
          'Unable to connect to the compliance API. Ensure the API service is running.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCaseCreated = (c: ComplianceCase) => {
    setCases((prev) => [c, ...prev]);
    setShowNewCase(false);
  };

  // ── Skeleton / error states ──────────────────────────────────────────────

  if (loading && !dashboard) {
    return (
      <div className="cd-loading">
        <div className="cd-spinner" />
        <p>Loading compliance data…</p>
      </div>
    );
  }

  const m = dashboard?.metrics;

  // Trend data for sparkline
  const trendScores = (dashboard?.recentTrends ?? []).map((t) => t.averageRiskScore ?? 0);

  return (
    <div className="cd-root">
      {/* ── Header bar ─────────────────────────────────────────────────────── */}
      <div className="cd-topbar">
        <div>
          <h2 className="cd-title">Compliance Dashboard</h2>
          {lastRefresh && (
            <span className="cd-refresh-time">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="cd-topbar-actions">
          {isComplianceOfficer && (
            <button className="cd-btn-primary" onClick={() => setShowNewCase(true)}>
              + New Case
            </button>
          )}
          <button className="cd-btn-secondary" onClick={load} disabled={loading}>
            {loading ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="cd-error-banner">
          <strong>⚠ API Unavailable</strong> — {error}
          <button className="cd-retry-btn" onClick={load}>Retry</button>
        </div>
      )}

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      <div className="cd-kpi-grid">
        <div className="cd-kpi-card cd-kpi-total">
          <span className="cd-kpi-icon">📋</span>
          <div>
            <div className="cd-kpi-label">Total Checks</div>
            <div className="cd-kpi-value">{m?.totalChecks ?? '—'}</div>
          </div>
        </div>
        <div className="cd-kpi-card cd-kpi-approved">
          <span className="cd-kpi-icon">✅</span>
          <div>
            <div className="cd-kpi-label">Approved</div>
            <div className="cd-kpi-value">{m?.approved ?? '—'}</div>
          </div>
        </div>
        <div className="cd-kpi-card cd-kpi-escalated">
          <span className="cd-kpi-icon">⚠️</span>
          <div>
            <div className="cd-kpi-label">Escalated</div>
            <div className="cd-kpi-value">{m?.escalated ?? '—'}</div>
          </div>
        </div>
        <div className="cd-kpi-card cd-kpi-rejected">
          <span className="cd-kpi-icon">❌</span>
          <div>
            <div className="cd-kpi-label">Rejected</div>
            <div className="cd-kpi-value">{m?.rejected ?? '—'}</div>
          </div>
        </div>
        <div className="cd-kpi-card cd-kpi-pending">
          <span className="cd-kpi-icon">🕐</span>
          <div>
            <div className="cd-kpi-label">Pending Review</div>
            <div className="cd-kpi-value">{m?.pendingReview ?? '—'}</div>
          </div>
        </div>
        <div className="cd-kpi-card cd-kpi-risk">
          <span className="cd-kpi-icon">🎯</span>
          <div>
            <div className="cd-kpi-label">Avg Risk Score</div>
            <div className="cd-kpi-value">
              {m?.averageRiskScore != null
                ? m.averageRiskScore.toFixed(1)
                : '—'}
            </div>
          </div>
          {trendScores.length > 1 && (
            <Sparkline data={trendScores} color="rgba(255,255,255,0.7)" />
          )}
        </div>
      </div>

      {/* ── Mid row: risk factors + tenant context ─────────────────────────── */}
      <div className="cd-mid-row">
        {/* Risk Factors */}
        <div className="cd-panel">
          <h3 className="cd-panel-title">Top Risk Factors</h3>
          {dashboard?.topRiskFactors?.length ? (
            <BarChart
              data={dashboard.topRiskFactors.map((f) => ({
                label: f.factor,
                value: f.count,
              }))}
            />
          ) : (
            <p className="cd-empty">No risk factor data yet.</p>
          )}
        </div>

        {/* 7-day trend */}
        <div className="cd-panel">
          <h3 className="cd-panel-title">7-Day Risk Trend</h3>
          {dashboard?.recentTrends?.length ? (
            <>
              <Sparkline
                data={dashboard.recentTrends.map((t) => t.averageRiskScore ?? 0)}
                height={80}
                color="#667eea"
              />
              <BarChart
                data={dashboard.recentTrends.map((t) => ({
                  label: t.date?.slice(5) ?? '',
                  value: t.totalChecks ?? 0,
                }))}
                color="#764ba2"
              />
            </>
          ) : (
            <p className="cd-empty">No trend data yet.</p>
          )}
        </div>

        {/* Session / tenant context */}
        <div className="cd-panel cd-panel-context">
          <h3 className="cd-panel-title">Your Session</h3>
          <table className="cd-context-table">
            <tbody>
              <tr><td>User</td><td><code>{claims.email ?? claims.sub}</code></td></tr>
              <tr><td>Tenant</td><td><code>{claims.tenant ?? '—'}</code></td></tr>
              <tr><td>Role</td><td><span className="cd-role-badge">{claims.role}</span></td></tr>
              <tr>
                <td>Products</td>
                <td>
                  <div className="cd-product-chips">
                    {(claims.products ?? []).map((p) => (
                      <span key={p} className="cd-chip">{p}</span>
                    ))}
                  </div>
                </td>
              </tr>
              {claims.scope && (
                <tr>
                  <td>Scopes</td>
                  <td>
                    <div className="cd-product-chips">
                      {claims.scope.split(' ').map((s) => (
                        <span key={s} className="cd-chip cd-chip-scope">{s}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
              <tr><td>High-Risk</td><td><strong className="cd-risk-num">{m?.highRiskEntities ?? '—'}</strong> entities</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Cases table ────────────────────────────────────────────────────── */}
      <div className="cd-panel cd-panel-full">
        <div className="cd-panel-header-row">
          <h3 className="cd-panel-title">Recent Cases</h3>
          <span className="cd-count-badge">{cases.length} shown</span>
        </div>

        {cases.length === 0 ? (
          <div className="cd-empty-cases">
            <p>No compliance cases found.</p>
            {isComplianceOfficer && (
              <button className="cd-btn-primary" onClick={() => setShowNewCase(true)}>
                Open First Case
              </button>
            )}
          </div>
        ) : (
          <div className="cd-table-wrap">
            <table className="cd-cases-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Entity</th>
                  <th>Jurisdiction</th>
                  <th>Risk</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.caseId}>
                    <td>
                      <span className="cd-case-type-icon">{CASE_TYPE_ICON[c.caseType]}</span>
                      <span className="cd-case-type-label">{c.caseType.replace(/_/g, ' ')}</span>
                    </td>
                    <td><code className="cd-entity">{c.entityId}</code></td>
                    <td>{c.jurisdiction}</td>
                    <td>
                      <span
                        className="cd-risk-pill"
                        style={{
                          background:
                            (c.riskScore ?? 0) >= 70
                              ? '#fef2f2'
                              : (c.riskScore ?? 0) >= 40
                              ? '#fffbeb'
                              : '#f0fdf4',
                          color:
                            (c.riskScore ?? 0) >= 70
                              ? '#b91c1c'
                              : (c.riskScore ?? 0) >= 40
                              ? '#b45309'
                              : '#15803d',
                        }}
                      >
                        {c.riskScore ?? '—'}
                      </span>
                    </td>
                    <td>
                      <span
                        className="cd-status-pill"
                        style={{ background: `${STATUS_COLOR[c.status]}22`, color: STATUS_COLOR[c.status] }}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td>{fmtDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── New case modal ─────────────────────────────────────────────────── */}
      {showNewCase && (
        <NewCaseForm onCreated={handleCaseCreated} onClose={() => setShowNewCase(false)} />
      )}
    </div>
  );
};

export default ComplianceDashboard;
