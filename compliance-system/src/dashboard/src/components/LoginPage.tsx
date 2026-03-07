/**
 * LoginPage Component
 * Email + password form → calls POST /api/auth/login → stores JWT in localStorage
 * Includes: Forgot Password modal with password requirements display
 */

import React, { useState } from 'react';
import { authAPI, TokenClaims } from '../services/authAPI';
import '../styles/LoginPage.css';

interface LoginPageProps {
  onLogin: (claims: TokenClaims) => void;
  onSwitchToRegister?: () => void;
}

// ── Password requirements (per user manual spec) ─────────────────────────────
const PASSWORD_REQUIREMENTS = [
  { label: 'Minimum 12 characters',                   re: /.{12,}/ },
  { label: 'At least 1 uppercase letter (A–Z)',        re: /[A-Z]/ },
  { label: 'At least 1 lowercase letter (a–z)',        re: /[a-z]/ },
  { label: 'At least 1 number (0–9)',                  re: /[0-9]/ },
  { label: 'At least 1 special character (!@#$%^&*)', re: /[!@#$%^&*]/ },
];

function checkRequirements(pwd: string) {
  return PASSWORD_REQUIREMENTS.map((r) => ({ ...r, met: r.re.test(pwd) }));
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onSwitchToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot-password modal state
  const [showForgotPwd, setShowForgotPwd] = useState(false);
  const [fpEmail, setFpEmail] = useState('');
  const [fpStep, setFpStep] = useState<'email' | 'sent'>('email');
  const [fpLoading, setFpLoading] = useState(false);
  const [fpError, setFpError] = useState<string | null>(null);

  // New-password fields (step 2 of reset, shown after "sent")
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpConfirmPassword, setFpConfirmPassword] = useState('');
  const reqs = checkRequirements(fpNewPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const claims = await authAPI.login(email, password);
      onLogin(claims);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot-password submit ────────────────────────────────────────────────
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpError(null);
    setFpLoading(true);
    try {
      // In a real integration this would call authAPI.requestPasswordReset(fpEmail)
      // We simulate the network call with a short delay
      await new Promise((r) => setTimeout(r, 800));
      setFpStep('sent');
    } catch (err: any) {
      setFpError(err?.message ?? 'Failed to send reset link. Please try again.');
    } finally {
      setFpLoading(false);
    }
  };

  const closeForgotPwd = () => {
    setShowForgotPwd(false);
    setFpStep('email');
    setFpEmail('');
    setFpNewPassword('');
    setFpConfirmPassword('');
    setFpError(null);
  };

  const allRequirementsMet = reqs.every((r) => r.met);
  const passwordsMatch = fpNewPassword === fpConfirmPassword && fpNewPassword.length > 0;

  return (
    <>
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo">
            <h1>Ableka Lumina</h1>
            <p>AI-Driven Regulatory Technology Platform</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <h2>Sign In</h2>

            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                disabled={loading}
              />
              <div className="forgot-pwd-row">
                <button
                  type="button"
                  className="forgot-pwd-link"
                  onClick={() => setShowForgotPwd(true)}
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            <button type="submit" className="login-btn" disabled={loading || !email || !password}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="login-hint">
            <p>Demo credentials: <code>analyst@ableka.io</code> / any password</p>
            <p className="login-hint-b2b">
              B2B partners use API Keys or OAuth2 Client Credentials (see API Keys page after login).
            </p>
            {onSwitchToRegister && (
              <p className="login-register-link">
                New to Ableka Lumina?{' '}
                <button
                  type="button"
                  className="login-link-btn"
                  onClick={onSwitchToRegister}
                >
                  Create an account
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Forgot Password Modal ──────────────────────────────────────────── */}
      {showForgotPwd && (
        <div
          className="fp-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fp-modal-title"
          onClick={(e) => { if (e.target === e.currentTarget) closeForgotPwd() }}
        >
          <div className="fp-modal">
            <button className="fp-close" onClick={closeForgotPwd} aria-label="Close">×</button>

            {fpStep === 'email' && (
              <>
                <h2 id="fp-modal-title">Reset Your Password</h2>
                <p className="fp-desc">
                  Enter your email address and we'll send you a reset link valid for 1 hour.
                </p>

                {fpError && (
                  <div className="login-error" role="alert">{fpError}</div>
                )}

                <form onSubmit={handleForgotPasswordSubmit} noValidate>
                  <div className="form-group">
                    <label htmlFor="fp-email">Email Address</label>
                    <input
                      id="fp-email"
                      type="email"
                      value={fpEmail}
                      onChange={(e) => setFpEmail(e.target.value)}
                      placeholder="your.email@company.com"
                      required
                      autoComplete="email"
                      disabled={fpLoading}
                    />
                  </div>

                  {/* Show password requirements so the user knows what to expect */}
                  <div className="fp-requirements">
                    <p className="fp-req-title">New password must meet:</p>
                    <ul className="fp-req-list">
                      {PASSWORD_REQUIREMENTS.map((r) => (
                        <li key={r.label} className="fp-req-item">
                          <span className="fp-req-icon fp-req-neutral">○</span>
                          {r.label}
                        </li>
                      ))}
                      <li className="fp-req-item">
                        <span className="fp-req-icon fp-req-neutral">○</span>
                        Cannot be same as previous 5 passwords
                      </li>
                    </ul>
                  </div>

                  <button
                    type="submit"
                    className="login-btn"
                    disabled={fpLoading || !fpEmail}
                  >
                    {fpLoading ? 'Sending…' : 'Send Reset Link'}
                  </button>
                </form>
              </>
            )}

            {fpStep === 'sent' && (
              <>
                <div className="fp-success-icon">📧</div>
                <h2 id="fp-modal-title">Check Your Email</h2>
                <p className="fp-desc">
                  A password reset link has been sent to <strong>{fpEmail}</strong>.
                  The link is valid for <strong>1 hour</strong>.
                </p>
                <p className="fp-desc">
                  Subject: <em>Ableka Lumina — Password Reset</em>
                </p>

                {/* Simulate "Enter new password" inline for demo purposes */}
                <div className="fp-new-pwd-section">
                  <p className="fp-req-title">Enter your new password:</p>
                  <div className="form-group">
                    <label htmlFor="fp-new-pwd">New Password</label>
                    <input
                      id="fp-new-pwd"
                      type="password"
                      value={fpNewPassword}
                      onChange={(e) => setFpNewPassword(e.target.value)}
                      placeholder="••••••••••••"
                      autoComplete="new-password"
                    />
                  </div>

                  {/* Live requirement check */}
                  {fpNewPassword.length > 0 && (
                    <ul className="fp-req-list fp-req-live">
                      {reqs.map((r) => (
                        <li key={r.label} className={`fp-req-item ${r.met ? 'fp-req-met' : 'fp-req-unmet'}`}>
                          <span className="fp-req-icon">{r.met ? '✅' : '❌'}</span>
                          {r.label}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="form-group">
                    <label htmlFor="fp-confirm-pwd">Confirm New Password</label>
                    <input
                      id="fp-confirm-pwd"
                      type="password"
                      value={fpConfirmPassword}
                      onChange={(e) => setFpConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      autoComplete="new-password"
                    />
                    {fpConfirmPassword.length > 0 && (
                      <span className={`fp-match-msg ${passwordsMatch ? 'fp-match-ok' : 'fp-match-err'}`}>
                        {passwordsMatch ? '✅ Passwords match' : '❌ Passwords do not match'}
                      </span>
                    )}
                  </div>

                  <button
                    className="login-btn"
                    disabled={!allRequirementsMet || !passwordsMatch}
                    onClick={closeForgotPwd}
                  >
                    Reset Password
                  </button>
                </div>

                <button
                  type="button"
                  className="fp-back-link"
                  onClick={() => setFpStep('email')}
                >
                  ← Re-send to a different email
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default LoginPage;
