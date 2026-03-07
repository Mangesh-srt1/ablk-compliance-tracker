/**
 * ReportsPage – Section 10 of the Compliance Dashboard
 * Implements:
 *   10.1 Pre-Built Report Templates
 *   10.2 Report Generator (date range, filters, sections, format, progress, result)
 *   10.3 Custom Report Builder (data sources, metrics, filters, layout, save/schedule)
 *   10.4 Dashboards & Data Visualization (KPI tiles, charts, real-time metrics)
 *   10.5 Export & Sharing
 */

import React, { useState, useEffect, useCallback } from 'react';
import '../styles/ReportsPage.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type ExportFormat = 'PDF' | 'Excel' | 'PowerPoint' | 'CSV';
type ReportFrequency = 'Daily' | 'Weekly' | 'Monthly' | 'On-demand';
type TabType = 'prebuilt' | 'custom' | 'dashboards' | 'exports';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  frequency: ReportFrequency;
  formats: ExportFormat[];
  icon: string;
  sections: string[];
}

// ─── Report Templates ─────────────────────────────────────────────────────────

const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'daily-summary',
    name: 'Daily Compliance Summary',
    description: 'All checks processed in last 24 hours with risk breakdown.',
    frequency: 'Daily',
    formats: ['PDF', 'Excel'],
    icon: '📋',
    sections: [
      'Executive Summary', 'Key Metrics', 'Risk Score Distribution',
      'Top 10 High-Risk Checks', 'Jurisdiction Breakdown', 'Workflow Performance',
      'Alert Summary',
    ],
  },
  {
    id: 'weekly-performance',
    name: 'Weekly Performance Report',
    description: 'Weekly metrics, trends, and compliance performance KPIs.',
    frequency: 'Weekly',
    formats: ['PDF', 'Excel', 'PowerPoint'],
    icon: '📊',
    sections: [
      'Executive Summary', 'Weekly KPIs', 'Risk Trends', 'Jurisdiction Performance',
      'Alert Response Times', 'Workflow Efficiency',
    ],
  },
  {
    id: 'monthly-regulatory',
    name: 'Monthly Regulatory Report',
    description: 'Compliance statistics formatted for regulatory submissions.',
    frequency: 'Monthly',
    formats: ['PDF'],
    icon: '🏛️',
    sections: [
      'Regulatory Overview', 'KYC/AML Statistics', 'Sanctions Screening Results',
      'Escalation Summary', 'SLA Compliance', 'Audit Trail',
    ],
  },
  {
    id: 'jurisdiction-breakdown',
    name: 'Jurisdiction Breakdown',
    description: 'Compliance checks and risk scores by country / region.',
    frequency: 'On-demand',
    formats: ['Excel', 'CSV'],
    icon: '🌍',
    sections: ['Jurisdiction Overview', 'Per-Jurisdiction Stats', 'Rule Compliance Rates'],
  },
  {
    id: 'risk-analysis',
    name: 'Risk Score Analysis',
    description: 'Risk score distribution, outliers, and trend analysis.',
    frequency: 'On-demand',
    formats: ['Excel', 'PDF'],
    icon: '⚠️',
    sections: ['Score Distribution', 'High-Risk Entities', 'Trend Analysis', 'Factor Breakdown'],
  },
  {
    id: 'audit-trail',
    name: 'Audit Trail Report',
    description: 'Complete audit log of all system actions and decisions.',
    frequency: 'On-demand',
    formats: ['PDF'],
    icon: '📝',
    sections: ['User Actions', 'Compliance Decisions', 'System Changes', 'API Access Log'],
  },
  {
    id: 'workflow-performance',
    name: 'Workflow Performance',
    description: 'Automation metrics — executions, errors, and efficiency gains.',
    frequency: 'Weekly',
    formats: ['Excel'],
    icon: '🔧',
    sections: ['Execution Summary', 'Error Analysis', 'Processing Time', 'Automation Rate'],
  },
  {
    id: 'alert-response',
    name: 'Alert Response Times',
    description: 'SLA compliance metrics for critical, high, and medium alerts.',
    frequency: 'Monthly',
    formats: ['PDF', 'Excel'],
    icon: '🔔',
    sections: ['SLA Overview', 'Response Times by Priority', 'Escalation Trends', 'Resolution Rates'],
  },
];

// ─── Jurisdictions ────────────────────────────────────────────────────────────

