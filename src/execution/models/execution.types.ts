/**
 * Execution Types
 * 
 * This file defines the core types and interfaces for the execution module,
 * which manages workflow execution instances and their lifecycle.
 */

import { Workflow, WorkflowResult } from '../../core/types/workflow.types';

/**
 * Execution status enum
 */
export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELED = 'canceled',
  PAUSED = 'paused'
}

/**
 * Execution type enum
 */
export enum ExecutionType {
  MANUAL = 'manual',
  SCHEDULED = 'scheduled',
  TRIGGERED = 'triggered',
  SYSTEM = 'system'
}

/**
 * Branch status enum
 */
export enum BranchStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELED = 'canceled',
  PAUSED = 'paused'
}

/**
 * Branch event type enum
 */
export enum BranchEventType {
  BRANCH_STARTED = 'branch:start',
  BRANCH_COMPLETED = 'branch:complete',
  BRANCH_FAILED = 'branch:failed',
  BRANCH_CANCELED = 'branch:canceled',
  BRANCH_PAUSED = 'branch:paused',
  BRANCH_RESUMED = 'branch:resumed'
}

/**
 * Execution record interface
 * Represents a workflow execution instance
 */
export interface ExecutionRecord {
  // Core identification
  id: string;
  workflowId: string;
  workflowVersion?: string;
  
  // Status and timing
  status: ExecutionStatus;
  type: ExecutionType;
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  
  // Input/Output
  input: any;
  result?: any;
  error?: Error | string;
  
  // Resource usage
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
  
  // Execution metadata
  userId?: string;
  tags?: string[];
  priority?: number;
  metadata?: Record<string, any>;
  
  // Branch information
  branches?: ExecutionBranch[];
}

/**
 * Execution branch interface
 * Represents a single branch within a workflow execution
 */
export interface ExecutionBranch {
  // Core identification
  id: string;
  executionId: string;
  parentBranchId?: string;
  name: string;
  description?: string;
  
  // Status and timing
  status: BranchStatus;
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  
  // Branch content
  nodeIds: string[];
  currentNodeId?: string;
  completedNodeIds: string[];
  
  // Branch data
  input?: any;
  intermediateResults?: any[];
  result?: any;
  error?: Error | string;
  
  // Branch metadata
  priority?: number;
  tags?: string[];
  relevanceScore?: number;
  metadata?: Record<string, any>;
}

/**
 * Execution progress interface
 */
export interface ExecutionProgress {
  executionId: string;
  status: ExecutionStatus;
  progress: number; // 0-100
  currentNodeId?: string;
  completedNodes: string[];
  pendingNodes: string[];
  startTime: Date;
  estimatedTimeRemaining?: number; // milliseconds
  messages?: string[];
  activeBranches?: number;
  completedBranches?: number;
  failedBranches?: number;
}

/**
 * Branch progress interface
 */
export interface BranchProgress {
  branchId: string;
  executionId: string;
  status: BranchStatus;
  progress: number; // 0-100
  parentBranchId?: string;
  name: string;
  currentNodeId?: string;
  completedNodeIds: string[];
  pendingNodeIds: string[];
  startTime?: Date;
  relevanceScore?: number;
  messages?: string[];
}

/**
 * Execution event interface
 */
export interface ExecutionEvent {
  executionId: string;
  timestamp: Date;
  type: string;
  nodeId?: string;
  branchId?: string;
  message?: string;
  data?: any;
}

/**
 * Branch event interface
 */
export interface BranchEvent {
  branchId: string;
  executionId: string;
  timestamp: Date;
  type: BranchEventType;
  nodeId?: string;
  message?: string;
  data?: any;
}

/**
 * Execution options interface
 */
export interface ExecutionOptions {
  priority?: number;
  tokenBudget?: number;
  timeoutMs?: number;
  tags?: string[];
  userId?: string;
  metadata?: Record<string, any>;
  maxRetries?: number;
  enableBranching?: boolean;
  maxBranches?: number;
  branchRelevanceThreshold?: number;
}

/**
 * Branch options interface
 */
export interface BranchOptions {
  name: string;
  description?: string;
  priority?: number;
  tags?: string[];
  metadata?: Record<string, any>;
  tokenBudget?: number;
}

/**
 * Execution filter interface
 */
export interface ExecutionFilter {
  workflowId?: string;
  status?: ExecutionStatus | ExecutionStatus[];
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'startedAt' | 'finishedAt' | 'priority';
  sortDirection?: 'asc' | 'desc';
  hasBranches?: boolean;
}

/**
 * Branch filter interface
 */
export interface BranchFilter {
  executionId?: string;
  status?: BranchStatus | BranchStatus[];
  parentBranchId?: string;
  tags?: string[];
  minRelevanceScore?: number;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'startedAt' | 'finishedAt' | 'priority' | 'relevanceScore';
  sortDirection?: 'asc' | 'desc';
}

/**
 * Execution metrics interface
 */
export interface ExecutionMetrics {
  executionId: string;
  duration: number;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  nodeMetrics: Record<string, {
    duration: number;
    tokenUsage: number;
    startTime: Date;
    endTime?: Date;
  }>;
  totalNodes: number;
  completedNodes: number;
  failedNodes: number;
  totalBranches?: number;
  completedBranches?: number;
  failedBranches?: number;
  canceledBranches?: number;
  branchMetrics?: Record<string, {
    branchId: string;
    name: string;
    duration: number;
    tokenUsage: number;
    relevanceScore?: number;
    completedNodes: number;
    totalNodes: number;
  }>;
}