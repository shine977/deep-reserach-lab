/**
 * Stream Types
 * 
 * This file contains type definitions for the workflow stream.
 */

/**
 * Stream item representing data flowing through the workflow
 */
export interface StreamItem {
  executionId: string;
  nodeId: string;
  data: any;
  timestamp: number;
  metadata?: {
    step: number;
    tokenUsage: TokenUsage;
    [key: string]: any;
  };
}

/**
 * Token usage information
 */
export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

/**
 * Stream event emitted during workflow execution
 */
export interface StreamEvent {
  type: string;
  executionId: string;
  workflowId?: string;
  nodeId?: string;
  timestamp: number;
  data: any;
}

/**
 * Stream options for configuring the workflow stream
 */
export interface StreamOptions {
  executionId?: string;
  timeout?: number;
  maxTokens?: number;
  maxSteps?: number;
  concurrency?: number;
}

/**
 * Node context provided to node processors
 */
export interface NodeContext {
  executionId: string;
  nodeId: string;
  nodeType: string;
  step: number;
  logger: any;
  emitEvent: (type: string, data: any) => void;
}