const JURISDICTIONS = ['AE', 'US', 'IN', 'SG', 'UK', 'EU'];
const DATA_SOURCES = [
  { id: 'checks',       label: 'Compliance Checks',  desc: 'All check data + risk scores' },
  { id: 'alerts',       label: 'Alerts',              desc: 'Alert history + response times' },
  { id: 'workflows',    label: 'Workflows',           desc: 'Execution logs + metrics' },
  { id: 'users',        label: 'Users',               desc: 'Activity logs' },
  { id: 'audit',        label: 'Audit Trail',         desc: 'All system actions' },
  { id: 'jurisdictions',label: 'Jurisdictions',       desc: 'Rules + application stats' },
];

// ─── Mock analytics data ──────────────────────────────────────────────────────

const MOCK_DASHBOARD = {
  healthScore: 87,
  totalChecks: 1_847,
  approvedPct: 71,
  pendingPct: 21,
  rejectedPct: 8,
  avgRiskScore: 32.4,
  slaCompliance: 94,
  activeChecks: 7,
  pendingReviews: 23,
  alertsOpen: 10,
  uptimePct: 99.8,
  trends: [42, 58, 65, 47, 71, 83, 62, 77, 55, 68, 90, 74, 88, 52, 61, 79, 85, 70, 95, 58, 73, 87, 66, 81, 54, 69, 84, 76, 91, 63],
  jurisdictions: [
    { code: 'US', count: 482 }, { code: 'AE', count: 374 }, { code: 'IN', count: 287 },
    { code: 'SG', count: 215 }, { code: 'UK', count: 189 }, { code: 'EU', count: 300 },
  ],
};

// ─── Constants ────────────────────────────────────────────────────────────────

const AUTO_REFRESH_INTERVAL_MS = 30_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

function getSevenDaysAgoDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
}

// ─── Mini Sparkline ───────────────────────────────────────────────────────────

