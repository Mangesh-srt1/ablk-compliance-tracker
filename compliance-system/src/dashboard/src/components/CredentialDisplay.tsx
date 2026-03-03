/**
 * CredentialDisplay Component
 * Shows a sensitive credential (API key, client secret, temp password) exactly once.
 *
 * UX contract:
 *  - Value starts hidden (password input)
 *  - User can toggle visibility
 *  - User can copy to clipboard with one click + success feedback
 *  - A "⚠️ save it now" banner is always visible
 *  - When user checks "I have saved it", the widget is acknowledged and onAcknowledged fires
 */

import React, { useState, useRef } from 'react';
import '../styles/CredentialDisplay.css';

/** Delay (ms) between checking the "I've saved it" box and calling onAcknowledged,
 *  giving the UI time to animate before the parent removes the widget. */
const ACKNOWLEDGEMENT_DELAY_MS = 600;

interface CredentialDisplayProps {
  /** Human-readable label, e.g. "API Key" or "Client Secret" */
  label: string;
  /** The plaintext credential value */
  value: string;
  /** Additional context shown below the input */
  description?: string;
  /** Called after the user acknowledges saving the credential */
  onAcknowledged?: () => void;
}

const CredentialDisplay: React.FC<CredentialDisplayProps> = ({
  label,
  value,
  description,
  onAcknowledged,
}) => {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: select text in input
      inputRef.current?.select();
    }
  };

  const handleAcknowledge = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAcknowledged(e.target.checked);
    if (e.target.checked && onAcknowledged) {
      setTimeout(onAcknowledged, ACKNOWLEDGEMENT_DELAY_MS);
    }
  };

  return (
    <div className={`cred-display${acknowledged ? ' cred-display--acknowledged' : ''}`}>
      {/* Warning banner */}
      {!acknowledged && (
        <div className="cred-warning">
          <span className="cred-warning-icon">⚠️</span>
          <span>
            <strong>Save this {label} now.</strong> It will <em>not</em> be shown again after
            you leave this page.
          </span>
        </div>
      )}

      {acknowledged && (
        <div className="cred-saved">
          <span>✅ {label} saved securely.</span>
        </div>
      )}

      <div className="cred-label">{label}</div>

      {/* Value input + controls */}
      <div className="cred-field">
        <input
          ref={inputRef}
          className="cred-input"
          type={visible ? 'text' : 'password'}
          value={acknowledged ? '•'.repeat(Math.min(value.length, 32)) : value}
          readOnly
          disabled={acknowledged}
          spellCheck={false}
          autoComplete="off"
        />

        {!acknowledged && (
          <>
            <button
              type="button"
              className="cred-btn cred-btn--icon"
              onClick={() => setVisible((v) => !v)}
              title={visible ? 'Hide' : 'Show'}
              aria-label={visible ? 'Hide credential' : 'Show credential'}
            >
              {visible ? '🙈' : '👁️'}
            </button>

            <button
              type="button"
              className={`cred-btn cred-btn--copy${copied ? ' cred-btn--copied' : ''}`}
              onClick={handleCopy}
              title="Copy to clipboard"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </>
        )}
      </div>

      {description && <p className="cred-description">{description}</p>}

      {/* Acknowledgement checkbox */}
      {!acknowledged && (
        <label className="cred-ack">
          <input type="checkbox" checked={acknowledged} onChange={handleAcknowledge} />
          <span>I have saved this {label} in a secure location</span>
        </label>
      )}
    </div>
  );
};

export default CredentialDisplay;
