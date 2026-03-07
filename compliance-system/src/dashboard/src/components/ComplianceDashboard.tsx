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
  RecentAlert,
  JurisdictionDistribution,
} from '../services/complianceAPI';
import type { TokenClaims } from '../services/authAPI';
import '../styles/ComplianceDashboard.css';

// ─── constants ────────────────────────────────────────────────────────────────

const DEFAULT_CASE_LIMIT = 10;

// ─── Role helper ──────────────────────────────────────────────────────────────

/** Returns true for roles that can create/manage compliance cases. */
function canManageCases(role: string): boolean {
  return ['compliance_officer', 'admin', 'tenant_admin'].includes(role);
}

/** Returns true for roles that can add notes to cases (investigate). */
function canAddNotes(role: string): boolean {
  return ['compliance_analyst', 'compliance_officer', 'admin', 'tenant_admin'].includes(role);
}

/** Returns true for roles that can approve/reject reviews. */
function canApproveReviews(role: string): boolean {
  return ['compliance_officer', 'admin', 'tenant_admin'].includes(role);
}

/** Returns true for roles that can trigger manual reviews. */
function canTriggerReviews(role: string): boolean {
  return ['operator', 'compliance_officer', 'admin', 'tenant_admin'].includes(role);
}

/** Returns true for roles that can export operational reports. */
function canExportReports(role: string): boolean {
  return ['operator', 'compliance_officer', 'admin', 'tenant_admin'].includes(role);
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

// ─── Risk Score Trend Line Chart ────────────────────────────────────────────

interface RiskTrendChartProps {
  data: Array<{ date: string; averageRiskScore: number; totalChecks: number }>;
}

const RiskTrendChart: React.FC<RiskTrendChartProps> = ({ data }) => {
  if (data.length < 2) {
    return <p className="cd-empty">No trend data available yet.</p>;
  }

  const W = 600;
  const H = 160;
  const PAD = { top: 10, right: 10, bottom: 28, left: 32 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const scores = data.map((d) => d.averageRiskScore);
  const maxVal = 100;

  const xScale = (i: number) => PAD.left + (i / (data.length - 1)) * chartW;
  const yScale = (v: number) => PAD.top + chartH - (v / maxVal) * chartH;

  const points = data.map((d, i) => `${xScale(i)},${yScale(d.averageRiskScore)}`).join(' ');

  // Zone boundaries in SVG coords
  const yLow    = yScale(30);  // y coord for risk = 30
  const yMed    = yScale(70);  // y coord for risk = 70
  const yBottom = yScale(0);
  const yTop    = PAD.top;

  return (
    <div className="cd-trend-chart-wrap" role="img" aria-label="Risk score trend chart for last 7 days">
      <svg viewBox={`0 0 ${W} ${H}`} className="cd-trend-svg" preserveAspectRatio="xMidYMid meet">
        {/* Risk zones */}
        <rect x={PAD.left} y={yMed} width={chartW} height={yTop - yMed} fill="rgba(239,68,68,0.08)" />
        <rect x={PAD.left} y={yLow} width={chartW} height={yMed - yLow} fill="rgba(245,158,11,0.08)" />
        <rect x={PAD.left} y={yLow} width={chartW} height={yBottom - yLow} fill="rgba(16,185,129,0.08)" />

        {/* Zone labels */}
        <text x={PAD.left + 4} y={yMed + 12} fontSize="9" fill="rgba(239,68,68,0.6)" fontWeight="600">HIGH (70–100)</text>
        <text x={PAD.left + 4} y={yLow + 12} fontSize="9" fill="rgba(245,158,11,0.6)" fontWeight="600">MEDIUM (30–69)</text>
        <text x={PAD.left + 4} y={yBottom - 4}  fontSize="9" fill="rgba(16,185,129,0.6)" fontWeight="600">LOW (0–29)</text>

        {/* Grid lines at 30 and 70 */}
        <line x1={PAD.left} y1={yLow} x2={PAD.left + chartW} y2={yLow} stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 3" opacity="0.5" />
        <line x1={PAD.left} y1={yMed} x2={PAD.left + chartW} y2={yMed} stroke="#ef4444" strokeWidth="1" strokeDasharray="4 3" opacity="0.5" />

        {/* Y-axis labels */}
        {[0, 30, 70, 100].map((v) => (
          <text key={v} x={PAD.left - 4} y={yScale(v) + 4} fontSize="9" fill="#9ca3af" textAnchor="end">{v}</text>
        ))}

        {/* Data line */}
        <polyline points={points} fill="none" stroke="#667eea" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {/* Data points */}
        {data.map((d, i) => (
          <g key={i}>
            <circle
              cx={xScale(i)}
              cy={yScale(d.averageRiskScore)}
              r="4"
              fill="#667eea"
              stroke="white"
              strokeWidth="2"
            />
            <title>{`${d.date}: avg risk ${d.averageRiskScore.toFixed(1)}, ${d.totalChecks} checks`}</title>
          </g>
        ))}

        {/* X-axis labels */}
        {data.map((d, i) => {
          const label = d.date?.slice(5) ?? '';
          const showLabel = data.length <= 7 || i % Math.ceil(data.length / 7) === 0 || i === data.length - 1;
          return showLabel ? (
            <text key={i} x={xScale(i)} y={H - 4} fontSize="9" fill="#9ca3af" textAnchor="middle">{label}</text>
          ) : null;
        })}

        {/* Axes */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={yBottom} stroke="#e2e8f0" strokeWidth="1" />
        <line x1={PAD.left} y1={yBottom} x2={PAD.left + chartW} y2={yBottom} stroke="#e2e8f0" strokeWidth="1" />

        {/* Fill under line */}
        <polyline
          points={`${xScale(0)},${yBottom} ${points} ${xScale(data.length - 1)},${yBottom}`}
          fill="url(#riskGrad)"
          opacity="0.2"
        />
        <defs>
          <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#667eea" />
            <stop offset="100%" stopColor="#667eea" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {/* Trend summary */}
      {scores.length >= 2 && (() => {
        const first = scores[0];
        const last  = scores[scores.length - 1];
        const delta = last - first;
        const arrow = delta > 0 ? '↗' : delta < 0 ? '↘' : '→';
        const cls   = delta > 0 ? 'cd-trend-up' : delta < 0 ? 'cd-trend-down' : 'cd-trend-flat';
        return (
          <div className={`cd-trend-summary ${cls}`}>
            {arrow} {Math.abs(delta).toFixed(1)} pts over period
          </div>
        );
      })()}
    </div>
  );
};

// ─── Jurisdiction Pie Chart ───────────────────────────────────────────────────

interface JurisdictionPieChartProps {
  data: JurisdictionDistribution[];
  onJurisdictionClick?: (jurisdiction: string) => void;
}

const PIE_COLORS = ['#667eea', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

const JurisdictionPieChart: React.FC<JurisdictionPieChartProps> = ({ data, onJurisdictionClick }) => {
  const [hovered, setHovered] = useState<string | null>(null);

  if (!data || data.length === 0) {
    return <p className="cd-empty">No jurisdiction data available yet.</p>;
  }

  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const SIZE = 140;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const r  = 55;
  const inner = 28;

  let startAngle = -Math.PI / 2;
  const slices = data.slice(0, 7).map((d, i) => {
    const angle = (d.count / total) * 2 * Math.PI;
    const slice = { ...d, startAngle, endAngle: startAngle + angle, color: PIE_COLORS[i % PIE_COLORS.length] };
    startAngle += angle;
    return slice;
  });

  const arc = (sa: number, ea: number, outerR: number, innerR: number) => {
    const x1 = cx + outerR * Math.cos(sa);
    const y1 = cy + outerR * Math.sin(sa);
    const x2 = cx + outerR * Math.cos(ea);
    const y2 = cy + outerR * Math.sin(ea);
    const xi1 = cx + innerR * Math.cos(ea);
    const yi1 = cy + innerR * Math.sin(ea);
    const xi2 = cx + innerR * Math.cos(sa);
    const yi2 = cy + innerR * Math.sin(sa);
    const large = (ea - sa) > Math.PI ? 1 : 0;
    return `M${x1},${y1} A${outerR},${outerR} 0 ${large} 1 ${x2},${y2} L${xi1},${yi1} A${innerR},${innerR} 0 ${large} 0 ${xi2},${yi2} Z`;
  };

  return (
    <div className="cd-pie-wrap">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="cd-pie-svg">
        {slices.map((s) => {
          const isHovered = hovered === s.jurisdiction;
          const expandedR = isHovered ? r + 5 : r;
          return (
            <path
              key={s.jurisdiction}
              d={arc(s.startAngle, s.endAngle, expandedR, inner)}
              fill={s.color}
              opacity={hovered && !isHovered ? 0.6 : 1}
              style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
              onMouseEnter={() => setHovered(s.jurisdiction)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onJurisdictionClick?.(s.jurisdiction)}
              role="button"
              aria-label={`${s.jurisdiction}: ${s.count} checks (${s.percentage}%)`}
            >
              <title>{s.jurisdiction}: {s.count} checks ({s.percentage}%)</title>
            </path>
          );
        })}
        {/* Centre label */}
        {hovered ? (
          <>
            <text x={cx} y={cy - 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#1a202c">{hovered}</text>
            <text x={cx} y={cy + 9} textAnchor="middle" fontSize="9" fill="#718096">
              {slices.find(s => s.jurisdiction === hovered)?.percentage ?? 0}%
            </text>
          </>
        ) : (
          <>
            <text x={cx} y={cy - 4} textAnchor="middle" fontSize="9" fill="#718096">Total</text>
            <text x={cx} y={cy + 9} textAnchor="middle" fontSize="12" fontWeight="700" fill="#1a202c">{total}</text>
          </>
        )}
      </svg>

      <div className="cd-pie-legend">
        {slices.map((s) => (
          <div
            key={s.jurisdiction}
            className={`cd-pie-legend-item ${hovered === s.jurisdiction ? 'cd-pie-legend-hovered' : ''}`}
            onMouseEnter={() => setHovered(s.jurisdiction)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onJurisdictionClick?.(s.jurisdiction)}
            role="button"
            style={{ cursor: 'pointer' }}
          >
            <span className="cd-pie-dot" style={{ background: s.color }} />
            <span className="cd-pie-label">{s.jurisdiction}</span>
            <span className="cd-pie-pct">{s.percentage}%</span>
            <span className="cd-pie-count">({s.count})</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Recent Alerts Panel ─────────────────────────────────────────────────────

interface RecentAlertsPanelProps {
  alerts: RecentAlert[];
  onViewDetails: (alert: RecentAlert) => void;
  onInvestigate: (alert: RecentAlert) => void;
  onDismiss: (alertId: string) => void;
}

function riskPriority(score: number): { icon: string; label: string; cls: string } {
  if (score >= 90) return { icon: '🔴', label: 'CRITICAL', cls: 'cd-alert-critical' };
  if (score >= 70) return { icon: '🟠', label: 'HIGH',     cls: 'cd-alert-high' };
  if (score >= 50) return { icon: '🟡', label: 'MEDIUM',   cls: 'cd-alert-medium' };
  return              { icon: '🔵', label: 'LOW',      cls: 'cd-alert-low' };
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  return `${Math.floor(hrs / 24)} day(s) ago`;
}

const RecentAlertsPanel: React.FC<RecentAlertsPanelProps> = ({
  alerts,
  onViewDetails,
  onInvestigate,
  onDismiss,
}) => {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = alerts.filter((a) => !dismissed.has(a.id));

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set([...prev, id]));
    onDismiss(id);
  };

  if (visible.length === 0) {
    return (
      <div className="cd-alerts-empty">
        <span className="cd-alerts-empty-icon">✅</span>
        <p>No recent alerts — all clear!</p>
      </div>
    );
  }

  return (
    <div className="cd-alerts-list" role="list" aria-label="Recent compliance alerts">
      {visible.map((alert) => {
        const priority = riskPriority(alert.riskScore);
        const shortId  = alert.entityId.length > 12
          ? `${alert.entityId.slice(0, 6)}…${alert.entityId.slice(-4)}`
          : alert.entityId;
        return (
          <div key={alert.id} className={`cd-alert-card ${priority.cls}`} role="listitem">
            <div className="cd-alert-header">
              <span className="cd-alert-priority-icon">{priority.icon}</span>
              <span className="cd-alert-label">
                {priority.label} — {alert.flags[0] ?? alert.status.toUpperCase()}
              </span>
              <button
                className="cd-alert-dismiss"
                onClick={() => handleDismiss(alert.id)}
                title="Dismiss alert"
                aria-label="Dismiss alert"
              >
                ✕
              </button>
            </div>
            <div className="cd-alert-meta">
              <span title={alert.entityId}>Wallet: <code>{shortId}</code></span>
              <span>Risk Score: <strong>{Math.round(alert.riskScore)}/100</strong></span>
              <span>Jurisdiction: <strong>{alert.jurisdiction}</strong></span>
              <span>{timeAgo(alert.createdAt)}</span>
            </div>
            <div className="cd-alert-actions">
              <button
                className="cd-alert-btn cd-alert-btn-view"
                onClick={() => onViewDetails(alert)}
              >
                View Details
              </button>
              <button
                className="cd-alert-btn cd-alert-btn-investigate"
                onClick={() => onInvestigate(alert)}
              >
                Investigate
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Quick Actions Panel ─────────────────────────────────────────────────────

interface QuickActionsPanelProps {
  onNewCheck: () => void;
  onGenerateReport: () => void;
  onImportBatch: () => void;
  onAdvancedSearch: () => void;
}

const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({
  onNewCheck,
  onGenerateReport,
  onImportBatch,
  onAdvancedSearch,
}) => (
  <div className="cd-quick-actions" role="toolbar" aria-label="Quick actions">
    <button className="cd-qa-btn" onClick={onNewCheck} title="New Compliance Check (Ctrl+N)">
      <span className="cd-qa-icon">➕</span>
      <span className="cd-qa-label">New Check</span>
    </button>
    <button className="cd-qa-btn" onClick={onImportBatch} title="Import Batch (CSV / Excel)">
      <span className="cd-qa-icon">📥</span>
      <span className="cd-qa-label">Import Batch</span>
    </button>
    <button className="cd-qa-btn" onClick={onGenerateReport} title="Generate Report">
      <span className="cd-qa-icon">📊</span>
      <span className="cd-qa-label">Generate Report</span>
    </button>
    <button className="cd-qa-btn" onClick={onAdvancedSearch} title="Advanced Search">
      <span className="cd-qa-icon">🔍</span>
      <span className="cd-qa-label">Advanced Search</span>
    </button>
  </div>
);

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
  onNavigateToChecks?: () => void;
}

const ComplianceDashboard: React.FC<Props> = ({ claims, onNavigateToChecks }) => {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [cases, setCases] = useState<ComplianceCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewCase, setShowNewCase] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [alertDetailModal, setAlertDetailModal] = useState<RecentAlert | null>(null);
  const [investigateModal, setInvestigateModal] = useState<RecentAlert | null>(null);

  const isOfficer = canManageCases(claims.role);
  const analystOrAbove = canAddNotes(claims.role);
  const canApprove = canApproveReviews(claims.role);
  const canTrigger = canTriggerReviews(claims.role);
  const canExport = canExportReports(claims.role);
  const isReadOnly = claims.role === 'read_only';

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
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(
        err?.response?.data?.error ??
          err?.message ??
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

  const handleQuickNewCheck = () => {
    if (onNavigateToChecks) {
      onNavigateToChecks();
    } else {
      setShowNewCase(true);
    }
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
  const jurisdictions: JurisdictionDistribution[] = dashboard?.jurisdictionDistribution ?? [];
  const recentAlerts: RecentAlert[] = dashboard?.recentAlerts ?? [];

  return (
    <div className="cd-root">
      {/* ── Header bar ─────────────────────────────────────────────────────── */}
      <div className="cd-topbar">
        <div>
          <h2 className="cd-title">📊 Compliance Overview — Last 30 Days</h2>
          {lastRefresh && (
            <span className="cd-refresh-time">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="cd-topbar-actions">
          {isOfficer && (
            <button className="cd-btn-primary" onClick={() => setShowNewCase(true)}>
              + New Case
            </button>
          )}
          {canTrigger && !isOfficer && (
            <button className="cd-btn-secondary" title="Trigger a manual compliance review for a customer or asset">
              🔍 Trigger Review
            </button>
          )}
          {canExport && (
            <button className="cd-btn-secondary" title="Export compliance reports">
              📥 Export Report
            </button>
          )}
          <button className="cd-btn-secondary" onClick={load} disabled={loading}>
            {loading ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* ── Quick Actions ────────────────────────────────────────────────────── */}
      <QuickActionsPanel
        onNewCheck={handleQuickNewCheck}
        onImportBatch={() => window.alert('Batch import: Upload a CSV file with compliance records. Max 1,000 rows. See API docs for column format.')}
        onGenerateReport={() => window.alert('Report generation: Download the last-30-day compliance summary as PDF/Excel from the Reports & Analytics page.')}
        onAdvancedSearch={() => window.alert('Advanced Search: Use the search bar at the top to filter by wallet address, jurisdiction, or risk score.')}
      />

      {error && (
        <div className="cd-error-banner">
          <strong>⚠ API Unavailable</strong> — {error}
          <button className="cd-retry-btn" onClick={load}>Retry</button>
        </div>
      )}

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      <div className="cd-kpi-grid">
        <div
          className="cd-kpi-card cd-kpi-total cd-kpi-clickable"
          onClick={() => onNavigateToChecks?.()}
          role="button"
          tabIndex={0}
          title="View all compliance checks"
          onKeyDown={(e) => e.key === 'Enter' && onNavigateToChecks?.()}
        >
          <span className="cd-kpi-icon">📋</span>
          <div>
            <div className="cd-kpi-label">Total Checks</div>
            <div className="cd-kpi-value">{m?.totalChecks ?? '—'}</div>
          </div>
        </div>
        <div
          className="cd-kpi-card cd-kpi-approved cd-kpi-clickable"
          onClick={() => onNavigateToChecks?.()}
          role="button"
          tabIndex={0}
          title="View approved checks"
          onKeyDown={(e) => e.key === 'Enter' && onNavigateToChecks?.()}
        >
          <span className="cd-kpi-icon">✅</span>
          <div>
            <div className="cd-kpi-label">Approved</div>
            <div className="cd-kpi-value">{m?.approved ?? '—'}</div>
          </div>
        </div>
        <div
          className="cd-kpi-card cd-kpi-escalated cd-kpi-clickable"
          onClick={() => onNavigateToChecks?.()}
          role="button"
          tabIndex={0}
          title="View pending review checks"
          onKeyDown={(e) => e.key === 'Enter' && onNavigateToChecks?.()}
        >
          <span className="cd-kpi-icon">⚠️</span>
          <div>
            <div className="cd-kpi-label">Pending Review</div>
            <div className="cd-kpi-value">{m?.escalated ?? '—'}</div>
          </div>
        </div>
        <div
          className="cd-kpi-card cd-kpi-rejected cd-kpi-clickable"
          onClick={() => onNavigateToChecks?.()}
          role="button"
          tabIndex={0}
          title="View rejected checks"
          onKeyDown={(e) => e.key === 'Enter' && onNavigateToChecks?.()}
        >
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

      {/* ── Risk Score Trends + Jurisdiction Distribution ───────────────────── */}
      <div className="cd-mid-row">
        {/* Risk Score Trends */}
        <div className="cd-panel cd-panel-wide">
          <h3 className="cd-panel-title">📈 Risk Score Trends (Last 7 Days)</h3>
          <RiskTrendChart data={dashboard?.recentTrends ?? []} />
        </div>

        {/* Jurisdiction Distribution */}
        <div className="cd-panel">
          <h3 className="cd-panel-title">🌍 Checks by Jurisdiction</h3>
          <JurisdictionPieChart data={jurisdictions} />
        </div>
      </div>

      {/* ── Bottom row: risk factors + recent alerts + session context ──────── */}
      <div className="cd-bottom-row">
        {/* Top Risk Factors */}
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

        {/* Recent Alerts */}
        <div className="cd-panel">
          <div className="cd-panel-header-row">
            <h3 className="cd-panel-title">⚡ Recent Alerts</h3>
            <span className="cd-count-badge">{recentAlerts.length} alerts</span>
          </div>
          <RecentAlertsPanel
            alerts={recentAlerts}
            onViewDetails={(alert) => setAlertDetailModal(alert)}
            onInvestigate={(alert) => setInvestigateModal(alert)}
            onDismiss={() => { /* dismiss is handled in panel state */ }}
          />
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

          {/* ── Role capabilities summary ─────────────────────────── */}
          <h3 className="cd-panel-title" style={{ marginTop: '1rem' }}>Your Capabilities</h3>
          <ul className="cd-capability-list" aria-label="Role capabilities">
            <li className={isOfficer ? 'cd-cap-on' : 'cd-cap-off'}
                aria-label={`Create and manage cases: ${isOfficer ? 'allowed' : 'not allowed'}`}>
              {isOfficer ? '✅' : '🚫'} Create &amp; manage cases
            </li>
            <li className={analystOrAbove ? 'cd-cap-on' : 'cd-cap-off'}
                aria-label={`Add investigation notes: ${analystOrAbove ? 'allowed' : 'not allowed'}`}>
              {analystOrAbove ? '✅' : '🚫'} Add investigation notes
            </li>
            <li className={canApprove ? 'cd-cap-on' : 'cd-cap-off'}
                aria-label={`Approve or reject reviews: ${canApprove ? 'allowed' : 'not allowed'}`}>
              {canApprove ? '✅' : '🚫'} Approve / reject reviews
            </li>
            <li className={isOfficer ? 'cd-cap-on' : 'cd-cap-off'}
                aria-label={`File STR SAR reports: ${isOfficer ? 'allowed' : 'not allowed'}`}>
              {isOfficer ? '✅' : '🚫'} File STR / SAR reports
            </li>
            <li className={canTrigger ? 'cd-cap-on' : 'cd-cap-off'}
                aria-label={`Trigger manual reviews: ${canTrigger ? 'allowed' : 'not allowed'}`}>
              {canTrigger ? '✅' : '🚫'} Trigger manual reviews
            </li>
            <li className={canExport ? 'cd-cap-on' : 'cd-cap-off'}
                aria-label={`Export operational reports: ${canExport ? 'allowed' : 'not allowed'}`}>
              {canExport ? '✅' : '🚫'} Export operational reports
            </li>
            {isReadOnly && (
              <li className="cd-cap-info" role="note">ℹ️ View-only access — no modifications allowed</li>
            )}
          </ul>
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
            {isOfficer && (
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

      {/* ── Alert Detail modal ────────────────────────────────────────────── */}
      {alertDetailModal && (
        <div className="cd-modal-backdrop" onClick={() => setAlertDetailModal(null)}>
          <div className="cd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cd-modal-header">
              <h3>🔎 Alert Details</h3>
              <button className="cd-close-btn" onClick={() => setAlertDetailModal(null)}>✕</button>
            </div>
            <div className="cd-alert-detail-body">
              <div className="cd-detail-row"><span>Alert ID</span><code>{alertDetailModal.id}</code></div>
              <div className="cd-detail-row"><span>Entity</span><code>{alertDetailModal.entityId}</code></div>
              <div className="cd-detail-row"><span>Risk Score</span>
                <strong style={{ color: alertDetailModal.riskScore >= 70 ? '#b91c1c' : alertDetailModal.riskScore >= 30 ? '#b45309' : '#15803d' }}>
                  {Math.round(alertDetailModal.riskScore)}/100
                </strong>
              </div>
              <div className="cd-detail-row"><span>Status</span><strong>{alertDetailModal.status}</strong></div>
              <div className="cd-detail-row"><span>Jurisdiction</span><strong>{alertDetailModal.jurisdiction}</strong></div>
              <div className="cd-detail-row"><span>Time</span>{new Date(alertDetailModal.createdAt).toLocaleString()}</div>
              {alertDetailModal.flags.length > 0 && (
                <div className="cd-detail-row">
                  <span>Flags</span>
                  <div className="cd-flag-list">
                    {alertDetailModal.flags.map((f) => (
                      <span key={f} className="cd-flag-tag">{f}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="cd-modal-actions">
              <button className="cd-btn-secondary" onClick={() => setAlertDetailModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Investigate modal ─────────────────────────────────────────────── */}
      {investigateModal && (
        <div className="cd-modal-backdrop" onClick={() => setInvestigateModal(null)}>
          <div className="cd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cd-modal-header">
              <h3>🔬 Investigate Alert</h3>
              <button className="cd-close-btn" onClick={() => setInvestigateModal(null)}>✕</button>
            </div>
            <p className="cd-modal-desc">
              Open an investigation workflow for entity <code>{investigateModal.entityId}</code> with risk score <strong>{Math.round(investigateModal.riskScore)}</strong>.
            </p>
            <div className="cd-modal-actions">
              <button className="cd-btn-secondary" onClick={() => setInvestigateModal(null)}>Cancel</button>
              <button
                className="cd-btn-primary"
                onClick={() => {
                  setShowNewCase(true);
                  setInvestigateModal(null);
                }}
              >
                Open Case
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplianceDashboard;
