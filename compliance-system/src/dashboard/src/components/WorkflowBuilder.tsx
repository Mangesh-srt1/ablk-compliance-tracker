/**
 * WorkflowBuilder Component
 * Main drag-and-drop workflow builder interface
 */

import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import useWorkflowStore from '../hooks/useWorkflowStore';
import { Workflow, WorkflowBlock, BlockType, ConditionBlock, ActionBlock, LogicBlock } from '../types/workflow.types';
import { workflowAPI } from '../services/workflowAPI';
import RuleBlock from './RuleBlock';
import ConditionEditor from './ConditionEditor';
import ActionEditor from './ActionEditor';
import WorkflowPreview from './WorkflowPreview';
import '../styles/WorkflowBuilder.css';

interface WorkflowBuilderProps {
  workflowId?: string;
  onSave?: (workflow: Workflow) => void;
}

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ workflowId, onSave }) => {
  const [state, actions] = useWorkflowStore();
  const [showConditionEditor, setShowConditionEditor] = useState(false);
  const [showActionEditor, setShowActionEditor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [draggedItem, setDraggedItem] = useState<any>(null);

  // Load workflow if ID provided
  useEffect(() => {
    if (workflowId) {
      workflowAPI
        .getWorkflow(workflowId)
        .then((workflow) => {
          actions.setWorkflow(workflow);
        })
        .catch((err) => {
          actions.setError(err.message);
        });
    } else {
      // Initialize new workflow
      actions.setWorkflow({
        name: 'New Workflow',
        description: '',
        blocks: [],
      });
    }
  }, [workflowId]);

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };

  const handleCanvasDragLeave = () => {
    // Find canvas and remove drag-over class
    const canvas = document.querySelector('.workflow-canvas');
    if (canvas) canvas.classList.remove('drag-over');
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const canvas = e.currentTarget;
    canvas.classList.remove('drag-over');

    if (!state.workflow) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // If dropping from toolbar or existing block
    if (draggedItem) {
      if (typeof draggedItem === 'string') {
        // Block type from toolbar
        const newBlock: WorkflowBlock = {
          id: uuidv4(),
          type: draggedItem as BlockType,
          x,
          y,
          width: 200,
          height: 100,
          connections: [],
          data:
            draggedItem === 'condition'
              ? ({
                  type: 'condition',
                  conditionType: 'aml_score',
                  operator: 'gte',
                  value: 70,
                } as ConditionBlock)
              : draggedItem === 'action'
              ? ({
                  type: 'action',
                  actionType: 'approve',
                  params: {},
                } as ActionBlock)
              : ({
                  type: 'logic',
                  operator: 'AND',
                } as LogicBlock),
        };
        actions.addBlock(newBlock);
      } else {
        // Existing block being repositioned
        const blockId = draggedItem;
        actions.updateBlock(blockId, { x, y });
      }
      setDraggedItem(null);
    }
  };

  const handleBlockDragStart = (blockId: string, e: React.DragEvent) => {
    setDraggedItem(blockId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleToolbarDragStart = (blockType: BlockType, e: React.DragEvent) => {
    setDraggedItem(blockType);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleSaveWorkflow = async () => {
    if (!state.workflow) return;

    actions.setSaving(true);
    try {
      let saved: Workflow;
      if (state.workflow.id) {
        saved = await workflowAPI.updateWorkflow(state.workflow.id, state.workflow);
      } else {
        saved = await workflowAPI.createWorkflow(state.workflow);
      }

      actions.setWorkflow(saved);
      actions.resetDirty();
      if (onSave) onSave(saved);
    } catch (err: any) {
      actions.setError(err.message);
    } finally {
      actions.setSaving(false);
    }
  };

  const handlePublishWorkflow = async () => {
    if (!state.workflow || !state.workflow.id) return;

    actions.setSaving(true);
    try {
      const published = await workflowAPI.publishWorkflow(state.workflow.id);
      actions.setWorkflow(published);
      actions.setError(null);
    } catch (err: any) {
      actions.setError(err.message);
    } finally {
      actions.setSaving(false);
    }
  };

  if (!state.workflow) {
    return <div className="workflow-builder">Loading...</div>;
  }

  const selectedBlock = state.workflow.blocks.find((b) => b.id === state.selectedBlockId);

  return (
    <div className="workflow-builder">
      <div className="builder-header">
        <div className="header-left">
          <h2>{state.workflow.name}</h2>
          <input
            type="text"
            value={state.workflow.description}
            onChange={(e) => actions.updateWorkflow({ description: e.target.value })}
            placeholder="Workflow description..."
            className="description-input"
          />
        </div>

        <div className="header-actions">
          {state.isDirty && <span className="unsaved-indicator">●</span>}
          <button
            className="btn-save"
            onClick={handleSaveWorkflow}
            disabled={state.isSaving || !state.isDirty}
          >
            {state.isSaving ? 'Saving...' : 'Save Draft'}
          </button>
          {state.workflow.id && !state.workflow.published && (
            <button className="btn-publish" onClick={handlePublishWorkflow} disabled={state.isSaving}>
              Publish
            </button>
          )}
          {state.workflow.id && (
            <button className="btn-preview" onClick={() => setShowPreview(true)}>
              Preview
            </button>
          )}
        </div>
      </div>

      {state.error && (
        <div className="error-banner">
          {state.error}
          <button onClick={() => actions.setError(null)}>×</button>
        </div>
      )}

      <div className="builder-container">
        {/* Toolbar */}
        <div className="toolbar">
          <div className="toolbar-section">
            <h4>Blocks</h4>
            <div
              className="toolbar-item condition-item"
              draggable
              onDragStart={(e) => handleToolbarDragStart('condition', e)}
              title="Drag condition block to canvas"
            >
              <span>◆</span> Condition
            </div>
            <div
              className="toolbar-item action-item"
              draggable
              onDragStart={(e) => handleToolbarDragStart('action', e)}
              title="Drag action block to canvas"
            >
              <span>▶</span> Action
            </div>
            <div
              className="toolbar-item logic-item"
              draggable
              onDragStart={(e) => handleToolbarDragStart('logic', e)}
              title="Drag logic block to canvas"
            >
              <span>⊕</span> Logic
            </div>
          </div>

          <div className="toolbar-section">
            <h4>Info</h4>
            <div className="info-box">
              <p>
                <strong>Blocks:</strong> {state.workflow.blocks.length}
              </p>
              <p>
                <strong>Status:</strong> {state.workflow.published ? 'Published' : 'Draft'}
              </p>
              {state.workflow.version && (
                <p>
                  <strong>Version:</strong> {state.workflow.version}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="builder-main">
          <div
            className="workflow-canvas"
            onDragOver={handleCanvasDragOver}
            onDragLeave={handleCanvasDragLeave}
            onDrop={handleCanvasDrop}
            style={{
              width: `${state.canvas.width}px`,
              height: `${state.canvas.height}px`,
            }}
          >
            {state.workflow.blocks.length === 0 && (
              <div className="canvas-empty">
                <p>Drag blocks from the toolbar to create your workflow</p>
              </div>
            )}

            {state.workflow.blocks.map((block) => (
              <RuleBlock
                key={block.id}
                block={block}
                isSelected={block.id === state.selectedBlockId}
                onSelect={(blockId) => {
                  actions.selectBlock(blockId);
                  if (block.data.type === 'condition') setShowConditionEditor(true);
                  if (block.data.type === 'action') setShowActionEditor(true);
                }}
                onDelete={(blockId) => actions.deleteBlock(blockId)}
                onDragStart={handleBlockDragStart}
                onConnect={(_fromId) => {
                  // Will implement connection UI later
                }}
              />
            ))}
          </div>
        </div>

        {/* Properties Panel */}
        <div className="properties-panel">
          {selectedBlock ? (
            <div>
              <h4>Block Properties</h4>
              <div className="property-item">
                <label>Block Type</label>
                <span className="property-value">{selectedBlock.type}</span>
              </div>

              <div className="property-item">
                <label>Block ID</label>
                <span className="property-value">{selectedBlock.id.substring(0, 8)}...</span>
              </div>

              {selectedBlock.data.type === 'condition' && (
                <>
                  <div className="property-item">
                    <label>Condition Type</label>
                    <span className="property-value">{(selectedBlock.data as ConditionBlock).conditionType}</span>
                  </div>
                  {(selectedBlock.data as ConditionBlock).label && (
                    <div className="property-item">
                      <label>Label</label>
                      <span className="property-value">{(selectedBlock.data as ConditionBlock).label}</span>
                    </div>
                  )}
                </>
              )}

              {selectedBlock.data.type === 'action' && (
                <>
                  <div className="property-item">
                    <label>Action Type</label>
                    <span className="property-value">{(selectedBlock.data as ActionBlock).actionType}</span>
                  </div>
                  {(selectedBlock.data as ActionBlock).label && (
                    <div className="property-item">
                      <label>Label</label>
                      <span className="property-value">{(selectedBlock.data as ActionBlock).label}</span>
                    </div>
                  )}
                </>
              )}

              <button
                className="btn-edit"
                onClick={() => {
                  if (selectedBlock.data.type === 'condition') setShowConditionEditor(true);
                  if (selectedBlock.data.type === 'action') setShowActionEditor(true);
                }}
              >
                Edit Block
              </button>

              <button
                className="btn-delete"
                onClick={() => actions.deleteBlock(selectedBlock.id)}
              >
                Delete Block
              </button>
            </div>
          ) : (
            <div>
              <p>Select a block to edit properties</p>
            </div>
          )}
        </div>
      </div>

      {/* Editors */}
      {showConditionEditor && selectedBlock?.data.type === 'condition' && (
        <ConditionEditor
          block={selectedBlock}
          onUpdate={(block) => actions.updateBlock(block.id, block)}
          onClose={() => setShowConditionEditor(false)}
        />
      )}

      {showActionEditor && selectedBlock?.data.type === 'action' && (
        <ActionEditor
          block={selectedBlock}
          onUpdate={(block) => actions.updateBlock(block.id, block)}
          onClose={() => setShowActionEditor(false)}
        />
      )}

      {showPreview && (
        <WorkflowPreview workflow={state.workflow} onClose={() => setShowPreview(false)} />
      )}
    </div>
  );
};

export default WorkflowBuilder;
