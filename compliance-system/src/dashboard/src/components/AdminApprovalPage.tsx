/**
 * AdminApprovalPage Component
 * Allows platform admins (role = 'admin') to view, approve, or reject
 * self-registered user accounts that are awaiting admin approval.
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import '../styles/AdminApprovalPage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface PendingUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  tenant_id: string | null;
  approval_status: string;
  is_email_verified: boolean;
  created_at: string;
}

interface RejectState {
  userId: string;
  email: string;
  reason: string;
}

function getAuthHeader(): { Authorization: string } | Record<string, never> {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const AdminApprovalPage: React.FC = () => {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  // Inline rejection form state (replaces window.prompt for accessibility)
  const [rejectTarget, setRejectTarget] = useState<RejectState | null>(null);

  const fetchPendingUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/auth/admin/pending-users`, {
        headers: getAuthHeader(),
      });
      setUsers(res.data.data.users);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to load pending users.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingUsers();
  }, [fetchPendingUsers]);

  const handleApprove = async (userId: string, email: string) => {
    setActionInProgress(userId);
    setError(null);
    setSuccessMsg(null);
    try {
      await axios.post(
        `${API_BASE_URL}/api/auth/admin/approve/${userId}`,
        {},
        { headers: getAuthHeader() }
      );
      setSuccessMsg(`✅ ${email} has been approved and can now log in.`);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Approval failed.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectTarget) return;
    const { userId, email, reason } = rejectTarget;
    setActionInProgress(userId);
    setError(null);
    setSuccessMsg(null);
    try {
      await axios.post(
        `${API_BASE_URL}/api/auth/admin/reject/${userId}`,
        { reason },
        { headers: getAuthHeader() }
      );
      setSuccessMsg(`❌ ${email}'s registration has been rejected.`);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setRejectTarget(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Rejection failed.');
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <section className="dashboard-section">
      <h2>Pending User Registrations</h2>
      <p className="section-desc">
        Review and approve or reject users who have completed email verification
        and are awaiting platform admin approval.
      </p>

      {successMsg && (
        <div className="approval-success" role="status">
          {successMsg}
          <button className="approval-dismiss" onClick={() => setSuccessMsg(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="approval-error" role="alert">
          {error}
          <button className="approval-dismiss" onClick={() => setError(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      {/* Inline rejection form – accessible alternative to window.prompt() */}
      {rejectTarget && (
        <div className="approval-reject-form" role="dialog" aria-label="Reject user registration">
          <p>
            Reject registration for <strong>{rejectTarget.email}</strong>?
          </p>
          <label htmlFor="reject-reason" className="approval-reject-label">
            Reason <span className="approval-optional">(optional)</span>
          </label>
          <textarea
            id="reject-reason"
            className="approval-reject-textarea"
            value={rejectTarget.reason}
            onChange={(e) => setRejectTarget({ ...rejectTarget, reason: e.target.value })}
            rows={3}
            placeholder="e.g. Incomplete information, duplicate account…"
            maxLength={500}
          />
          <div className="approval-reject-actions">
            <button
              className="approval-btn approval-btn--reject"
              onClick={handleRejectSubmit}
              disabled={!!actionInProgress}
            >
              {actionInProgress ? '…' : 'Confirm Rejection'}
            </button>
            <button
              className="approval-btn"
              onClick={() => setRejectTarget(null)}
              disabled={!!actionInProgress}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="approval-toolbar">
        <button className="approval-refresh-btn" onClick={fetchPendingUsers} disabled={loading}>
          {loading ? 'Loading…' : '🔄 Refresh'}
        </button>
      </div>

      {!loading && users.length === 0 && !error && (
        <p className="approval-empty">No pending registrations at this time.</p>
      )}

      {users.length > 0 && (
        <table className="approval-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Full Name</th>
              <th>Role</th>
              <th>Tenant</th>
              <th>Registered</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>{user.full_name}</td>
                <td>
                  <span className="approval-role-badge">{user.role}</span>
                </td>
                <td>{user.tenant_id ?? '—'}</td>
                <td>{new Date(user.created_at).toLocaleDateString()}</td>
                <td className="approval-actions">
                  <button
                    className="approval-btn approval-btn--approve"
                    onClick={() => handleApprove(user.id, user.email)}
                    disabled={!!actionInProgress || !!rejectTarget}
                  >
                    {actionInProgress === user.id ? '…' : '✓ Approve'}
                  </button>
                  <button
                    className="approval-btn approval-btn--reject"
                    onClick={() =>
                      setRejectTarget({ userId: user.id, email: user.email, reason: '' })
                    }
                    disabled={!!actionInProgress || !!rejectTarget}
                  >
                    ✗ Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};

export default AdminApprovalPage;
