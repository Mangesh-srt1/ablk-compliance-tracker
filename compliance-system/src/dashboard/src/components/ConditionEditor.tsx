/**
 * ConditionEditor Component
 * Editor for creating and modifying condition blocks
 */

import React, { useState, useMemo } from 'react';
import { WorkflowBlock, ConditionBlock, ConditionType } from '../types/workflow.types';
import '../styles/ConditionEditor.css';

interface ConditionEditorProps {
  block: WorkflowBlock | null;
  onUpdate: (block: WorkflowBlock) => void;
  onClose: () => void;
}

const CONDITION_TYPES: Record<ConditionType, string> = {
  aml_score: 'AML Risk Score',
  kyc_status: 'KYC Verification Status',
  sanctions_match: 'Sanctions List Match',
  transaction_amount: 'Transaction Amount',
  custom: 'Custom Condition',
};

const OPERATORS = ['eq', 'lt', 'gt', 'lte', 'gte', 'contains', 'matches'];

const ConditionEditor: React.FC<ConditionEditorProps> = ({ block, onUpdate, onClose }) => {
  const [conditionType, setConditionType] = useState<ConditionType>(
    (block?.data as ConditionBlock)?.conditionType || 'aml_score'
  );
  const [operator, setOperator] = useState(
    (block?.data as ConditionBlock)?.operator || 'gte'
  );
  const [value, setValue] = useState(
    (block?.data as ConditionBlock)?.value?.toString() || ''
  );
  const [label, setLabel] = useState(
    (block?.data as ConditionBlock)?.label || ''
  );
  const [description, setDescription] = useState(
    (block?.data as ConditionBlock)?.description || ''
  );

  const getValueType = useMemo(() => {
    switch (conditionType) {
      case 'aml_score':
      case 'transaction_amount':
        return 'number';
      case 'kyc_status':
        return 'select';
      case 'sanctions_match':
        return 'boolean';
      default:
        return 'text';
    }
  }, [conditionType]);

  const getValueOptions = useMemo(() => {
    switch (conditionType) {
      case 'kyc_status':
        return ['PENDING', 'VERIFIED', 'REJECTED', 'ESCALATED'];
      case 'sanctions_match':
        return ['true', 'false'];
      default:
        return [];
    }
  }, [conditionType]);

  const handleSave = () => {
    if (!block) return;

    const updatedBlock: WorkflowBlock = {
      ...block,
      data: {
        type: 'condition',
        conditionType,
        operator,
        value: getValueType === 'number' ? parseFloat(value) : getValueType === 'boolean' ? value === 'true' : value,
        label: label || CONDITION_TYPES[conditionType],
        description,
      } as ConditionBlock,
    };

    onUpdate(updatedBlock);
    onClose();
  };

  if (!block || block.data.type !== 'condition') {
    return (
      <div className="condition-editor">
        <p>No condition block selected</p>
        <button onClick={onClose}>Close</button>
      </div>
    );
  }

  return (
    <div className="condition-editor">
      <h3>Edit Condition Block</h3>

      <div className="editor-section">
        <label>Condition Type</label>
        <select value={conditionType} onChange={(e) => setConditionType(e.target.value as ConditionType)}>
          {Object.entries(CONDITION_TYPES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="editor-section">
        <label>Operator</label>
        <select value={operator} onChange={(e) => setOperator(e.target.value as any)}>
          {OPERATORS.map((op) => (
            <option key={op} value={op}>
              {op.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      <div className="editor-section">
        <label>Value</label>
        {getValueType === 'number' && (
          <input type="number" value={value} onChange={(e) => setValue(e.target.value)} />
        )}
        {getValueType === 'select' && (
          <select value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="">-- Select --</option>
            {getValueOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        )}
        {getValueType === 'text' && (
          <input type="text" value={value} onChange={(e) => setValue(e.target.value)} />
        )}
      </div>

      <div className="editor-section">
        <label>Label (optional)</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g., High Risk AML Score"
        />
      </div>

      <div className="editor-section">
        <label>Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what this condition checks for"
          rows={3}
        />
      </div>

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

export default ConditionEditor;
