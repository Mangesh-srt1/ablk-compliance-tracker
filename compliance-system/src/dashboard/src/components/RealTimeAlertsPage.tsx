/**
 * RealTimeAlertsPage – Section 9 of the Compliance Dashboard
 * Full implementation of Real-Time Compliance Alerts with:
 *   9.1 Alerts Dashboard (filter/search/list/load-more)
 *   9.2 Alert Types (Critical / High / Medium / Low)
 *   9.3 Investigation Panel (risk factors, entity profile, AI analysis, actions)
 *   9.4 Alert Notifications settings
 *   9.5 Alert Analytics
 */

import React, { useState, useMemo, useCallback } from 'react';
import '../styles/RealTimeAlertsPage.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertPriority = 'critical' | 'high' | 'medium' | 'low';
type AlertStatus   = 'open' | 'investigating' | 'dismissed' | 'resolved' | 'blocked';

interface RiskFactor {
  label: string;
  pct: number;
}

interface RelatedCheck {
  id: string;
  amount: string;
  to: string;
  timeAgoLabel: string;
}

interface EntityProfile {
  name: string;
  jurisdiction: string;
  accountAge: string;
  previousChecks: number;
  avgTransaction: string;
}

interface Alert {
  id: string;
  priority: AlertPriority;
  type: string;
  entityType: 'wallet' | 'entity';
  entityId: string;
  riskScore: number;
  message: string;
  createdAt: string;
  status: AlertStatus;
  riskFactors?: RiskFactor[];
  relatedChecks?: RelatedCheck[];
  entityProfile?: EntityProfile;
  aiAnalysis?: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const NOW = Date.now();
function minsAgo(n: number) { return new Date(NOW - n * 60_000).toISOString(); }

const MOCK_ALERTS: Alert[] = [
  {
    id: 'alrt_1a2b3c4d',
    priority: 'critical',
    type: 'Sanctions Match Detected',
    entityType: 'wallet',
    entityId: '0x1234567890abcdef5678',
    riskScore: 100,
    message: 'Wallet matches OFAC SDN #12345',
    createdAt: minsAgo(2),
    status: 'open',
    riskFactors: [
      { label: 'OFAC SDN List Match', pct: 100 },
      { label: 'High-Risk Jurisdiction', pct: 75 },
      { label: 'Unusual Transaction Volume', pct: 60 },
    ],
    relatedChecks: [
      { id: 'chk_aa1111', amount: '$120,000', to: '0xabcd…ef01', timeAgoLabel: '5 min ago' },
      { id: 'chk_bb2222', amount: '$85,000',  to: '0x5678…90ab', timeAgoLabel: '1 min ago' },
    ],
    entityProfile: {
      name: 'Unknown Entity',
      jurisdiction: 'IR',
      accountAge: '3 weeks',
      previousChecks: 4,
      avgTransaction: '$200K',
    },
    aiAnalysis:
      'Wallet address directly matches OFAC SDN entry #12345 with 100% confidence. ' +
      'All transactions from this wallet should be blocked immediately and the case ' +
      'reported to the relevant regulatory authority. Probability of legitimate use: <1%.',
  },
  {
    id: 'alrt_9z8y7x6w',
    priority: 'high',
    type: 'Unusual Transaction Pattern',
    entityType: 'wallet',
    entityId: '0xabcdefabcdefabcdef12',
    riskScore: 78,
    message: 'Velocity 10x normal, $2M in 1 hour',
    createdAt: minsAgo(15),
    status: 'open',
    riskFactors: [
      { label: 'Transaction Velocity: 10x normal', pct: 100 },
      { label: 'Amount: $2M in 1 hour', pct: 85 },
      { label: 'New Counterparties: 15 new wallets', pct: 65 },
      { label: 'Geographic Risk: High-risk country', pct: 40 },
    ],
    relatedChecks: [
      { id: 'chk_abc123', amount: '$500K', to: '0x1234…5678', timeAgoLabel: '45 min ago' },
      { id: 'chk_def456', amount: '$700K', to: '0xabcd…ef01', timeAgoLabel: '30 min ago' },
      { id: 'chk_ghi789', amount: '$800K', to: '0xef01…2345', timeAgoLabel: '15 min ago' },
    ],
    entityProfile: {
      name: 'XYZ Corporation',
      jurisdiction: 'US',
      accountAge: '6 months',
      previousChecks: 23,
      avgTransaction: '$50K',
    },
    aiAnalysis:
      'Significant deviation from normal activity patterns detected. Recommended: Contact ' +
      'entity to verify legitimacy. Possible scenarios:\n' +
      '1. Legitimate bulk investment (60%)\n' +
      '2. Account takeover / fraud (30%)\n' +
      '3. Money laundering attempt (10%)',
  },
  {
    id: 'alrt_m3d1um55',
    priority: 'medium',
    type: 'KYC Document Expiring Soon',
    entityType: 'entity',
    entityId: 'John Doe',
    riskScore: 45,
    message: 'Passport expires in 15 days',
    createdAt: minsAgo(60),
    status: 'open',
    entityProfile: {
      name: 'John Doe',
      jurisdiction: 'AE',
      accountAge: '2 years',
      previousChecks: 47,
      avgTransaction: '$30K',
    },
    aiAnalysis:
      'KYC document approaching expiry. Standard renewal request should be initiated. ' +
      'No suspicious activity patterns observed. Renewal probability: high (95%).',
  },
  {
    id: 'alrt_h1gh0099',
    priority: 'high',
    type: 'High Risk Transaction',
    entityType: 'wallet',
    entityId: '0x9999aaaa8888bbbb7777',
    riskScore: 74,
    message: 'Risk score 74 — manual review required',
    createdAt: minsAgo(45),
    status: 'investigating',
    riskFactors: [
      { label: 'AML Risk Score: 74', pct: 74 },
      { label: 'PEP Match (secondary)', pct: 50 },
      { label: 'Cross-border Transfer', pct: 40 },
    ],
    entityProfile: {
      name: 'Offshore Holdings Ltd.',
      jurisdiction: 'SG',
      accountAge: '1 year',
      previousChecks: 12,
      avgTransaction: '$150K',
    },
    aiAnalysis:
      'PEP secondary match detected alongside elevated AML score. ' +
      'Manual review of source-of-funds documentation recommended before approving ' +
      'further transactions. Estimated fraud probability: 22%.',
  },
  {
    id: 'alrt_med22222',
    priority: 'medium',
    type: 'Escalated Check Pending Review',
    entityType: 'wallet',
    entityId: '0xdeadbeefdeadbeef1234',
    riskScore: 55,
    message: 'Check awaiting approval for 14 hours',
    createdAt: minsAgo(840),
    status: 'open',
  },
  {
    id: 'alrt_low00001',
    priority: 'low',
    type: 'New Compliance Rule Loaded',
    entityType: 'entity',
    entityId: 'System',
    riskScore: 0,
    message: 'AE jurisdiction rules updated (DFSA 2026 amendments)',
    createdAt: minsAgo(180),
    status: 'open',
  },
  {
    id: 'alrt_crit0002',
    priority: 'critical',
    type: 'Fraud Pattern Detected',
    entityType: 'wallet',
    entityId: '0xfeed1234feed5678feed',
    riskScore: 95,
    message: 'Known scam wallet pattern — blockchain analysis flagged',
    createdAt: minsAgo(5),
    status: 'open',
    riskFactors: [
      { label: 'Chainalysis fraud flag', pct: 95 },
      { label: 'Rapid fund movement', pct: 80 },
      { label: 'Multiple victim reports', pct: 70 },
    ],
    entityProfile: {
      name: 'Unknown',
      jurisdiction: 'XX',
      accountAge: '2 days',
      previousChecks: 1,
      avgTransaction: '$500K',
    },
    aiAnalysis:
      'Chainalysis has flagged this wallet as a known fraud address with 95% confidence. ' +
      'Immediate blocking and regulatory reporting is required. Do not allow any further ' +
      'transactions from this wallet.',
  },
  {
    id: 'alrt_low00002',
    priority: 'low',
    type: 'Scheduled Review Reminder',
    entityType: 'entity',
    entityId: 'ABC Fund Ltd.',
    riskScore: 10,
    message: 'Quarterly compliance review due in 7 days',
    createdAt: minsAgo(1440),
    status: 'open',
  },
  {
    id: 'alrt_med33333',
    priority: 'medium',
    type: 'Jurisdiction Change Detected',
    entityType: 'entity',
    entityId: 'Priya Investments',
    riskScore: 38,
    message: 'Entity moved from IN to SG — re-verification required',
    createdAt: minsAgo(320),
    status: 'open',
  },
  {
    id: 'alrt_high0003',
    priority: 'high',
    type: 'Multiple Failed Checks',
    entityType: 'wallet',
    entityId: '0x1111222233334444aaaa',
    riskScore: 71,
    message: 'Same wallet rejected 3 consecutive times',
    createdAt: minsAgo(90),
    status: 'open',
    riskFactors: [
      { label: 'Repeated check failures', pct: 85 },
      { label: 'Attempted override patterns', pct: 55 },
    ],
    entityProfile: {
      name: 'Unknown',
      jurisdiction: 'EU',
      accountAge: '1 month',
      previousChecks: 5,
      avgTransaction: '$20K',
    },
    aiAnalysis:
      'Pattern of repeated failed checks suggests deliberate probing of compliance ' +
      'thresholds. Possible structuring behaviour (splitting transactions to avoid ' +
      'detection). Investigate for money laundering via structuring.',
  },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_META: Record<AlertPriority, { icon: string; label: string; cls: string; responseSLA: string }> = {
  critical: { icon: '🔴', label: 'CRITICAL', cls: 'ra-critical', responseSLA: 'Immediate (< 5 min)' },
  high:     { icon: '🟠', label: 'HIGH',     cls: 'ra-high',     responseSLA: 'Urgent (< 1 hour)'   },
  medium:   { icon: '🟡', label: 'MEDIUM',   cls: 'ra-medium',   responseSLA: 'Standard (< 24h)'    },
  low:      { icon: '🔵', label: 'LOW',      cls: 'ra-low',      responseSLA: 'Review within 7 days' },
};

const TIME_FILTER_OPTIONS = [
  { label: 'Last 24h', hours: 24 },
  { label: 'Last 48h', hours: 48 },
  { label: 'Last 7 days', hours: 168 },
  { label: 'All time', hours: Infinity },
];

const PAGE_SIZE = 5;

type TabType = 'alerts' | 'analytics' | 'notifications';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins} min${mins !== 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} hr${hrs !== 1 ? 's' : ''} ago`;
  return `${Math.floor(hrs / 24)} day(s) ago`;
}

function shortId(id: string): string {
  if (id.startsWith('0x') && id.length > 14) {
    return `${id.slice(0, 8)}…${id.slice(-4)}`;
  }
  return id;
}

// ─── Risk Factor Bar ──────────────────────────────────────────────────────────

const RiskFactorBar: React.FC<{ factor: RiskFactor }> = ({ factor }) => (
  <div className="ra-rf-row">
    <span className="ra-rf-label">{factor.label}</span>
    <div className="ra-rf-track" role="progressbar" aria-label={factor.label} aria-valuenow={factor.pct} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={`ra-rf-fill ${factor.pct >= 75 ? 'ra-rf-fill-high' : factor.pct >= 40 ? 'ra-rf-fill-med' : 'ra-rf-fill-low'}`}
        style={{ width: `${factor.pct}%` }}
      />
    </div>
    <span className="ra-rf-pct">{factor.pct}%</span>
  </div>
);

// ─── Investigation Modal ──────────────────────────────────────────────────────

interface InvestigateModalProps {
  alert: Alert;
  onClose: () => void;
  onApprove: (id: string, note: string) => void;
  onEscalate: (id: string, level: string, note: string) => void;
  onBlock: (id: string, reason: string) => void;
}

const ESCALATION_LEVELS = [
  'Senior Compliance Officer',
  'Chief Compliance Officer',
  'Legal / Executive',
];

const InvestigateModal: React.FC<InvestigateModalProps> = ({
  alert,
  onClose,
  onApprove,
  onEscalate,
  onBlock,
}) => {
  const [action, setAction]           = useState<'none' | 'approve' | 'escalate' | 'block'>('none');
  const [noteText, setNoteText]       = useState('');
  const [escalateLevel, setEscalateLevel] = useState(ESCALATION_LEVELS[0]);
  const [blockReason, setBlockReason] = useState('');
  const [confirmBlock, setConfirmBlock] = useState(false);

  const priority = PRIORITY_META[alert.priority];

  const handleApprove = () => {
    onApprove(alert.id, noteText);
    onClose();
  };

  const handleEscalate = () => {
    onEscalate(alert.id, escalateLevel, noteText);
    onClose();
  };

  const handleBlock = () => {
    if (!blockReason.trim()) return;
    onBlock(alert.id, blockReason);
    onClose();
  };

  return (
    <div className="ra-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Alert Investigation">
      <div className="ra-modal ra-modal-wide" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="ra-modal-header">
          <div>
            <h3 className="ra-modal-title">🔍 Alert Investigation</h3>
            <div className="ra-modal-subtitle">Alert ID: {alert.id}</div>
            <div className="ra-modal-subtitle">Created: {new Date(alert.createdAt).toLocaleString()}</div>
          </div>
          <button className="ra-close-btn" onClick={onClose} aria-label="Close investigation">✕</button>
        </div>

        {/* Priority badge */}
        <div className={`ra-inv-badge ${priority.cls}`}>
          {priority.icon} {priority.label} — {alert.type}
        </div>

        <div className="ra-inv-body">

          {/* Risk Factors */}
          {alert.riskFactors && alert.riskFactors.length > 0 && (
            <section className="ra-inv-section">
              <h4 className="ra-inv-section-title">📊 Risk Factors</h4>
              <div className="ra-rf-list">
                {alert.riskFactors.map((rf) => (
                  <RiskFactorBar key={rf.label} factor={rf} />
                ))}
              </div>
            </section>
          )}

          {/* Related Checks */}
          {alert.relatedChecks && alert.relatedChecks.length > 0 && (
            <section className="ra-inv-section">
              <h4 className="ra-inv-section-title">🔗 Related Checks</h4>
              <div className="ra-related-list">
                {alert.relatedChecks.map((chk) => (
                  <div key={chk.id} className="ra-related-item">
                    <code className="ra-check-id">[{chk.id}]</code>
                    <span>{chk.amount} to {chk.to}</span>
                    <span className="ra-related-time">({chk.timeAgoLabel})</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Entity Profile */}
          {alert.entityProfile && (
            <section className="ra-inv-section">
              <h4 className="ra-inv-section-title">💼 Entity Profile</h4>
              <div className="ra-profile-grid">
                <div className="ra-profile-row"><span>Name</span><strong>{alert.entityProfile.name}</strong></div>
                <div className="ra-profile-row"><span>Jurisdiction</span><strong>{alert.entityProfile.jurisdiction}</strong></div>
                <div className="ra-profile-row"><span>Account Age</span><strong>{alert.entityProfile.accountAge}</strong></div>
                <div className="ra-profile-row"><span>Previous Checks</span><strong>{alert.entityProfile.previousChecks}</strong></div>
                <div className="ra-profile-row"><span>Avg. Transaction</span><strong>{alert.entityProfile.avgTransaction}</strong></div>
              </div>
            </section>
          )}

          {/* Risk Score */}
          <section className="ra-inv-section">
            <h4 className="ra-inv-section-title">📈 Risk Score</h4>
            <div className="ra-risk-score-bar-wrap">
              <div className="ra-risk-score-track">
                <div
                  className={`ra-risk-score-fill ${
                    alert.riskScore >= 90 ? 'ra-fill-critical' :
                    alert.riskScore >= 70 ? 'ra-fill-high' :
                    alert.riskScore >= 30 ? 'ra-fill-medium' : 'ra-fill-low'
                  }`}
                  style={{ width: `${alert.riskScore}%` }}
                />
              </div>
              <span className="ra-risk-score-num">{alert.riskScore}/100</span>
            </div>
          </section>

          {/* AI Analysis */}
          {alert.aiAnalysis && (
            <section className="ra-inv-section">
              <h4 className="ra-inv-section-title">🤖 AI Analysis</h4>
              <div className="ra-ai-analysis">
                {alert.aiAnalysis.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </section>
          )}

          {/* Actions */}
          {action === 'none' && (
            <div className="ra-inv-actions">
              <button className="ra-inv-btn ra-inv-btn-approve" onClick={() => setAction('approve')}>✅ Approve</button>
              <button className="ra-inv-btn ra-inv-btn-escalate" onClick={() => setAction('escalate')}>⬆️ Escalate</button>
              <button className="ra-inv-btn ra-inv-btn-block"   onClick={() => setAction('block')}>🚫 Block Wallet</button>
            </div>
          )}

          {/* Approve form */}
          {action === 'approve' && (
            <section className="ra-inv-section ra-action-form">
              <h4 className="ra-inv-section-title">✅ Approve Alert</h4>
              <label className="ra-form-label">
                Justification (required)
                <textarea
                  className="ra-form-textarea"
                  rows={4}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Explain why this alert is being approved…"
                />
              </label>
              <div className="ra-action-btns">
                <button className="ra-btn-secondary" onClick={() => setAction('none')}>Cancel</button>
                <button
                  className="ra-btn-primary ra-btn-approve"
                  onClick={handleApprove}
                  disabled={!noteText.trim()}
                >
                  Confirm Approval
                </button>
              </div>
            </section>
          )}

          {/* Escalate form */}
          {action === 'escalate' && (
            <section className="ra-inv-section ra-action-form">
              <h4 className="ra-inv-section-title">⬆️ Escalate Alert</h4>
              <label className="ra-form-label">
                Escalation Level
                <select className="ra-form-select" value={escalateLevel} onChange={(e) => setEscalateLevel(e.target.value)}>
                  {ESCALATION_LEVELS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </label>
              <label className="ra-form-label">
                Notes
                <textarea
                  className="ra-form-textarea"
                  rows={3}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add notes for the escalation recipient…"
                />
              </label>
              <div className="ra-action-btns">
                <button className="ra-btn-secondary" onClick={() => setAction('none')}>Cancel</button>
                <button className="ra-btn-primary ra-btn-escalate" onClick={handleEscalate}>
                  Confirm Escalation
                </button>
              </div>
            </section>
          )}

          {/* Block Wallet form */}
          {action === 'block' && (
            <section className="ra-inv-section ra-action-form">
              {!confirmBlock ? (
                <>
                  <div className="ra-block-warning">
                    <div className="ra-block-warning-title">⚠️ WARNING: Blocking Wallet</div>
                    <p>This action will:</p>
                    <ul>
                      <li>Block all future transactions from this wallet</li>
                      <li>Add wallet to internal blocklist</li>
                      <li>Trigger regulatory reporting (if required by jurisdiction)</li>
                      <li>This action is difficult to reverse</li>
                    </ul>
                  </div>
                  <label className="ra-form-label">
                    Reason (required)
                    <textarea
                      className="ra-form-textarea"
                      rows={3}
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      placeholder="State the reason for blocking this wallet…"
                    />
                  </label>
                  <div className="ra-action-btns">
                    <button className="ra-btn-secondary" onClick={() => setAction('none')}>Cancel</button>
                    <button
                      className="ra-btn-primary ra-btn-block"
                      onClick={() => setConfirmBlock(true)}
                      disabled={!blockReason.trim()}
                    >
                      Proceed to Block
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="ra-block-confirm-msg">
                    Are you sure you want to block wallet <code>{shortId(alert.entityId)}</code>?
                    This will trigger regulatory reporting.
                  </div>
                  <div className="ra-action-btns">
                    <button className="ra-btn-secondary" onClick={() => setConfirmBlock(false)}>Back</button>
                    <button className="ra-btn-primary ra-btn-block" onClick={handleBlock}>Confirm Block</button>
                  </div>
                </>
              )}
            </section>
          )}

        </div>
      </div>
    </div>
  );
};

// ─── Alert Card ───────────────────────────────────────────────────────────────

interface AlertCardProps {
  alert: Alert;
  onInvestigate: (alert: Alert) => void;
  onDismiss: (id: string) => void;
}

const AlertCard: React.FC<AlertCardProps> = ({ alert, onInvestigate, onDismiss }) => {
  const priority = PRIORITY_META[alert.priority];
  const displayId = alert.entityType === 'wallet' ? shortId(alert.entityId) : alert.entityId;

  return (
    <div className={`ra-alert-card ${priority.cls}`} role="listitem" aria-label={`${priority.label} alert: ${alert.type}`}>
      <div className="ra-alert-header">
        <span className="ra-alert-icon">{priority.icon}</span>
        <span className="ra-alert-title">
          <strong>{priority.label}</strong> — {alert.type}
        </span>
        {alert.status === 'investigating' && (
          <span className="ra-status-badge ra-status-investigating">Investigating</span>
        )}
        <button
          className="ra-dismiss-btn"
          onClick={() => onDismiss(alert.id)}
          title="Dismiss alert"
          aria-label="Dismiss alert"
        >
          ✕
        </button>
      </div>

      <div className="ra-alert-body">
        <div className="ra-alert-entity">
          {alert.entityType === 'wallet' ? 'Wallet' : 'Entity'}:{' '}
          <code className="ra-entity-id">{displayId}</code>
          {alert.entityType === 'wallet' && (
            <span className="ra-risk-pill-score">Risk: {alert.riskScore}/100</span>
          )}
        </div>
        <p className="ra-alert-message">"{alert.message}"</p>
        <div className="ra-alert-footer">
          <span className="ra-alert-time">{timeAgo(alert.createdAt)}</span>
          <div className="ra-alert-actions">
            <button
              className="ra-action-btn ra-action-investigate"
              onClick={() => onInvestigate(alert)}
            >
              🔍 Investigate
            </button>
            <button
              className="ra-action-btn ra-action-dismiss"
              onClick={() => onDismiss(alert.id)}
            >
              ✕ Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Analytics Panel ──────────────────────────────────────────────────────────

const ANALYTICS_DATA = {
  totalAlerts: 437,
  byPriority: [
    { priority: 'critical' as AlertPriority, count: 3,   pct: 0.7  },
    { priority: 'high'     as AlertPriority, count: 28,  pct: 6.4  },
    { priority: 'medium'   as AlertPriority, count: 156, pct: 35.7 },
    { priority: 'low'      as AlertPriority, count: 250, pct: 57.2 },
  ],
  responseTimes: [
    { priority: 'critical' as AlertPriority, avg: '3.2 minutes' },
    { priority: 'high'     as AlertPriority, avg: '42 minutes'  },
    { priority: 'medium'   as AlertPriority, avg: '8.5 hours'   },
    { priority: 'low'      as AlertPriority, avg: '3.2 days'    },
  ],
  resolution: { resolved: 418, inProgress: 12, escalated: 5, dismissed: 2 },
  topTypes: [
    { name: 'Escalated Checks',         pct: 38 },
    { name: 'Unusual Patterns',         pct: 22 },
    { name: 'KYC Document Expiring',    pct: 18 },
    { name: 'Large Transactions',       pct: 12 },
    { name: 'Sanctions Screening',      pct: 5  },
    { name: 'System Alerts',            pct: 3  },
    { name: 'Other',                    pct: 2  },
  ],
};

const AnalyticsPanel: React.FC = () => {
  const { totalAlerts, byPriority, responseTimes, resolution, topTypes } = ANALYTICS_DATA;
  const resolvedPct = Math.round((resolution.resolved / totalAlerts) * 100);

  function resolutionPct(count: number): number {
    return Math.round((count / totalAlerts) * 1000) / 10;
  }

  return (
    <div className="ra-analytics-root">
      <h3 className="ra-section-title">📊 Alert Analytics — Last 30 Days</h3>

      <div className="ra-analytics-grid">

        {/* Volume by priority */}
        <div className="ra-analytics-card">
          <h4>Total Alerts: {totalAlerts}</h4>
          <div className="ra-analytics-list">
            {byPriority.map((row) => {
              const meta = PRIORITY_META[row.priority];
              return (
                <div key={row.priority} className="ra-analytics-row">
                  <span>{meta.icon} {meta.label}</span>
                  <div className="ra-analytics-bar-track">
                    <div
                      className={`ra-analytics-bar-fill ${meta.cls}`}
                      style={{ width: `${(row.count / totalAlerts) * 100}%` }}
                    />
                  </div>
                  <span className="ra-analytics-count">{row.count} ({row.pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Response times */}
        <div className="ra-analytics-card">
          <h4>Average Response Times</h4>
          <div className="ra-analytics-list">
            {responseTimes.map((row) => {
              const meta = PRIORITY_META[row.priority];
              return (
                <div key={row.priority} className="ra-analytics-row">
                  <span>{meta.icon} {meta.label}</span>
                  <span className="ra-analytics-time">{row.avg}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Resolution */}
        <div className="ra-analytics-card">
          <h4>Resolution Status</h4>
          <div className="ra-resolution-ring">
            <svg viewBox="0 0 80 80" className="ra-donut">
              <circle cx="40" cy="40" r="30" fill="none" stroke="#e2e8f0" strokeWidth="12" />
              <circle
                cx="40" cy="40" r="30"
                fill="none"
                stroke="#10b981"
                strokeWidth="12"
                strokeDasharray={`${resolvedPct * 1.885} ${188.5 - resolvedPct * 1.885}`}
                strokeLinecap="round"
                transform="rotate(-90 40 40)"
              />
            </svg>
            <div className="ra-donut-center">
              <span className="ra-donut-pct">{resolvedPct}%</span>
              <span className="ra-donut-label">Resolved</span>
            </div>
          </div>
          <div className="ra-analytics-list ra-resolution-detail">
            <div className="ra-analytics-row"><span>✅ Resolved</span><span>{resolution.resolved} ({resolvedPct}%)</span></div>
            <div className="ra-analytics-row"><span>🔄 In Progress</span><span>{resolution.inProgress} ({resolutionPct(resolution.inProgress)}%)</span></div>
            <div className="ra-analytics-row"><span>⬆️ Escalated</span><span>{resolution.escalated} ({resolutionPct(resolution.escalated)}%)</span></div>
            <div className="ra-analytics-row"><span>❌ Dismissed</span><span>{resolution.dismissed} ({resolutionPct(resolution.dismissed)}%)</span></div>
          </div>
        </div>

        {/* Top alert types */}
        <div className="ra-analytics-card ra-analytics-card-wide">
          <h4>Top Alert Types</h4>
          <div className="ra-analytics-list">
            {topTypes.map((t, idx) => (
              <div key={t.name} className="ra-analytics-row">
                <span className="ra-type-rank">{idx + 1}.</span>
                <span className="ra-type-name">{t.name}</span>
                <div className="ra-analytics-bar-track">
                  <div className="ra-analytics-bar-fill ra-fill-brand" style={{ width: `${t.pct}%` }} />
                </div>
                <span className="ra-analytics-count">{t.pct}%</span>
              </div>
            ))}
          </div>
          <button className="ra-export-btn" onClick={() => window.alert('Export functionality coming soon.')}>
            📥 Export Report
          </button>
        </div>

      </div>
    </div>
  );
};

// ─── Notifications Panel ──────────────────────────────────────────────────────

type NotificationChannel = 'email' | 'sms' | 'slack' | 'teams' | 'webhook' | 'inapp';

interface NotifSetting {
  channel: NotificationChannel;
  label: string;
  enabled: boolean;
  detail: string;
}

const DEFAULT_NOTIF: Record<AlertPriority, NotifSetting[]> = {
  critical: [
    { channel: 'email',   label: 'Email',            enabled: true,  detail: 'immediate'                  },
    { channel: 'sms',     label: 'SMS',              enabled: true,  detail: 'immediate'                  },
    { channel: 'slack',   label: 'Slack',            enabled: true,  detail: '#compliance-critical'       },
    { channel: 'inapp',   label: 'In-App',           enabled: true,  detail: 'immediate'                  },
  ],
  high: [
    { channel: 'email',   label: 'Email',            enabled: true,  detail: 'immediate'                  },
    { channel: 'sms',     label: 'SMS',              enabled: false, detail: ''                           },
    { channel: 'slack',   label: 'Slack',            enabled: true,  detail: '#compliance'                },
    { channel: 'inapp',   label: 'In-App',           enabled: true,  detail: 'immediate'                  },
  ],
  medium: [
    { channel: 'email',   label: 'Email',            enabled: true,  detail: 'daily digest at 9 AM'      },
    { channel: 'sms',     label: 'SMS',              enabled: false, detail: ''                           },
    { channel: 'slack',   label: 'Slack',            enabled: false, detail: ''                           },
    { channel: 'inapp',   label: 'In-App',           enabled: true,  detail: 'batched'                    },
  ],
  low: [
    { channel: 'email',   label: 'Email',            enabled: true,  detail: 'weekly digest, Friday 5 PM' },
    { channel: 'sms',     label: 'SMS',              enabled: false, detail: ''                           },
    { channel: 'slack',   label: 'Slack',            enabled: false, detail: ''                           },
    { channel: 'inapp',   label: 'In-App',           enabled: true,  detail: 'batched'                    },
  ],
};

const NotificationsPanel: React.FC = () => {
  const [settings, setSettings] = useState(DEFAULT_NOTIF);
  const [saved, setSaved] = useState(false);

  const toggle = useCallback((priority: AlertPriority, channel: NotificationChannel) => {
    setSettings((prev) => ({
      ...prev,
      [priority]: prev[priority].map((s) =>
        s.channel === channel ? { ...s, enabled: !s.enabled } : s
      ),
    }));
    setSaved(false);
  }, []);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="ra-notif-root">
      <h3 className="ra-section-title">🔔 Notification Rules</h3>
      <p className="ra-notif-desc">
        Configure which channels receive alerts for each priority level.
        Critical and high alerts are delivered immediately; medium and low alerts are batched.
      </p>

      {(['critical', 'high', 'medium', 'low'] as AlertPriority[]).map((priority) => {
        const meta = PRIORITY_META[priority];
        return (
          <div key={priority} className={`ra-notif-group ${meta.cls}`}>
            <div className="ra-notif-group-header">
              {meta.icon} <strong>{meta.label} Alerts</strong>
              <span className="ra-notif-sla">SLA: {meta.responseSLA}</span>
            </div>
            <div className="ra-notif-channels">
              {settings[priority].map((s) => (
                <label key={s.channel} className="ra-notif-channel-row">
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    onChange={() => toggle(priority, s.channel)}
                  />
                  <span className="ra-notif-channel-label">{s.label}</span>
                  {s.enabled && s.detail && (
                    <span className="ra-notif-channel-detail">({s.detail})</span>
                  )}
                </label>
              ))}
            </div>
          </div>
        );
      })}

      <div className="ra-notif-quiet">
        <h4>🌙 Quiet Hours</h4>
        <p>No notifications between <strong>10 PM – 7 AM</strong> except for Critical alerts.</p>
        <p>
          If a <strong>Critical</strong> alert is not acknowledged within <strong>15 minutes</strong>,
          it auto-escalates to the on-call officer via SMS.
        </p>
      </div>

      <div className="ra-notif-save-row">
        {saved && <span className="ra-notif-saved">✅ Settings saved!</span>}
        <button className="ra-btn-primary" onClick={handleSave}>💾 Save Notification Settings</button>
      </div>
    </div>
  );
};

// ─── Main Page Component ──────────────────────────────────────────────────────

const RealTimeAlertsPage: React.FC = () => {
  const [activeTab, setActiveTab]         = useState<TabType>('alerts');
  const [priorityFilter, setPriorityFilter] = useState<AlertPriority | 'all'>('all');
  const [timeFilter, setTimeFilter]       = useState(0); // index into TIME_FILTER_OPTIONS
  const [searchQuery, setSearchQuery]     = useState('');
  const [dismissed, setDismissed]         = useState<Set<string>>(new Set());
  const [resolved, setResolved]           = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount]   = useState(PAGE_SIZE);
  const [investigateAlert, setInvestigateAlert] = useState<Alert | null>(null);
  const [toastMsg, setToastMsg]           = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }, []);

  const handleDismiss = useCallback((id: string) => {
    setDismissed((prev) => new Set([...prev, id]));
    showToast('Alert dismissed.');
  }, [showToast]);

  const handleApprove = useCallback((id: string, _note: string) => {
    setResolved((prev) => new Set([...prev, id]));
    showToast('✅ Alert approved and resolved.');
  }, [showToast]);

  const handleEscalate = useCallback((id: string, level: string, _note: string) => {
    setResolved((prev) => new Set([...prev, id]));
    showToast(`⬆️ Alert escalated to ${level}.`);
  }, [showToast]);

  const handleBlock = useCallback((id: string, _reason: string) => {
    setResolved((prev) => new Set([...prev, id]));
    showToast('🚫 Wallet blocked and regulatory report filed.');
  }, [showToast]);

  const hoursLimit = TIME_FILTER_OPTIONS[timeFilter].hours;

  const filtered = useMemo(() => {
    return MOCK_ALERTS.filter((alert) => {
      if (dismissed.has(alert.id)) return false;
      if (resolved.has(alert.id))  return false;
      if (priorityFilter !== 'all' && alert.priority !== priorityFilter) return false;
      if (hoursLimit !== Infinity) {
        const ageHours = (Date.now() - new Date(alert.createdAt).getTime()) / 3_600_000;
        if (ageHours > hoursLimit) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          alert.type.toLowerCase().includes(q) ||
          alert.message.toLowerCase().includes(q) ||
          alert.entityId.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [dismissed, resolved, priorityFilter, hoursLimit, searchQuery]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  // Priority counts for badge
  const counts = useMemo(() => {
    const all = MOCK_ALERTS.filter((a) => !dismissed.has(a.id) && !resolved.has(a.id));
    return {
      critical: all.filter((a) => a.priority === 'critical').length,
      high:     all.filter((a) => a.priority === 'high').length,
      medium:   all.filter((a) => a.priority === 'medium').length,
      low:      all.filter((a) => a.priority === 'low').length,
    };
  }, [dismissed, resolved]);

  const totalOpen = counts.critical + counts.high + counts.medium + counts.low;

  return (
    <div className="ra-root">

      {/* Toast */}
      {toastMsg && (
        <div className="ra-toast" role="status">{toastMsg}</div>
      )}

      {/* Page header */}
      <div className="ra-page-header">
        <div className="ra-page-title-row">
          <h2 className="ra-page-title">🔔 Real-Time Compliance Alerts</h2>
          {totalOpen > 0 && (
            <span className="ra-open-badge">{totalOpen} open</span>
          )}
        </div>
        <p className="ra-page-subtitle">
          Monitor, investigate, and resolve compliance alerts in real time.
        </p>
      </div>

      {/* Priority summary cards */}
      <div className="ra-summary-cards">
        {(['critical', 'high', 'medium', 'low'] as AlertPriority[]).map((p) => {
          const meta = PRIORITY_META[p];
          return (
            <button
              key={p}
              className={`ra-summary-card ${meta.cls} ${priorityFilter === p ? 'ra-summary-card-active' : ''}`}
              onClick={() => {
                setPriorityFilter(priorityFilter === p ? 'all' : p);
                setActiveTab('alerts');
                setVisibleCount(PAGE_SIZE);
              }}
              aria-pressed={priorityFilter === p}
            >
              <span className="ra-summary-icon">{meta.icon}</span>
              <span className="ra-summary-count">{counts[p]}</span>
              <span className="ra-summary-label">{meta.label}</span>
              <span className="ra-summary-sla">{meta.responseSLA}</span>
            </button>
          );
        })}
      </div>

      {/* Tab navigation */}
      <div className="ra-tabs" role="tablist">
        <button
          className={`ra-tab ${activeTab === 'alerts' ? 'ra-tab-active' : ''}`}
          onClick={() => setActiveTab('alerts')}
          role="tab"
          aria-selected={activeTab === 'alerts'}
        >
          🔔 Alerts
        </button>
        <button
          className={`ra-tab ${activeTab === 'analytics' ? 'ra-tab-active' : ''}`}
          onClick={() => setActiveTab('analytics')}
          role="tab"
          aria-selected={activeTab === 'analytics'}
        >
          📊 Analytics
        </button>
        <button
          className={`ra-tab ${activeTab === 'notifications' ? 'ra-tab-active' : ''}`}
          onClick={() => setActiveTab('notifications')}
          role="tab"
          aria-selected={activeTab === 'notifications'}
        >
          ⚙️ Notifications
        </button>
      </div>

      {/* ── Alerts Tab ───────────────────────────────────────────── */}
      {activeTab === 'alerts' && (
        <div className="ra-alerts-tab">

          {/* Filter bar */}
          <div className="ra-filter-bar">
            <select
              className="ra-filter-select"
              value={priorityFilter}
              onChange={(e) => { setPriorityFilter(e.target.value as AlertPriority | 'all'); setVisibleCount(PAGE_SIZE); }}
              aria-label="Filter by priority"
            >
              <option value="all">All Priorities</option>
              <option value="critical">🔴 Critical</option>
              <option value="high">🟠 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">🔵 Low</option>
            </select>

            <select
              className="ra-filter-select"
              value={timeFilter}
              onChange={(e) => { setTimeFilter(Number(e.target.value)); setVisibleCount(PAGE_SIZE); }}
              aria-label="Filter by time range"
            >
              {TIME_FILTER_OPTIONS.map((opt, i) => (
                <option key={opt.label} value={i}>{opt.label}</option>
              ))}
            </select>

            <div className="ra-search-wrap">
              <span className="ra-search-icon">🔍</span>
              <input
                className="ra-search-input"
                type="search"
                placeholder="Search alerts…"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(PAGE_SIZE); }}
                aria-label="Search alerts"
              />
            </div>

            {(priorityFilter !== 'all' || searchQuery) && (
              <button
                className="ra-clear-filter-btn"
                onClick={() => { setPriorityFilter('all'); setSearchQuery(''); setVisibleCount(PAGE_SIZE); }}
              >
                ✕ Clear filters
              </button>
            )}
          </div>

          {/* Alert list */}
          {visible.length === 0 ? (
            <div className="ra-empty-state">
              <span className="ra-empty-icon">✅</span>
              <p>
                {filtered.length === 0 && (dismissed.size > 0 || resolved.size > 0)
                  ? 'All alerts have been resolved or dismissed — well done!'
                  : 'No alerts match the current filters.'}
              </p>
              {(priorityFilter !== 'all' || searchQuery) && (
                <button className="ra-btn-secondary" onClick={() => { setPriorityFilter('all'); setSearchQuery(''); }}>
                  Show all alerts
                </button>
              )}
            </div>
          ) : (
            <div className="ra-alert-list" role="list" aria-label="Compliance alerts">
              {visible.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onInvestigate={setInvestigateAlert}
                  onDismiss={handleDismiss}
                />
              ))}
            </div>
          )}

          {/* Load more */}
          {hasMore && (
            <div className="ra-load-more-row">
              <button
                className="ra-load-more-btn"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              >
                Load More Alerts ({filtered.length - visibleCount} remaining)
              </button>
            </div>
          )}

        </div>
      )}

      {/* ── Analytics Tab ────────────────────────────────────────── */}
      {activeTab === 'analytics' && <AnalyticsPanel />}

      {/* ── Notifications Tab ────────────────────────────────────── */}
      {activeTab === 'notifications' && <NotificationsPanel />}

      {/* Investigation modal */}
      {investigateAlert && (
        <InvestigateModal
          alert={investigateAlert}
          onClose={() => setInvestigateAlert(null)}
          onApprove={handleApprove}
          onEscalate={handleEscalate}
          onBlock={handleBlock}
        />
      )}

    </div>
  );
};

export default RealTimeAlertsPage;
