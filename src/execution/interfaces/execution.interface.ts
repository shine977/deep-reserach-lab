/**
 * Execution Module Interfaces
 * 
 * This file defines the public interfaces for the execution module,
 * exposing a clear API contract for other modules to interact with.
 */

import { Observable } from 'rxjs';
import { 
  ExecutionRecord, 
  ExecutionStatus, 
  ExecutionOptions, 
  ExecutionProgress,
  ExecutionEvent,
  ExecutionBranch,
  BranchOptions,
  BranchStatus,
  BranchProgress,
  BranchEvent,
  ExecutionFilter,
  ExecutionMetrics
} from '../models/execution.types';
import { Workflow } from '../../core/types/workflow.types';

/**
 * Execution service interface
 */
export interface IExecutionService {
  /**
   * Execute a workflow
   */
  executeWorkflow(
    workflow: Workflow, 
    input: any, 
    options?: ExecutionOptions
  ): Observable<ExecutionRecord>;
  
  /**
   * Cancel an execution
   */
  cancelExecution(id: string): Promise<boolean>;
  
  /**
   * Get execution by ID
   */
  getExecution(id: string): Promise<ExecutionRecord | null>;
  
  /**
   * Get execution progress
   */
  getExecutionProgress(id: string): Observable<ExecutionProgress>;
  
  /**
   * Get execution events
   */
  getExecutionEvents(id: string): Observable<ExecutionEvent>;
  
  /**
   * List executions with filtering
   */
  listExecutions(filter?: ExecutionFilter): Promise<ExecutionRecord[]>;
  
  /**
   * Create a new branch for an execution
   */
  createBranch(
    executionId: string, 
    options: BranchOptions,
    branchId?: string,
    parentBranchId?: string
  ): Observable<ExecutionBranch>;
  
  /**
   * Cancel a specific branch
   */
  cancelBranch(executionId: string, branchId: string): Promise<boolean>;
  
  /**
   * Cancel multiple branches
   */
  cancelBranches(executionId: string, branchIds: string[]): Promise<{
    success: boolean;
    canceledBranches: string[];
    failedToCancel: string[];
  }>;
  
  /**
   * Get branch by ID
   */
  getBranch(executionId: string, branchId: string): Promise<ExecutionBranch | null>;
  
  /**
   * Get branch progress
   */
  getBranchProgress(executionId: string, branchId: string): Observable<BranchProgress>;
  
  /**
   * Get branch events
   */
  getBranchEvents(executionId: string, branchId: string): Observable<BranchEvent>;
  
  /**
   * List branches for an execution with optional filtering
   */
  listBranches(
    executionId: string,
    filter?: {
      status?: BranchStatus[];
      relevanceThreshold?: number;
    }
  ): Promise<ExecutionBranch[]>;
}

/**
 * Execution storage interface
 */
export interface IExecutionStorageService {
  /**
   * Save a new execution record
   */
  saveExecution(record: ExecutionRecord): Promise<void>;
  
  /**
   * Update an existing execution record
   */
  updateExecution(record: ExecutionRecord): Promise<void>;
  
  /**
   * Get an execution record by ID
   */
  getExecution(id: string): Promise<ExecutionRecord | null>;
  
  /**
   * List execution records with filtering
   */
  listExecutions(filter?: ExecutionFilter): Promise<ExecutionRecord[]>;
  
  /**
   * Delete an execution record
   */
  deleteExecution(id: string): Promise<boolean>;
  
  /**
   * Clear all execution records
   */
  clearExecutions(): Promise<void>;
  
  /**
   * Get execution count
   */
  getExecutionCount(filter?: ExecutionFilter): Promise<number>;
}

/**
 * Execution monitor interface
 */
export interface IExecutionMonitorService {
  /**
   * Monitor a workflow execution stream
   */
  monitorExecution(
    stream$: Observable<any>,
    executionId: string,
    workflow: Workflow
  ): void;
  
  /**
   * Collect execution metrics
   */
  collectExecutionMetrics(executionId: string): Promise<ExecutionMetrics>;
  
  /**
   * Get execution metrics by ID
   */
  getExecutionMetrics(executionId: string): ExecutionMetrics | undefined;
  
  /**
   * Process execution event for monitoring
   */
  processExecutionEvent(event: ExecutionEvent): void;
  
  /**
   * Clear metrics for an execution
   */
  clearExecutionMetrics(executionId: string): void;
}