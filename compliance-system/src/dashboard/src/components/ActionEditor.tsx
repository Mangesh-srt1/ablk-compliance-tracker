/**
 * ActionEditor Component
 * Editor for creating and modifying action blocks
 */

import React, { useState, useMemo } from 'react';
import { WorkflowBlock, ActionBlock, ActionType } from '../types/workflow.types';
import '../styles/ActionEditor.css';

interface ActionEditorProps {
  block: WorkflowBlock | null;
  onUpdate: (block: WorkflowBlock) => void;
  onClose: () => void;
}

const ACTION_TYPES: Record<ActionType, string> = {
  approve: 'Approve Entity',
  reject: 'Reject Entity',
  escalate: 'Escalate to Manual Review',
  send_alert: 'Send Alert Notification',
  update_risk_score: 'Update Risk Score',
  webhook: 'Call Webhook',
};

const ActionEditor: React.FC<ActionEditorProps> = ({ block, onUpdate, onClose }) => {
  const [actionType, setActionType] = useState<ActionType>(
    (block?.data as ActionBlock)?.actionType || 'approve'
  );
  const [label, setLabel] = useState(
    (block?.data as ActionBlock)?.label || ''
  );
  const [description, setDescription] = useState(
    (block?.data as ActionBlock)?.description || ''
  );
  const [params, setParams] = useState(
    (block?.data as ActionBlock)?.params || {}
  );

  const getParamFields = useMemo(() => {
    switch (actionType) {
      case 'approve':
        return [
          { name: 'autoApprove', label: 'Auto-approve without review', type: 'checkbox' },
          { name: 'requireSignature', label: 'Require digital signature', type: 'checkbox' },
        ];
      case 'reject':
        return [
          { name: 'reason', label: 'Rejection reason', type: 'text' },
          { name: 'notifyEntity', label: 'Notify entity of rejection', type: 'checkbox' },
          { name: 'blockRetry', label: 'Block retry attempts', type: 'checkbox' },
        ];
      case 'escalate':
        return [
          { name: 'assignTo', label: 'Assign to officer', type: 'text' },
          { name: 'priority', label: 'Priority (low/medium/high)', type: 'select', options: ['low', 'medium', 'high'] },
          { name: 'deadline', label: 'Escalation deadline (hours)', type: 'number' },
        ];
      case 'send_alert':
        return [
          { name: 'channels', label: 'Alert channels (comma-separated)', type: 'text', placeholder: 'email, sms, slack' },
          { name: 'subject', label: 'Email subject', type: 'text' },
          { name: 'message', label: 'Alert message', type: 'textarea' },
        ];
      case 'update_risk_score':
        return [
          { name: 'scoreValue', label: 'New risk score (0-100)', type: 'number' },
          { name: 'reason', label: 'Reason for score update', type: 'text' },
        ];
      case 'webhook':
        return [
          { name: 'url', label: 'Webhook URL', type: 'text' },
          { name: 'method', label: 'HTTP method', type: 'select', options: ['POST', 'PUT', 'PATCH'] },
          { name: 'retryCount', label: 'Retry count on failure', type: 'number' },
        ];
      default:
        return [];
    }
  }, [actionType]);

  const handleParamChange = (fieldName: string, value: any) => {
    setParams({
      ...params,
      [fieldName]: value,
    });
  };

  const handleSave = () => {
    if (!block) return;

    const updatedBlock: WorkflowBlock = {
      ...block,
      data: {
        type: 'action',
        actionType,
        params,
        label: label || ACTION_TYPES[actionType],
        description,
      } as ActionBlock,
    };

    onUpdate(updatedBlock);
    onClose();
  };

  if (!block || block.data.type !== 'action') {
    return (
      <div className="action-editor">
        <p>No action block selected</p>
        <button onClick={onClose}>Close</button>
      </div>
    );
  }

  return (
    <div className="action-editor">
      <h3>Edit Action Block</h3>

      <div className="editor-section">
        <label>Action Type</label>
        <select value={actionType} onChange={(e) => setActionType(e.target.value as ActionType)}>
          {Object.entries(ACTION_TYPES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="editor-section">
        <label>Label (optional)</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={ACTION_TYPES[actionType]}
        />
      </div>

      <div className="editor-section">
        <label>Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what this action does"
          rows={2}
        />
      </div>

      {/* Dynamic parameters based on action type */}
      {getParamFields.length > 0 && (
        <div className="params-section">
          <h4>Parameters</h4>
          {getParamFields.map((field: any) => (
            <div key={field.name} className="editor-section">
              <label>{field.label}</label>
              {field.type === 'text' && (
                <input
                  type="text"
                  value={params[field.name] || ''}
                  onChange={(e) => handleParamChange(field.name, e.target.value)}
                  placeholder={field.placeholder || ''}
                />
              )}
              {field.type === 'textarea' && (
                <textarea
                  value={params[field.name] || ''}
                  onChange={(e) => handleParamChange(field.name, e.target.value)}
                  rows={3}
                />
              )}
              {field.type === 'number' && (
                <input
                  type="number"
                  value={params[field.name] || ''}
                  onChange={(e) => handleParamChange(field.name, e.target.value)}
                />
              )}
              {field.type === 'checkbox' && (
                <input
                  type="checkbox"
                  checked={params[field.name] || false}
                  onChange={(e) => handleParamChange(field.name, e.target.checked)}
                />
              )}
              {field.type === 'select' && (
                <select
                  value={params[field.name] || ''}
                  onChange={(e) => handleParamChange(field.name, e.target.value)}
                >
                  <option value="">-- Select --</option>
                  {(field.options || []).map((opt: string) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="editor-actions">
        <button className="btn-primary" onClick={handleSave}>
          Save
        </button>
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default ActionEditor;