const Sparkline: React.FC<{ data: number[]; color?: string; height?: number }> = ({
  data, color = '#667eea', height = 40,
}) => {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 200;
  const h = height;
  const pts = data
    .map((v, i) => `${Math.round((i / (data.length - 1)) * w)},${Math.round(h - (v / max) * h)}`)
    .join(' ');
  return (
    <svg className="rp-sparkline" viewBox={`0 0 ${w} ${h}`} width="100%" height={h}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
};

// ─── Horizontal Bar ───────────────────────────────────────────────────────────

const HBar: React.FC<{ label: string; count: number; max: number }> = ({ label, count, max }) => (
  <div className="rp-hbar-row">
    <span className="rp-hbar-label">{label}</span>
    <div className="rp-hbar-track">
      <div className="rp-hbar-fill" style={{ width: `${(count / max) * 100}%` }} />
    </div>
    <span className="rp-hbar-count">{count.toLocaleString()}</span>
  </div>
);

// ─── Report Generator Modal ───────────────────────────────────────────────────

interface ReportGenModalProps {
  template: ReportTemplate;
  onClose: () => void;
}

type GenStep = 'config' | 'generating' | 'done';

const ReportGenModal: React.FC<ReportGenModalProps> = ({ template, onClose }) => {
  const [step, setStep]         = useState<GenStep>('config');
  const [dateFrom, setDateFrom] = useState(getSevenDaysAgoDateString());
  const [dateTo, setDateTo]     = useState(getTodayDateString());
  const [jurisdiction, setJurisdiction] = useState('all');
  const [status, setStatus]     = useState('all');
  const [riskLevel, setRiskLevel] = useState('all');
  const [format, setFormat]     = useState<ExportFormat>(template.formats[0]);
  const [sections, setSections] = useState<Set<string>>(new Set(template.sections));
  const [progress, setProgress] = useState(0);

  const toggleSection = (s: string) => {
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const generate = useCallback(() => {
    setStep('generating');
    let p = 0;
    const iv = setInterval(() => {
      p += Math.floor(Math.random() * 18) + 5;
      if (p >= 100) {
        clearInterval(iv);
        setProgress(100);
        setTimeout(() => setStep('done'), 300);
      } else {
        setProgress(p);
      }
    }, 400);
    return () => clearInterval(iv);
  }, []);

  const STEPS = ['Gathering data', 'Filtering records', 'Calculating metrics', 'Building charts', 'Formatting output', 'Compiling PDF', 'Finalizing'];
  const stepIdx = Math.min(Math.floor((progress / 100) * STEPS.length), STEPS.length - 1);

  return (
    <div className="rp-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="rp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rp-modal-header">
          <h3>{template.icon} {template.name}</h3>
          <button className="rp-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* ── Config step ─── */}
        {step === 'config' && (
          <>
            <div className="rp-gen-form">
              {/* Date range */}
              <div className="rp-gen-group">
                <div className="rp-gen-label">📅 Date Range</div>
                <div className="rp-date-row">
                  <label>From <input type="date" className="rp-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
                  <label>To <input type="date" className="rp-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
                </div>
              </div>

              {/* Filters */}
              <div className="rp-gen-group">
                <div className="rp-gen-label">🔍 Filters (optional)</div>
                <div className="rp-filter-row">
                  <label>
                    Jurisdiction
                    <select className="rp-select" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}>
                      <option value="all">All</option>
                      {JURISDICTIONS.map((j) => <option key={j} value={j}>{j}</option>)}
                    </select>
                  </label>
                  <label>
                    Status
                    <select className="rp-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                      <option value="all">All</option>
                      <option value="approved">Approved</option>
                      <option value="pending">Pending Review</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </label>
                  <label>
                    Risk Level
                    <select className="rp-select" value={riskLevel} onChange={(e) => setRiskLevel(e.target.value)}>
                      <option value="all">All</option>
                      <option value="low">Low (0–29)</option>
                      <option value="medium">Medium (30–69)</option>
                      <option value="high">High (70–100)</option>
                    </select>
                  </label>
                </div>
              </div>

              {/* Sections */}
              <div className="rp-gen-group">
                <div className="rp-gen-label">📄 Include Sections</div>
                <div className="rp-sections-grid">
                  {template.sections.map((s) => (
                    <label key={s} className="rp-check-label">
                      <input type="checkbox" checked={sections.has(s)} onChange={() => toggleSection(s)} />
                      {s}
                    </label>
                  ))}
                  <label className="rp-check-label rp-check-optional">
                    <input type="checkbox" />
                    Detailed Check List <span className="rp-opt-note">(adds 50+ pages)</span>
                  </label>
                </div>
              </div>

              {/* Format */}
              <div className="rp-gen-group">
                <div className="rp-gen-label">📁 Format</div>
                <div className="rp-radio-row">
                  {template.formats.map((f) => (
                    <label key={f} className="rp-radio-label">
                      <input type="radio" name="format" value={f} checked={format === f} onChange={() => setFormat(f)} />
                      {f}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="rp-modal-actions">
              <button className="rp-btn-secondary" onClick={onClose}>Cancel</button>
              <button
                className="rp-btn-primary"
                onClick={generate}
                disabled={sections.size === 0}
              >
                📊 Generate Report
              </button>
            </div>
          </>
        )}

        {/* ── Generating step ─── */}
        {step === 'generating' && (
          <div className="rp-generating">
            <div className="rp-gen-spinner">⏳</div>
            <p className="rp-gen-status">Generating report…</p>
            <p className="rp-gen-step">{STEPS[stepIdx]} ({Math.min(stepIdx + 1, STEPS.length)}/{STEPS.length} steps complete)</p>
            <div className="rp-progress-track">
              <div className="rp-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="rp-progress-pct">{progress}%</div>
            <p className="rp-gen-eta">Estimated time: ~{Math.max(1, Math.ceil((100 - progress) / 20))} seconds</p>
          </div>
        )}

        {/* ── Done step ─── */}
        {step === 'done' && (
          <div className="rp-done">
            <div className="rp-done-icon">✅</div>
            <div className="rp-done-title">Report Generated Successfully</div>
            <div className="rp-done-meta">
              <strong>{template.name}</strong> — {new Date().toLocaleDateString()}<br />
              {sections.size * 4}–{sections.size * 8} pages · {format} · ~{(sections.size * 0.4).toFixed(1)} MB
            </div>
            <div className="rp-done-actions">
              <button className="rp-done-btn" onClick={() => window.alert('Download triggered — file saved to Downloads folder.')}>
                📥 Download Report
              </button>
              <button className="rp-done-btn" onClick={() => window.alert('Email dialog: Enter recipient addresses and optional message.')}>
                📧 Email Report
              </button>
              <button className="rp-done-btn" onClick={() => window.alert('Schedule dialog: Configure delivery frequency and recipients.')}>
                🕐 Schedule Delivery
              </button>
            </div>
            <button className="rp-btn-secondary" style={{ marginTop: '1rem' }} onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Custom Report Builder ────────────────────────────────────────────────────

const CustomReportBuilder: React.FC = () => {
  const [step, setStep]             = useState(1);
  const [selectedSource, setSelectedSource] = useState<string>('checks');
  const [metrics, setMetrics]       = useState<Set<string>>(new Set(['Total Checks', 'Average Risk Score', 'Approval Rate (%)']));
  const [breakdowns, setBreakdowns] = useState<Set<string>>(new Set(['Jurisdiction', 'Date (daily)', 'Status']));
  const [charts, setCharts]         = useState<Set<string>>(new Set(['Bar chart (checks by jurisdiction)', 'Line chart (risk scores over time)', 'Pie chart (status distribution)']));
  const [dateRange, setDateRange]   = useState<'7d' | '30d' | '90d' | 'custom'>('7d');
  const [jFilters, setJFilters]     = useState<Set<string>>(new Set(JURISDICTIONS));
  const [reportName, setReportName] = useState('');
  const [format, setFormat]         = useState<'PDF' | 'Excel' | 'PowerPoint' | 'All'>('PDF');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [saved, setSaved]           = useState(false);

  const toggleSet = (set: Set<string>, val: string): Set<string> => {
    const next = new Set(set);
    if (next.has(val)) next.delete(val); else next.add(val);
    return next;
  };

  const METRIC_OPTIONS = [
    'Total Checks', 'Average Risk Score', 'Total Transaction Volume', 'Approval Rate (%)',
    'Escalation Rate (%)', 'Rejection Rate (%)', 'SLA Compliance (%)',
  ];
  const BREAKDOWN_OPTIONS = ['Jurisdiction', 'Date (daily)', 'Hour of day', 'Status', 'Risk Level', 'Entity Type'];
  const CHART_OPTIONS = [
    'Bar chart (checks by jurisdiction)', 'Line chart (risk scores over time)',
    'Pie chart (status distribution)', 'Heat map', 'Scatter plot',
  ];

  const handleSave = () => {
    if (!reportName.trim()) return;
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="rp-custom-root">
      {/* Step navigator */}
      <div className="rp-step-nav">
        {['Data Sources', 'Metrics', 'Filters', 'Layout', 'Save & Schedule'].map((s, i) => (
          <button
            key={s}
            className={`rp-step-btn ${step === i + 1 ? 'rp-step-active' : ''} ${i + 1 < step ? 'rp-step-done' : ''}`}
            onClick={() => setStep(i + 1)}
          >
            <span className="rp-step-num">{i + 1 < step ? '✓' : i + 1}</span>
            <span className="rp-step-label">{s}</span>
          </button>
        ))}
      </div>

      {/* Step 1 – Data Sources */}
      {step === 1 && (
        <div className="rp-custom-panel">
          <h4 className="rp-panel-title">Step 1: Select Data Source</h4>
          <div className="rp-source-grid">
            {DATA_SOURCES.map((src) => (
              <button
                key={src.id}
                className={`rp-source-card ${selectedSource === src.id ? 'rp-source-selected' : ''}`}
                onClick={() => setSelectedSource(src.id)}
              >
                <span className="rp-source-label">{src.label}</span>
                <span className="rp-source-desc">{src.desc}</span>
              </button>
            ))}
          </div>
          <div className="rp-step-actions">
            <button className="rp-btn-primary" onClick={() => setStep(2)}>Next: Metrics →</button>
          </div>
        </div>
      )}

      {/* Step 2 – Metrics */}
      {step === 2 && (
        <div className="rp-custom-panel">
          <h4 className="rp-panel-title">Step 2: Choose Metrics</h4>
          <div className="rp-metrics-columns">
            <div>
              <div className="rp-subheading">Primary Metrics</div>
              {METRIC_OPTIONS.map((m) => (
                <label key={m} className="rp-check-label">
                  <input type="checkbox" checked={metrics.has(m)} onChange={() => setMetrics(toggleSet(metrics, m))} />
                  {m}
                </label>
              ))}
            </div>
            <div>
              <div className="rp-subheading">Breakdown By</div>
              {BREAKDOWN_OPTIONS.map((b) => (
                <label key={b} className="rp-check-label">
                  <input type="checkbox" checked={breakdowns.has(b)} onChange={() => setBreakdowns(toggleSet(breakdowns, b))} />
                  {b}
                </label>
              ))}
            </div>
            <div>
              <div className="rp-subheading">Visualizations</div>
              {CHART_OPTIONS.map((c) => (
                <label key={c} className="rp-check-label">
                  <input type="checkbox" checked={charts.has(c)} onChange={() => setCharts(toggleSet(charts, c))} />
                  {c}
                </label>
              ))}
            </div>
          </div>
          <div className="rp-step-actions">
            <button className="rp-btn-secondary" onClick={() => setStep(1)}>← Back</button>
            <button className="rp-btn-primary" onClick={() => setStep(3)}>Next: Filters →</button>
          </div>
        </div>
      )}

      {/* Step 3 – Filters */}
      {step === 3 && (
        <div className="rp-custom-panel">
          <h4 className="rp-panel-title">Step 3: Apply Filters</h4>
          <div className="rp-filters-grid">
            <div className="rp-filter-group">
              <div className="rp-subheading">Date Range</div>
              {(['7d', '30d', '90d', 'custom'] as const).map((v) => (
                <label key={v} className="rp-radio-label">
                  <input type="radio" name="dateRange" value={v} checked={dateRange === v} onChange={() => setDateRange(v)} />
                  {{ '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days', custom: 'Custom range' }[v]}
                </label>
              ))}
            </div>
            <div className="rp-filter-group">
              <div className="rp-subheading">Jurisdiction</div>
              {JURISDICTIONS.map((j) => (
                <label key={j} className="rp-check-label">
                  <input type="checkbox" checked={jFilters.has(j)} onChange={() => setJFilters(toggleSet(jFilters, j))} />
                  {j}
                </label>
              ))}
            </div>
            <div className="rp-filter-group">
              <div className="rp-subheading">Risk Score</div>
              <div className="rp-range-row">
                <label>Min: <input type="number" className="rp-input-sm" defaultValue={0} min={0} max={100} /></label>
                <label>Max: <input type="number" className="rp-input-sm" defaultValue={100} min={0} max={100} /></label>
              </div>
              <div className="rp-subheading" style={{ marginTop: '0.5rem' }}>Status</div>
              {['All', 'Approved', 'Pending', 'Rejected'].map((s) => (
                <label key={s} className="rp-check-label">
                  <input type="checkbox" defaultChecked={s === 'All'} />
                  {s}
                </label>
              ))}
            </div>
          </div>
          <div className="rp-step-actions">
            <button className="rp-btn-secondary" onClick={() => setStep(2)}>← Back</button>
            <button className="rp-btn-primary" onClick={() => setStep(4)}>Next: Layout →</button>
          </div>
        </div>
      )}

      {/* Step 4 – Layout */}
      {step === 4 && (
        <div className="rp-custom-panel">
          <h4 className="rp-panel-title">Step 4: Customize Layout</h4>
          <div className="rp-layout-list">
            {['📄 Title Page', '📊 Executive Summary', '📈 Key Metrics Cards',
              '📊 Risk Score Trends (line chart)', '🌍 Jurisdiction Breakdown (bar chart)',
              '📋 Top 20 High-Risk Checks (table)', '⚠️ Alerts Summary',
              '📝 Detailed Data Table', '📎 Appendix'].map((item, idx) => (
              <div key={item} className="rp-layout-item" draggable>
                <span className="rp-layout-drag">⠿</span>
                <span className="rp-layout-num">{idx + 1}.</span>
                <span>{item}</span>
                <button className="rp-layout-remove" title="Remove section">✕</button>
              </div>
            ))}
          </div>
          <button className="rp-add-section-btn">➕ Add Section</button>
          <div className="rp-step-actions">
            <button className="rp-btn-secondary" onClick={() => setStep(3)}>← Back</button>
            <button className="rp-btn-primary" onClick={() => setStep(5)}>Next: Save →</button>
          </div>
        </div>
      )}

      {/* Step 5 – Save & Schedule */}
      {step === 5 && (
        <div className="rp-custom-panel">
          <h4 className="rp-panel-title">Step 5: Save & Schedule</h4>
          <div className="rp-save-form">
            <label className="rp-form-label">
              Report Name *
              <input
                type="text"
                className="rp-input"
                placeholder="e.g. Weekly AE Compliance Summary"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
              />
            </label>
            <label className="rp-form-label">
              Description
              <textarea className="rp-textarea" rows={2} placeholder="Optional description…" />
            </label>
            <div className="rp-subheading">Format</div>
            <div className="rp-radio-row">
              {(['PDF', 'Excel', 'PowerPoint', 'All'] as const).map((f) => (
                <label key={f} className="rp-radio-label">
                  <input type="radio" name="customFormat" value={f} checked={format === f} onChange={() => setFormat(f)} />
                  {f}
                </label>
              ))}
            </div>
            <label className="rp-check-label" style={{ marginTop: '0.75rem' }}>
              <input type="checkbox" checked={scheduleEnabled} onChange={(e) => setScheduleEnabled(e.target.checked)} />
              Enable scheduled delivery
            </label>
            {scheduleEnabled && (
              <div className="rp-schedule-row">
                <label>Frequency <select className="rp-select-sm"><option>Weekly</option><option>Monthly</option><option>Daily</option></select></label>
                <label>Day <select className="rp-select-sm"><option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option></select></label>
                <label>Time <select className="rp-select-sm"><option>09:00 AM</option><option>12:00 PM</option><option>06:00 PM</option></select></label>
                <label>Recipients <input type="email" className="rp-input" placeholder="compliance@company.com" /></label>
              </div>
            )}
            <label className="rp-check-label">
              <input type="checkbox" defaultChecked />
              Save as template for reuse
            </label>
          </div>
          <div className="rp-step-actions">
            <button className="rp-btn-secondary" onClick={() => setStep(4)}>← Back</button>
            <button className="rp-btn-secondary" onClick={handleSave} disabled={!reportName.trim()}>💾 Save</button>
            <button className="rp-btn-primary" onClick={() => window.alert('Report generation started. You will be notified when ready.')} disabled={!reportName.trim()}>
              🚀 Generate Now
            </button>
          </div>
          {saved && <div className="rp-save-success">✅ Report saved as template!</div>}
        </div>
      )}
    </div>
  );
};

// ─── Analytics Dashboard ──────────────────────────────────────────────────────

const AnalyticsDashboard: React.FC = () => {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const data = MOCK_DASHBOARD;

  useEffect(() => {
    if (!autoRefresh) return;
    const iv = setInterval(() => setLastRefreshed(new Date()), AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [autoRefresh]);

  const healthColor = data.healthScore >= 80 ? '#10b981' : data.healthScore >= 60 ? '#f59e0b' : '#ef4444';
  const maxJ = Math.max(...data.jurisdictions.map((j) => j.count));

  return (
    <div className="rp-dash-root">
      <div className="rp-dash-topbar">
        <div className="rp-dash-meta">
          Last refreshed: {lastRefreshed.toLocaleTimeString()}
          <label className="rp-check-label" style={{ marginLeft: '1rem', display: 'inline-flex' }}>
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            Auto-refresh (30s)
          </label>
        </div>
        <div className="rp-dash-actions">
          <button className="rp-btn-secondary" onClick={() => setLastRefreshed(new Date())}>↻ Refresh</button>
          <button className="rp-btn-secondary" onClick={() => window.alert('Dashboard exported as PDF.')}>📥 Export</button>
        </div>
      </div>

      <div className="rp-tile-grid">
        {/* Compliance Health Score */}
        <div className="rp-tile rp-tile-health">
          <div className="rp-tile-header">🏥 Compliance Health Score</div>
          <div className="rp-health-ring">
            <svg viewBox="0 0 80 80" width="80" height="80">
              <circle cx="40" cy="40" r="30" fill="none" stroke="#e2e8f0" strokeWidth="10" />
              <circle
                cx="40" cy="40" r="30" fill="none"
                stroke={healthColor} strokeWidth="10"
                strokeDasharray={`${(data.healthScore / 100) * 188.5} ${188.5 - (data.healthScore / 100) * 188.5}`}
                strokeLinecap="round"
                transform="rotate(-90 40 40)"
              />
            </svg>
            <div className="rp-health-num" style={{ color: healthColor }}>{data.healthScore}</div>
          </div>
          <div className="rp-tile-sub">
            Approval Rate: {data.approvedPct}% · SLA: {data.slaCompliance}%
          </div>
        </div>

        {/* Check Volume Trend */}
        <div className="rp-tile rp-tile-trend">
          <div className="rp-tile-header">📈 Check Volume — Last 30 Days</div>
          <div className="rp-tile-value">{data.totalChecks.toLocaleString()} <span className="rp-tile-unit">total</span></div>
          <Sparkline data={data.trends} color="#667eea" height={52} />
          <div className="rp-tile-sub">Avg risk score: {data.avgRiskScore}</div>
        </div>

        {/* Status Breakdown */}
        <div className="rp-tile">
          <div className="rp-tile-header">📊 Status Breakdown</div>
          <div className="rp-status-bars">
            <div className="rp-sb-row">
              <span>✅ Approved</span>
              <div className="rp-sb-track"><div className="rp-sb-fill rp-sb-approved" style={{ width: `${data.approvedPct}%` }} /></div>
              <span>{data.approvedPct}%</span>
            </div>
            <div className="rp-sb-row">
              <span>⏳ Pending</span>
              <div className="rp-sb-track"><div className="rp-sb-fill rp-sb-pending" style={{ width: `${data.pendingPct}%` }} /></div>
              <span>{data.pendingPct}%</span>
            </div>
            <div className="rp-sb-row">
              <span>❌ Rejected</span>
              <div className="rp-sb-track"><div className="rp-sb-fill rp-sb-rejected" style={{ width: `${data.rejectedPct}%` }} /></div>
              <span>{data.rejectedPct}%</span>
            </div>
          </div>
        </div>

        {/* Jurisdiction Performance */}
        <div className="rp-tile rp-tile-wide">
          <div className="rp-tile-header">🌍 Jurisdiction Performance</div>
          <div className="rp-jbar-list">
            {[...data.jurisdictions].sort((a, b) => b.count - a.count).map((j) => (
              <HBar key={j.code} label={j.code} count={j.count} max={maxJ} />
            ))}
          </div>
        </div>

        {/* Real-time metrics */}
        <div className="rp-tile">
          <div className="rp-tile-header">⚡ Real-Time Metrics</div>
          <div className="rp-rt-grid">
            <div className="rp-rt-item"><span className="rp-rt-icon">🔄</span><div><div className="rp-rt-val">{data.activeChecks}</div><div className="rp-rt-label">Active</div></div></div>
            <div className="rp-rt-item"><span className="rp-rt-icon">⏳</span><div><div className="rp-rt-val">{data.pendingReviews}</div><div className="rp-rt-label">Pending</div></div></div>
            <div className="rp-rt-item"><span className="rp-rt-icon">🔔</span><div><div className="rp-rt-val">{data.alertsOpen}</div><div className="rp-rt-label">Alerts</div></div></div>
            <div className="rp-rt-item"><span className="rp-rt-icon">✅</span><div><div className="rp-rt-val">{data.uptimePct}%</div><div className="rp-rt-label">Uptime</div></div></div>
          </div>
        </div>

        {/* Top Risk Entities */}
        <div className="rp-tile">
          <div className="rp-tile-header">🚨 Top High-Risk Entities</div>
          <table className="rp-risk-table">
            <thead><tr><th>#</th><th>Wallet</th><th>Score</th><th>Jurisdiction</th></tr></thead>
            <tbody>
              {[
                { w: '0x1234…5678', s: 95, j: 'IR' },
                { w: '0xabcd…ef01', s: 87, j: 'XX' },
                { w: '0x9999…7777', s: 78, j: 'US' },
                { w: '0xdead…1234', s: 74, j: 'EU' },
                { w: '0x1111…aaaa', s: 71, j: 'EU' },
              ].map((row, i) => (
                <tr key={row.w}>
                  <td>{i + 1}</td>
                  <td><code>{row.w}</code></td>
                  <td><span className={`rp-score-chip ${row.s >= 70 ? 'rp-score-high' : 'rp-score-med'}`}>{row.s}</span></td>
                  <td>{row.j}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ─── Exports Panel ────────────────────────────────────────────────────────────

const ExportsPanel: React.FC = () => {
  const [emailTo, setEmailTo] = useState('');
  const [shareExpiry, setShareExpiry] = useState<'1d' | '7d' | '30d'>('7d');
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const generateLink = () => {
    const token = Math.random().toString(36).slice(2, 14).toUpperCase();
    setShareLink(`https://app.ableka.io/reports/shared/${token}`);
  };

  const sendEmail = () => {
    if (!emailTo.trim()) return;
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 3000);
  };

  return (
    <div className="rp-exports-root">
      <h3 className="rp-section-title">📤 Export & Sharing Options</h3>

      <div className="rp-exports-grid">
        {/* Download */}
        <div className="rp-export-card">
          <div className="rp-export-icon">💾</div>
          <h4>Download to Computer</h4>
          <p>Save the latest compliance report directly to your device.</p>
          <div className="rp-export-formats">
            {(['PDF', 'Excel', 'CSV'] as const).map((f) => (
              <button key={f} className="rp-format-btn" onClick={() => window.alert(`Downloading as ${f}…`)}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Email */}
        <div className="rp-export-card">
          <div className="rp-export-icon">📧</div>
          <h4>Email Report</h4>
          <p>Send the report to one or more recipients.</p>
          <input
            type="email"
            className="rp-input"
            placeholder="recipient@company.com, …"
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
          />
          <textarea className="rp-textarea" rows={2} placeholder="Optional message…" />
          <button className="rp-btn-primary" onClick={sendEmail} disabled={!emailTo.trim()}>Send Report</button>
          {emailSent && <div className="rp-success-msg">✅ Email sent!</div>}
        </div>

        {/* Schedule */}
        <div className="rp-export-card">
          <div className="rp-export-icon">🕐</div>
          <h4>Schedule Regular Delivery</h4>
          <p>Auto-generate and email reports on a recurring basis.</p>
          <div className="rp-schedule-config">
            <label>Frequency <select className="rp-select-sm"><option>Daily</option><option>Weekly</option><option>Monthly</option></select></label>
            <label>Time <select className="rp-select-sm"><option>09:00 AM</option><option>12:00 PM</option><option>06:00 PM</option></select></label>
            <label>Recipients <input type="email" className="rp-input" placeholder="team@company.com" /></label>
          </div>
          <button className="rp-btn-primary" onClick={() => window.alert('Schedule saved! Reports will be auto-delivered.')}>
            Save Schedule
          </button>
        </div>

        {/* Share Link */}
        <div className="rp-export-card">
          <div className="rp-export-icon">🔗</div>
          <h4>Share Link</h4>
          <p>Generate a secure, time-limited link for external sharing.</p>
          <div className="rp-share-expiry">
            {(['1d', '7d', '30d'] as const).map((v) => (
              <label key={v} className="rp-radio-label">
                <input type="radio" name="expiry" value={v} checked={shareExpiry === v} onChange={() => setShareExpiry(v)} />
                {v === '1d' ? '1 day' : v === '7d' ? '7 days' : '30 days'}
              </label>
            ))}
          </div>
          <button className="rp-btn-primary" onClick={generateLink}>Generate Link</button>
          {shareLink && (
            <div className="rp-share-link-box">
              <input type="text" className="rp-input" readOnly value={shareLink} />
              <button className="rp-copy-btn" onClick={() => { navigator.clipboard.writeText(shareLink); window.alert('Link copied!'); }}>
                📋 Copy
              </button>
            </div>
          )}
        </div>

        {/* API Access */}
        <div className="rp-export-card rp-export-card-wide">
          <div className="rp-export-icon">🔌</div>
          <h4>API Access</h4>
          <p>Integrate report data directly into your systems using the REST API.</p>
          <pre className="rp-code-block">{`GET /api/v1/reports/{report_id}\nAuthorization: Bearer YOUR_JWT_TOKEN\n\nResponse: JSON data for programmatic use`}</pre>
          <p className="rp-api-note">See <a href="#" onClick={(e) => { e.preventDefault(); window.alert('API documentation available at http://localhost:4000/api/docs'); }}>API Documentation</a> for full endpoint reference.</p>
        </div>
      </div>
    </div>
  );
};

// ─── Main ReportsPage ─────────────────────────────────────────────────────────

const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab]       = useState<TabType>('prebuilt');
  const [genModal, setGenModal]         = useState<ReportTemplate | null>(null);

  return (
    <div className="rp-root">
      {/* Header */}
      <div className="rp-page-header">
        <h2 className="rp-page-title">📈 Reports &amp; Analytics</h2>
        <p className="rp-page-subtitle">
          Generate compliance reports, explore analytics dashboards, and share insights with your team.
        </p>
      </div>

      {/* Tab bar */}
      <div className="rp-tabs" role="tablist">
        {([
          { id: 'prebuilt',   label: '📋 Pre-Built Reports' },
          { id: 'custom',     label: '🔨 Custom Builder' },
          { id: 'dashboards', label: '📊 Dashboards' },
          { id: 'exports',    label: '📤 Export & Share' },
        ] as { id: TabType; label: string }[]).map((tab) => (
          <button
            key={tab.id}
            className={`rp-tab ${activeTab === tab.id ? 'rp-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Pre-Built Reports ── */}
      {activeTab === 'prebuilt' && (
        <div className="rp-template-grid">
          {REPORT_TEMPLATES.map((tpl) => (
            <div key={tpl.id} className="rp-template-card">
              <div className="rp-template-icon">{tpl.icon}</div>
              <div className="rp-template-body">
                <div className="rp-template-name">{tpl.name}</div>
                <div className="rp-template-desc">{tpl.description}</div>
                <div className="rp-template-meta">
                  <span className="rp-freq-badge">{tpl.frequency}</span>
                  {tpl.formats.map((f) => (
                    <span key={f} className="rp-fmt-badge">{f}</span>
                  ))}
                </div>
              </div>
              <button className="rp-generate-btn" onClick={() => setGenModal(tpl)}>
                📊 Generate
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Custom Builder ── */}
      {activeTab === 'custom' && <CustomReportBuilder />}

      {/* ── Dashboards ── */}
      {activeTab === 'dashboards' && <AnalyticsDashboard />}

      {/* ── Exports ── */}
      {activeTab === 'exports' && <ExportsPanel />}

      {/* Report Generator Modal */}
      {genModal && (
        <ReportGenModal template={genModal} onClose={() => setGenModal(null)} />
      )}
    </div>
  );
};

export default ReportsPage;
