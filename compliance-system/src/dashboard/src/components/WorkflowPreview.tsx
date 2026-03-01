/**
 * WorkflowPreview Component
 * Test and preview workflow execution without deploying
 */

import React, { useState } from 'react';
import { Workflow, ExecutionContext, WorkflowTestResult, TestStep } from '../types/workflow.types';
import { workflowAPI } from '../services/workflowAPI';
import '../styles/WorkflowPreview.css';

interface WorkflowPreviewProps {
  workflow: Workflow | null;
  onClose: () => void;
}

const WorkflowPreview: React.FC<WorkflowPreviewProps> = ({ workflow, onClose }) => {
  const [testContext, setTestContext] = useState<Partial<ExecutionContext>>({
    entity: {
      id: 'test-entity-001',
      name: 'Test Entity',
      aml_score: 50,
      kyc_status: 'VERIFIED',
      sanctions_match: false,
    },
    transaction: {
      amount: 25000,
      currency: 'USD',
      source: 'US',
      destination: 'AE',
      timestamp: new Date(),
    },
  });

  const [testResult, setTestResult] = useState<WorkflowTestResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTestRun = async () => {
    if (!workflow || !workflow.id) {
      setError('Workflow not saved yet');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await workflowAPI.testWorkflow(workflow.id, testContext as ExecutionContext);
      setTestResult(result);
    } catch (err: any) {
      setError(err.message || 'Failed to test workflow');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContextUpdate = (path: string, value: any) => {
    const keys = path.split('.');
    const newContext = JSON.parse(JSON.stringify(testContext));

    let current = newContext;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;

    setTestContext(newContext);
  };

  if (!workflow) {
    return (
      <div className="workflow-preview">
        <p>No workflow to preview</p>
        <button onClick={onClose}>Close</button>
      </div>
    );
  }

  return (
    <div className="workflow-preview">
      <div className="preview-header">
        <h3>Preview: {workflow.name}</h3>
        <button className="close-btn" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="preview-content">
        <div className="test-inputs">
          <h4>Test Scenario</h4>

          <div className="input-group">
            <label>Entity ID</label>
            <input
              type="text"
              value={testContext.entity?.id || ''}
              onChange={(e) => handleContextUpdate('entity.id', e.target.value)}
            />
          </div>

          <div className="input-group">
            <label>Entity Name</label>
            <input
              type="text"
              value={testContext.entity?.name || ''}
              onChange={(e) => handleContextUpdate('entity.name', e.target.value)}
            />
          </div>

          <div className="input-group">
            <label>AML Risk Score (0-100)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={testContext.entity?.aml_score || 0}
              onChange={(e) => handleContextUpdate('entity.aml_score', parseInt(e.target.value))}
            />
          </div>

          <div className="input-group">
            <label>KYC Status</label>
            <select
              value={testContext.entity?.kyc_status || 'VERIFIED'}
              onChange={(e) => handleContextUpdate('entity.kyc_status', e.target.value)}
            >
              <option value="PENDING">PENDING</option>
              <option value="VERIFIED">VERIFIED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="ESCALATED">ESCALATED</option>
            </select>
          </div>

          <div className="input-group">
            <label>Sanctions Match</label>
            <input
              type="checkbox"
              checked={testContext.entity?.sanctions_match || false}
              onChange={(e) => handleContextUpdate('entity.sanctions_match', e.target.checked)}
            />
          </div>

          <div className="input-group">
            <label>Transaction Amount</label>
            <input
              type="number"
              value={testContext.transaction?.amount || 0}
              onChange={(e) => handleContextUpdate('transaction.amount', parseFloat(e.target.value))}
            />
          </div>

          <div className="input-group">
            <label>Currency</label>
            <input
              type="text"
              value={testContext.transaction?.currency || 'USD'}
              onChange={(e) => handleContextUpdate('transaction.currency', e.target.value)}
              maxLength={3}
            />
          </div>

          <button className="btn-test" onClick={handleTestRun} disabled={isLoading}>
            {isLoading ? 'Running Test...' : 'Run Test'}
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {testResult && (
          <div className="test-results">
            <h4>Execution Results</h4>

            <div className="result-summary">
              <div className={`result-status ${testResult.success ? 'success' : 'failure'}`}>
                {testResult.success ? '✓ SUCCESS' : '✗ FAILED'}
              </div>
              <div className="result-time">Execution time: {testResult.executionTime}ms</div>
            </div>

            {testResult.finalAction && (
              <div className="final-action">
                <h5>Final Decision</h5>
                <div className="action-badge">
                  <span className="action-type">{testResult.finalAction}</span>
                </div>
                {testResult.finalParams && (
                  <pre className="action-params">{JSON.stringify(testResult.finalParams, null, 2)}</pre>
                )}
              </div>
            )}

            <div className="execution-steps">
              <h5>Execution Steps</h5>
              {testResult.steps.length === 0 ? (
                <p>No steps executed</p>
              ) : (
                <div className="steps-list">
                  {testResult.steps.map((step: TestStep, idx: number) => (
                    <div key={idx} className={`step ${step.result ? 'passed' : 'failed'}`}>
                      <div className="step-header">
                        <span className="step-number">#{idx + 1}</span>
                        <span className="step-type">{step.blockType.toUpperCase()}</span>
                        {step.blockLabel && <span className="step-label">{step.blockLabel}</span>}
                        <span className={`step-result ${step.result ? 'passed' : 'failed'}`}>
                          {step.result ? '✓' : '✗'}
                        </span>
                      </div>
                      {step.error && (
                        <div className="step-error">
                          <strong>Error:</strong> {step.error}
                        </div>
                      )}
                      {typeof step.result === 'object' && (
                        <pre className="step-output">{JSON.stringify(step.result, null, 2)}</pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {testResult.errors && testResult.errors.length > 0 && (
              <div className="execution-errors">
                <h5>Errors During Execution</h5>
                <ul>
                  {testResult.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowPreview;
