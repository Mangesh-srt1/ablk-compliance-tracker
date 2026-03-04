/**
 * RegisterPage Component
 * Two-step self-registration flow:
 *   Step 1 – Fill in email, full name, password and select a platform role.
 *   Step 2 – Enter the 6-digit OTP sent to the registered email address.
 *             In development the OTP is shown directly on screen.
 *   Step 3 – Pending approval notice shown after successful OTP verification.
 *             A platform admin must approve the account before the user can log in.
 *
 * Available roles (problem-statement spec):
 *   TENANT_ADMIN | COMPLIANCE_OFFICER | COMPLIANCE_ANALYST | OPERATOR | READ_ONLY
 */

import React, { useState, useRef, useEffect } from 'react';
import { authAPI, TokenClaims } from '../services/authAPI';
import '../styles/RegisterPage.css';

interface RegisterPageProps {
  /** Called after successful OTP verification with the decoded JWT claims. */
  onRegister: (claims: TokenClaims) => void;
  /** Switch back to the login page. */
  onSwitchToLogin: () => void;
}

// ─── Role definitions ─────────────────────────────────────────────────────────

interface RoleOption {
  value: string;
  label: string;
  description: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    value: 'tenant_admin',
    label: 'Tenant Admin',
    description: 'Full admin for your tenant — manage settings, API keys, and user invites.',
  },
  {
    value: 'compliance_officer',
    label: 'Compliance Officer',
    description: 'View / manage alerts & cases, approve / reject reviews, file STR/SAR, edit rules.',
  },
  {
    value: 'compliance_analyst',
    label: 'Compliance Analyst',
    description: 'Investigate cases, add notes, and propose decisions. No global settings access.',
  },
  {
    value: 'operator',
    label: 'Operator / Ops User',
    description: 'View customer/asset status, trigger manual reviews, export operational reports.',
  },
  {
    value: 'read_only',
    label: 'Read-Only / Viewer',
    description: 'View-only access to dashboards, cases, and reports. Cannot modify anything.',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

const RESEND_COOLDOWN_SECONDS = 60;

const RegisterPage: React.FC<RegisterPageProps> = ({ onRegister, onSwitchToLogin }) => {
  // ── Step 1 state ────────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // ── Step 2 state ────────────────────────────────────────────────────────────
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [debugOtp, setDebugOtp] = useState<string | undefined>();
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Shared state ────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Resend cooldown ticker
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // ── Step 1 submit ────────────────────────────────────────────────────────────

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!role) {
      setError('Please select a role.');
      return;
    }

    setLoading(true);
    try {
      const result = await authAPI.register({
        email,
        full_name: fullName,
        password,
        role,
        ...(tenantId.trim() ? { tenant_id: tenantId.trim().toUpperCase() } : {}),
      });
      setDebugOtp(result.debug_otp);
      setStep(2);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Registration failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── OTP input handlers ───────────────────────────────────────────────────────

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      setOtp(text.split(''));
      otpRefs.current[5]?.focus();
      e.preventDefault();
    }
  };

  // ── Step 2 submit ────────────────────────────────────────────────────────────

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter all 6 digits of the verification code.');
      return;
    }
    setLoading(true);
    try {
      const result = await authAPI.verifyOtp(email, code);
      if ('requiresAdminApproval' in result) {
        // Admin approval required — move to step 3 (pending notice)
        setStep(3);
      } else {
        // Legacy: JWT issued immediately (e.g., admin bypassed)
        onRegister(result);
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Verification failed. Please check the code and try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ───────────────────────────────────────────────────────────────

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    try {
      const result = await authAPI.resendOtp(email);
      setDebugOtp(result.debug_otp);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } catch {
      setError('Failed to resend code. Please try again.');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="reg-page">
      <div className="reg-card">

        {/* Logo */}
        <div className="reg-logo">
          <h1>Ableka Lumina</h1>
          <p>AI-Driven Regulatory Technology Platform</p>
        </div>

        {/* Step indicator */}
        <div className="reg-steps">
          <div className={`reg-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'done' : ''}`}>
            <span className="reg-step-num">{step > 1 ? '✓' : '1'}</span>
            <span className="reg-step-label">Your details</span>
          </div>
          <div className="reg-step-connector" />
          <div className={`reg-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'done' : ''}`}>
            <span className="reg-step-num">{step > 2 ? '✓' : '2'}</span>
            <span className="reg-step-label">Verify email</span>
          </div>
          <div className="reg-step-connector" />
          <div className={`reg-step ${step >= 3 ? 'active' : ''}`}>
            <span className="reg-step-num">3</span>
            <span className="reg-step-label">Await approval</span>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="reg-error" role="alert">
            {error}
          </div>
        )}

        {/* ── Step 1: Registration form ── */}
        {step === 1 && (
          <form className="reg-form" onSubmit={handleRegister} noValidate>
            <h2>Create your account</h2>

            <div className="reg-form-group">
              <label htmlFor="reg-email">Email address</label>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className="reg-form-group">
              <label htmlFor="reg-fullname">Full name</label>
              <input
                id="reg-fullname"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Smith"
                required
                autoComplete="name"
                disabled={loading}
              />
            </div>

            <div className="reg-form-row">
              <div className="reg-form-group">
                <label htmlFor="reg-password">Password</label>
                <div className="reg-password-wrap">
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    required
                    autoComplete="new-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="reg-eye-btn"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div className="reg-form-group">
                <label htmlFor="reg-confirm-password">Confirm password</label>
                <input
                  id="reg-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  required
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Role selector */}
            <div className="reg-form-group">
              <label>Platform role</label>
              <div className="reg-role-grid">
                {ROLE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`reg-role-card${role === opt.value ? ' selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={opt.value}
                      checked={role === opt.value}
                      onChange={() => setRole(opt.value)}
                      disabled={loading}
                    />
                    <span className="reg-role-title">{opt.label}</span>
                    <span className="reg-role-desc">{opt.description}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Optional tenant ID */}
            <div className="reg-form-group">
              <label htmlFor="reg-tenant">
                Tenant ID <span className="reg-optional">(optional)</span>
              </label>
              <input
                id="reg-tenant"
                type="text"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="e.g. TENANT_123"
                autoComplete="off"
                disabled={loading}
              />
              <span className="reg-hint">
                Leave blank if your organisation is not yet registered in Ableka Lumina.
              </span>
            </div>

            <button
              type="submit"
              className="reg-btn reg-btn--primary"
              disabled={loading || !email || !fullName || !password || !confirmPassword || !role}
            >
              {loading ? 'Creating account…' : 'Continue'}
            </button>

            <p className="reg-switch">
              Already have an account?{' '}
              <button type="button" className="reg-link" onClick={onSwitchToLogin}>
                Sign in
              </button>
            </p>
          </form>
        )}

        {/* ── Step 2: OTP verification ── */}
        {step === 2 && (
          <form className="reg-form" onSubmit={handleVerify} noValidate>
            <h2>Verify your email</h2>
            <p className="reg-otp-intro">
              We sent a 6-digit code to <strong>{email}</strong>. Enter it below to activate your
              account.
            </p>

            {/* Dev helper */}
            {debugOtp && (
              <div className="reg-debug-otp" role="note">
                <span>🔧 Dev mode — OTP: </span>
                <code
                  className="reg-debug-code"
                  onClick={() => {
                    setOtp(debugOtp.split(''));
                    otpRefs.current[5]?.focus();
                  }}
                  title="Click to auto-fill"
                >
                  {debugOtp}
                </code>
                <span className="reg-debug-hint"> (click to fill)</span>
              </div>
            )}

            <div className="reg-otp-boxes" onPaste={handleOtpPaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => (otpRefs.current[i] = el)}
                  className="reg-otp-box"
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  disabled={loading}
                  aria-label={`OTP digit ${i + 1}`}
                />
              ))}
            </div>

            <button
              type="submit"
              className="reg-btn reg-btn--primary"
              disabled={loading || otp.join('').length !== 6}
            >
              {loading ? 'Verifying…' : 'Verify & sign in'}
            </button>

            <div className="reg-resend">
              <span>Didn't receive a code? </span>
              <button
                type="button"
                className="reg-link"
                onClick={handleResend}
                disabled={resendCooldown > 0}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </button>
            </div>

            <p className="reg-switch">
              <button
                type="button"
                className="reg-link"
                onClick={() => { setStep(1); setError(null); setOtp(['', '', '', '', '', '']); }}
              >
                ← Back to registration
              </button>
            </p>
          </form>
        )}
        {/* ── Step 3: Pending admin approval ── */}
        {step === 3 && (
          <div className="reg-form">
            <h2>Registration submitted!</h2>
            <div className="reg-pending-approval">
              <div className="reg-pending-icon" aria-hidden="true">🕐</div>
              <p>
                Your email <strong>{email}</strong> has been verified.
              </p>
              <p>
                Your account is now <strong>pending approval</strong> by a platform
                administrator. You will be able to sign in once your account has been activated.
              </p>
              <p className="reg-hint">
                If you don't hear back within 24 hours, please contact your platform
                administrator.
              </p>
            </div>
            <p className="reg-switch">
              <button type="button" className="reg-link" onClick={onSwitchToLogin}>
                Back to sign in
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegisterPage;
