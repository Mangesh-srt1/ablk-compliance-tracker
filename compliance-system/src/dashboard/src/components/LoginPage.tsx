/**
 * LoginPage Component
 * Email + password form → calls POST /api/auth/login → stores JWT in localStorage
 */

import React, { useState } from 'react';
import { authAPI, TokenClaims } from '../services/authAPI';
import '../styles/LoginPage.css';

interface LoginPageProps {
  onLogin: (claims: TokenClaims) => void;
  onSwitchToRegister?: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onSwitchToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
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
  );
};

export default LoginPage;
