/**
 * Workflow Type Definitions
 *
 * This file contains the type definitions for the workflow system.
 * It defines interfaces for workflow nodes, connections, and related types.
 */

// Workflow node definition
export interface WorkflowNode {
  id: string;
  type: string;
  config: Record<string, any>;
  name?: string;
}

// Connection between nodes
export interface Connection {
  from: string;
  to: string;
  fromOutput?: string; // default: 'default'
  toInput?: string; // default: 'default'
}

// Workflow definition
export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  connections: Connection[];
}

// Workflow validation result
export interface WorkflowValidationResult {
  valid: boolean;
  errors: string[];
}

// Workflow execution status
export type WorkflowStatus = "pending" | "running" | "completed" | "failed";

// Workflow execution result
export interface WorkflowResult {
  status: WorkflowStatus;
  result?: any;
  error?: Error;
}

// Workflow compile options
export interface WorkflowCompileOptions {
  executionId?: string;
  branchId?: string;
  [key: string]: any; // Allow additional properties for extensibility
}

// Executable workflow (result of compilation)
export interface ExecutableWorkflow {
  original: Workflow;
  operatorChain: any; // RxJS operator chain
  nodeOrder: string[];
  executionId?: string;
  branchId?: string;
  [key: string]: any; // Allow additional properties for extensibility
}

// Workflow execution state
export interface WorkflowExecutionState {
  id: string;
  workflowId: string;
  status: WorkflowStatus;
  startTime: Date;
  endTime?: Date;
  progress: number;
  result?: any;
  error?: Error;
}
