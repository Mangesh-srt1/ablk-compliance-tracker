/**
 * Workflow Builder State Hook
 * Simple lightweight state management for workflow builder
 */

import { useState, useCallback } from 'react';
import { Workflow, WorkflowBlock, Canvas } from '../types/workflow.types';

interface WorkflowState {
  workflow: Workflow | null;
  selectedBlockId: string | null;
  canvas: Canvas;
  isDirty: boolean;
  isSaving: boolean;
  error: string | null;
}

interface WorkflowActions {
  setWorkflow: (workflow: Workflow) => void;
  updateWorkflow: (updates: Partial<Workflow>) => void;
  addBlock: (block: WorkflowBlock) => void;
  updateBlock: (blockId: string, updates: Partial<WorkflowBlock>) => void;
  deleteBlock: (blockId: string) => void;
  selectBlock: (blockId: string | null) => void;
  connectBlocks: (fromId: string, toId: string) => void;
  disconnectBlocks: (fromId: string, toId: string) => void;
  updateCanvas: (updates: Partial<Canvas>) => void;
  resetDirty: () => void;
  setError: (error: string | null) => void;
  setSaving: (saving: boolean) => void;
  clearWorkflow: () => void;
}

const initialState: WorkflowState = {
  workflow: null,
  selectedBlockId: null,
  canvas: {
    width: 1200,
    height: 800,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  },
  isDirty: false,
  isSaving: false,
  error: null,
};

export const useWorkflowStore = (): [WorkflowState, WorkflowActions] => {
  const [state, setState] = useState<WorkflowState>(initialState);

  const setWorkflow = useCallback((workflow: Workflow) => {
    setState((prev) => ({
      ...prev,
      workflow,
      isDirty: false,
    }));
  }, []);

  const updateWorkflow = useCallback((updates: Partial<Workflow>) => {
    setState((prev) => ({
      ...prev,
      workflow: prev.workflow ? { ...prev.workflow, ...updates } : null,
      isDirty: true,
    }));
  }, []);

  const addBlock = useCallback((block: WorkflowBlock) => {
    setState((prev) => ({
      ...prev,
      workflow: prev.workflow
        ? { ...prev.workflow, blocks: [...prev.workflow.blocks, block] }
        : null,
      isDirty: true,
    }));
  }, []);

  const updateBlock = useCallback((blockId: string, updates: Partial<WorkflowBlock>) => {
    setState((prev) => ({
      ...prev,
      workflow: prev.workflow
        ? {
            ...prev.workflow,
            blocks: prev.workflow.blocks.map((b) => (b.id === blockId ? { ...b, ...updates } : b)),
          }
        : null,
      isDirty: true,
    }));
  }, []);

  const deleteBlock = useCallback((blockId: string) => {
    setState((prev) => ({
      ...prev,
      workflow: prev.workflow
        ? {
            ...prev.workflow,
            blocks: prev.workflow.blocks.filter((b) => b.id !== blockId),
          }
        : null,
      selectedBlockId: prev.selectedBlockId === blockId ? null : prev.selectedBlockId,
      isDirty: true,
    }));
  }, []);

  const selectBlock = useCallback((blockId: string | null) => {
    setState((prev) => ({
      ...prev,
      selectedBlockId: blockId,
    }));
  }, []);

  const connectBlocks = useCallback((fromId: string, toId: string) => {
    setState((prev) => ({
      ...prev,
      workflow: prev.workflow
        ? {
            ...prev.workflow,
            blocks: prev.workflow.blocks.map((b) =>
              b.id === fromId && !b.connections.includes(toId)
                ? { ...b, connections: [...b.connections, toId] }
                : b
            ),
          }
        : null,
      isDirty: true,
    }));
  }, []);

  const disconnectBlocks = useCallback((fromId: string, toId: string) => {
    setState((prev) => ({
      ...prev,
      workflow: prev.workflow
        ? {
            ...prev.workflow,
            blocks: prev.workflow.blocks.map((b) =>
              b.id === fromId ? { ...b, connections: b.connections.filter((c) => c !== toId) } : b
            ),
          }
        : null,
      isDirty: true,
    }));
  }, []);

  const updateCanvas = useCallback((updates: Partial<Canvas>) => {
    setState((prev) => ({
      ...prev,
      canvas: { ...prev.canvas, ...updates },
    }));
  }, []);

  const resetDirty = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isDirty: false,
    }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({
      ...prev,
      error,
    }));
  }, []);

  const setSaving = useCallback((saving: boolean) => {
    setState((prev) => ({
      ...prev,
      isSaving: saving,
    }));
  }, []);

  const clearWorkflow = useCallback(() => {
    setState(initialState);
  }, []);

  const actions: WorkflowActions = {
    setWorkflow,
    updateWorkflow,
    addBlock,
    updateBlock,
    deleteBlock,
    selectBlock,
    connectBlocks,
    disconnectBlocks,
    updateCanvas,
    resetDirty,
    setError,
    setSaving,
    clearWorkflow,
  };

  return [state, actions];
};

export default useWorkflowStore;
