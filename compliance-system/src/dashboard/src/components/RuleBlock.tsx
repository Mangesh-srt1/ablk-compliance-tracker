/**
 * RuleBlock Component
 * Draggable block component for workflow builder canvas
 */

import React, { useState } from 'react';
import { WorkflowBlock, BlockType, ConditionBlock, ActionBlock, LogicBlock } from '../types/workflow.types';
import '../styles/RuleBlock.css';

interface RuleBlockProps {
  block: WorkflowBlock;
  isSelected: boolean;
  onSelect: (blockId: string) => void;
  onDelete: (blockId: string) => void;
  onDragStart: (blockId: string, e: React.DragEvent) => void;
  onConnect: (fromId: string) => void;
}

const RuleBlock: React.FC<RuleBlockProps> = ({
  block,
  isSelected,
  onSelect,
  onDelete,
  onDragStart,
}) => {
  const [showConnector, setShowConnector] = useState(false);
    // Removed unused onConnect parameter

  const getBlockColor = (type: BlockType): string => {
    switch (type) {
      case 'condition':
        return '#E3F2FD';
      case 'action':
        return '#F3E5F5';
      case 'logic':
        return '#FFF3E0';
      default:
        return '#F5F5F5';
    }
  };

  const getBlockBorderColor = (type: BlockType): string => {
    switch (type) {
      case 'condition':
        return '#1976D2';
      case 'action':
        return '#7B1FA2';
      case 'logic':
        return '#F57C00';
      default:
        return '#9E9E9E';
    }
  };

  const getBlockLabel = (): string => {
    const data = block.data;
    if (data.type === 'condition') {
      return (data as ConditionBlock).label || (data as ConditionBlock).conditionType;
    } else if (data.type === 'action') {
      return (data as ActionBlock).label || (data as ActionBlock).actionType;
    } else if (data.type === 'logic') {
      return (data as LogicBlock).label || (data as LogicBlock).operator;
    }
    return 'Unknown Block';
  };

  return (
    <div
      className={`rule-block ${isSelected ? 'selected' : ''}`}
      style={{
        left: `${block.x}px`,
        top: `${block.y}px`,
        width: `${block.width}px`,
        backgroundColor: getBlockColor(block.type),
        borderColor: getBlockBorderColor(block.type),
      }}
      onClick={() => onSelect(block.id)}
      draggable
      onDragStart={(e) => onDragStart(block.id, e)}
    >
      <div className="block-header">
        <span className="block-type">{block.type.toUpperCase()}</span>
        <button
          className="delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(block.id);
          }}
          title="Delete block"
        >
          ×
        </button>
      </div>

      <div className="block-content">
        <p className="block-label">{getBlockLabel()}</p>
      </div>

      <div className="block-footer">
        <button
          className="connect-btn"
          onClick={(e) => {
            e.stopPropagation();
            setShowConnector(!showConnector);
          }}
          title="Connect to another block"
        >
          {showConnector ? '✓' : '→'}
        </button>
      </div>

      {/* Connection points */}
      <div className="connection-points">
        <div className="input-point" title="Input" />
        <div className="output-point" title="Output" />
      </div>

      {/* Connection feedback */}
      {showConnector && <div className="connecting-indicator">Connecting...</div>}
    </div>
  );
};

export default RuleBlock;
