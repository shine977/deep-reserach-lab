/**
 * Execution Service
 *
 * This service manages workflow execution instances, their lifecycle,
 * and provides methods to control execution (start, pause, cancel, etc.)
 */

import { v4 as uuidv4 } from "uuid";
import {
  Observable,
  of,
  throwError,
  Subject,
  BehaviorSubject,
  EMPTY,
  from,
} from "rxjs";
import {
  map,
  catchError,
  tap,
  finalize,
  shareReplay,
  mergeMap,
} from "rxjs/operators";

/**
 * StreamEvent interface for workflow execution events
 * Represents events emitted by the workflow stream service
 */
interface StreamEvent {
  executionId: string;
  type: string;
  nodeId?: string;
  branchId?: string;
  data?: any;
}

import {
  ExecutionRecord,
  ExecutionStatus,
  ExecutionType,
  ExecutionOptions,
  ExecutionProgress,
  ExecutionEvent,
  ExecutionBranch,
  BranchStatus,
  BranchOptions,
  BranchProgress,
  BranchEvent,
  BranchEventType,
} from "../models/execution.types";

import { Workflow } from "../../core/types/workflow.types";
import { WorkflowExecutor } from "../../workflow/services/workflow-executor.service";
import { WorkflowStreamService } from "../../workflow/services/workflow-stream.service";
import { ExecutionStorageService } from "./execution-storage.service";
import { ExecutionMonitorService } from "./execution-monitor.service";

export class ExecutionService {
  private activeExecutions = new Map<
    string,
    {
      record: ExecutionRecord;
      progress$: BehaviorSubject<ExecutionProgress>;
      events$: Subject<ExecutionEvent>;
      branches: Map<
        string,
        {
          branch: ExecutionBranch;
          progress$: BehaviorSubject<BranchProgress>;
          events$: Subject<BranchEvent>;
          cancel: () => void;
        }
      >;
      cancel: () => void;
    }
  >();

  constructor(
    private workflowExecutor: WorkflowExecutor,
    private streamService: WorkflowStreamService,
    private storageService: ExecutionStorageService,
    private monitorService: ExecutionMonitorService,
  ) {}

  /**
   * Get execution progress
   */
  getExecutionProgress(id: string): Observable<ExecutionProgress> {
    const execData = this.activeExecutions.get(id);
    if (!execData) {
      return throwError(
        () => new Error(`Execution ${id} not found or not active`),
      );
    }

    return execData.progress$.asObservable();
  }

  /**
   * Get execution events
   */
  getExecutionEvents(id: string): Observable<ExecutionEvent> {
    const execData = this.activeExecutions.get(id);
    if (!execData) {
      return throwError(
        () => new Error(`Execution ${id} not found or not active`),
      );
    }

    return execData.events$.asObservable();
  }

  /**
   * List executions with filtering
   */
  async listExecutions(filter?: any): Promise<ExecutionRecord[]> {
    // Get executions from storage
    const storedExecutions = await this.storageService.listExecutions(filter);

    // Get active executions matching the filter
    const activeExecutions = Array.from(this.activeExecutions.values())
      .map((data) => data.record)
      .filter((record) => {
        // Simple filtering logic - can be expanded as needed
        if (filter?.status && filter.status !== record.status) {
          return false;
        }
        if (filter?.userId && filter.userId !== record.userId) {
          return false;
        }
        if (filter?.tags && filter.tags.length > 0) {
          // Safely check for tags existence before filtering
          if (!record.tags || record.tags.length === 0) {
            return false;
          }
          const intersection = record.tags.filter((tag) =>
            filter.tags.includes(tag),
          );
          if (intersection.length === 0) {
            return false;
          }
        }
        return true;
      });

    // Combine and limit results if needed
    const allExecutions = [...activeExecutions, ...storedExecutions];

    if (filter?.limit) {
      return allExecutions.slice(0, filter.limit);
    }

    return allExecutions;
  }

  /**
   * Get execution by ID
   */
  getExecution(id: string): Promise<ExecutionRecord | null> {
    const execData = this.activeExecutions.get(id);
    if (execData) {
      return Promise.resolve(execData.record);
    }

    // If not in active executions, retrieve from storage
    return this.storageService.getExecution(id);
  }

  /**
   * Cancel an execution
   */
  cancelExecution(id: string): Promise<boolean> {
    const execData = this.activeExecutions.get(id);
    if (!execData) {
      return Promise.resolve(false);
    }

    // Update record status
    execData.record.status = ExecutionStatus.CANCELED;
    execData.record.finishedAt = new Date();

    // Cancel active branches
    execData.branches.forEach((branchData, branchId) => {
      this.cancelBranch(id, branchId);
    });

    // Update progress
    const progress = execData.progress$.value;
    progress.status = ExecutionStatus.CANCELED;
    execData.progress$.next(progress);

    // Emit cancellation event
    this.emitExecutionEvent(id, "execution:cancel", {
      reason: "User requested cancellation",
    });

    // Save updated record
    return this.storageService
      .updateExecution(execData.record)
      .then(() => true)
      .catch((err) => {
        console.error(`Failed to update canceled execution ${id}:`, err);
        return false;
      });
  }

  /**
   * Emit an execution event
   */
  private emitExecutionEvent(
    executionId: string,
    type: string,
    data?: any,
  ): void {
    const execData = this.activeExecutions.get(executionId);
    if (!execData) return;

    const event: ExecutionEvent = {
      executionId,
      timestamp: new Date(),
      type,
      data,
    };

    execData.events$.next(event);
  }

  /**
   * Start a new workflow execution
   */
  executeWorkflow(
    workflow: Workflow,
    input: any,
    options: ExecutionOptions = {},
  ): Observable<ExecutionRecord> {
    // Generate execution ID
    const executionId = uuidv4();

    // Create execution record
    const record: ExecutionRecord = {
      id: executionId,
      workflowId: workflow.id,
      status: ExecutionStatus.PENDING,
      type: ExecutionType.MANUAL,
      createdAt: new Date(),
      input,
      tags: options.tags || [],
      userId: options.userId,
      priority: options.priority || 1,
      metadata: options.metadata || {},
      branches: [],
    };

    // Create progress and events subjects
    const progress$ = new BehaviorSubject<ExecutionProgress>({
      executionId,
      status: ExecutionStatus.PENDING,
      progress: 0,
      completedNodes: [],
      pendingNodes: workflow.nodes.map((n) => n.id),
      startTime: new Date(),
      activeBranches: 0,
      completedBranches: 0,
      failedBranches: 0,
    });

    const events$ = new Subject<ExecutionEvent>();

    // Store in active executions
    const cancelFn = () => this.cancelExecution(executionId);
    this.activeExecutions.set(executionId, {
      record,
      progress$,
      events$,
      branches: new Map(), // Initialize empty branches map
      cancel: cancelFn,
    });

    // Save initial record
    this.storageService
      .saveExecution(record)
      .catch((err) => console.error("Failed to save execution record:", err));

    // Emit execution start event
    this.emitExecutionEvent(executionId, "execution:start", {
      workflow: workflow.id,
      input,
    });

    // Update status to running
    record.status = ExecutionStatus.RUNNING;
    record.startedAt = new Date();
    this.storageService
      .updateExecution(record)
      .catch((err) => console.error("Failed to update execution record:", err));

    // Configure execution options
    const execOptions = {
      executionId,
      timeout: options.timeoutMs,
      maxTokens: options.tokenBudget,
      enableBranching: options.enableBranching || false,
      maxBranches: options.maxBranches,
    };

    // Create workflow stream
    const stream$ = this.streamService.createStream(
      workflow,
      input,
      execOptions,
    );

    // Monitor the stream for events
    this.monitorService.monitorExecution(stream$, executionId, workflow);

    // Initialize the main branch if branching is enabled
    if (options.enableBranching) {
      this.createBranch(executionId, {
        name: "Main Branch",
        description: "Initial workflow execution path",
        tags: ["main"],
        priority: 10,
      });
    }

    // Subscribe to stream events for progress updates
    this.streamService.getEvents().subscribe((event: StreamEvent) => {
      if (event.executionId !== executionId) return;

      // Convert to execution event
      const execEvent: ExecutionEvent = {
        executionId,
        timestamp: new Date(),
        type: event.type,
        nodeId: event.nodeId,
        branchId: event.branchId,
        data: event.data,
      };

      // Emit execution event
      events$.next(execEvent);

      // Update progress based on event
      this.updateProgressFromEvent(progress$.value, event, workflow);
      progress$.next(progress$.value);

      // Handle branch-related events
      if (event.branchId && options.enableBranching) {
        this.handleBranchEvent(event);
      }
    });

    // Execute the workflow
    return this.workflowExecutor.execute(workflow, input).pipe(
      tap((result) => {
        // Update record with result
        record.status =
          result.status === "completed"
            ? ExecutionStatus.COMPLETED
            : ExecutionStatus.FAILED;
        record.finishedAt = new Date();
        record.result = result.result;
        record.error = result.error;

        // Calculate token usage if available
        if (result.result && result.result.budget) {
          record.tokenUsage = {
            input: result.result.budget.used || 0,
            output: 0, // Not tracked separately in current implementation
            total: result.result.budget.used || 0,
          };
        }

        // Update final progress
        progress$.next({
          ...progress$.value,
          status: record.status,
          progress: 100,
          completedNodes: workflow.nodes.map((n) => n.id),
          pendingNodes: [],
        });

        // Emit completion event
        this.emitExecutionEvent(executionId, "execution:complete", {
          result: result.result,
          status: record.status,
        });

        // Complete active branches
        this.completeActiveBranches(executionId);

        // Complete events
        events$.complete();
      }),

      // Store execution result
      finalize(() => {
        // Save final record state
        this.storageService
          .updateExecution(record)
          .catch((err) =>
            console.error("Failed to update execution record:", err),
          );

        // Collect execution metrics
        this.monitorService
          .collectExecutionMetrics(executionId)
          .then((metrics) => {
            record.metadata = { ...record.metadata, metrics };
            this.storageService
              .updateExecution(record)
              .catch((err) =>
                console.error("Failed to update execution metrics:", err),
              );
          })
          .catch((err) => console.error("Failed to collect metrics:", err));

        // Remove from active executions
        this.activeExecutions.delete(executionId);
      }),

      // Map to execution record
      map(() => record),

      // Share replay to allow multiple subscribers
      shareReplay(1),
    );
  }

  /**
   * Handle a branch-related event
   */
  private handleBranchEvent(event: StreamEvent): void {
    const executionId = event.executionId;

    const execData = this.activeExecutions.get(executionId);

    if (!execData) return;
    const branchId = event.branchId!;
    const branchData = execData.branches.get(branchId);
    if (!branchData && event.type !== "branch:create") return;

    switch (event.type) {
      case "branch:create":
        // A new branch is being created by the workflow
        this.createBranch(
          executionId,
          {
            name: event.data?.name || `Branch ${branchId}`,
            description: event.data?.description,
            tags: event.data?.tags,
            priority: event.data?.priority,
            metadata: event.data?.metadata,
          },
          branchId,
        );
        break;

      case "branch:start":
        if (branchData) {
          const branch = branchData.branch;
          branch.status = BranchStatus.RUNNING;
          branch.startedAt = new Date();

          // Update branch
          this.storageService
            .updateBranch(branch)
            .catch((err) =>
              console.error(`Failed to update branch ${branchId}:`, err),
            );

          // Emit branch event
          this.emitBranchEvent(branchId, BranchEventType.BRANCH_STARTED, {
            executionId,
            name: branch.name,
          });
        }
        break;

      case "branch:complete":
        if (branchData) {
          const branch = branchData.branch;
          branch.status = BranchStatus.COMPLETED;
          branch.finishedAt = new Date();
          branch.result = event.data?.result;

          // Update relevance score if available
          if (event.data?.relevanceScore !== undefined) {
            branch.relevanceScore = event.data.relevanceScore;
          }

          // Update branch
          this.storageService
            .updateBranch(branch)
            .catch((err) =>
              console.error(`Failed to update branch ${branchId}:`, err),
            );

          // Emit branch event
          this.emitBranchEvent(branchId, BranchEventType.BRANCH_COMPLETED, {
            executionId,
            name: branch.name,
            result: branch.result,
            relevanceScore: branch.relevanceScore,
          });

          // Update progress
          const progress = execData.progress$.value;
          progress.completedBranches = (progress.completedBranches || 0) + 1;
          progress.activeBranches = (progress.activeBranches || 0) - 1;
          execData.progress$.next(progress);
        }
        break;

      case "branch:failed":
        if (branchData) {
          const branch = branchData.branch;
          branch.status = BranchStatus.FAILED;
          branch.finishedAt = new Date();
          branch.error = event.data?.error;

          // Update branch
          this.storageService
            .updateBranch(branch)
            .catch((err) =>
              console.error(`Failed to update branch ${branchId}:`, err),
            );

          // Emit branch event
          this.emitBranchEvent(branchId, BranchEventType.BRANCH_FAILED, {
            executionId,
            name: branch.name,
            error: branch.error,
          });

          // Update progress
          const progress = execData.progress$.value;
          progress.failedBranches = (progress.failedBranches || 0) + 1;
          progress.activeBranches = (progress.activeBranches || 0) - 1;
          execData.progress$.next(progress);
        }
        break;

      // Other branch events can be handled here
    }
  }

  /**
   * Update execution progress based on stream events
   *
   * This method processes workflow events and updates the execution progress tracking:
   * - Tracks node completion status and updates progress percentage
   * - Updates execution status based on event types
   * - Manages pending and completed nodes lists
   * - Centralizes progress tracking logic for consistent behavior
   */
  private updateProgressFromEvent(
    progress: ExecutionProgress,
    event: StreamEvent,
    workflow: Workflow,
  ): void {
    // Handle node completion
    if (event.type === "node:complete" && event.nodeId) {
      // Add to completed nodes if not already there
      if (!progress.completedNodes.includes(event.nodeId)) {
        progress.completedNodes.push(event.nodeId);
      }

      // Remove from pending nodes
      const pendingIndex = progress.pendingNodes.indexOf(event.nodeId);
      if (pendingIndex >= 0) {
        progress.pendingNodes.splice(pendingIndex, 1);
      }

      // Clear current node
      progress.currentNodeId = undefined;

      // Calculate progress percentage
      progress.progress = Math.round(
        (progress.completedNodes.length / workflow.nodes.length) * 100,
      );
    }

    // Handle node start
    if (event.type === "node:start" && event.nodeId) {
      progress.currentNodeId = event.nodeId;

      // Ensure node is in pending nodes list if not completed
      if (
        !progress.completedNodes.includes(event.nodeId) &&
        !progress.pendingNodes.includes(event.nodeId)
      ) {
        progress.pendingNodes.push(event.nodeId);
      }
    }

    // Update execution status based on event types
    if (event.type === "execution:complete") {
      progress.status = ExecutionStatus.COMPLETED;
    } else if (event.type === "execution:failed") {
      progress.status = ExecutionStatus.FAILED;
    } else if (event.type === "execution:canceled") {
      progress.status = ExecutionStatus.CANCELED;
    } else if (event.type === "execution:paused") {
      progress.status = ExecutionStatus.PAUSED;
    } else if (progress.status === ExecutionStatus.PENDING) {
      progress.status = ExecutionStatus.RUNNING;
    }
  }

  /**
   * Create a new branch for an execution
   */
  createBranch(
    executionId: string,
    options: BranchOptions,
    branchId: string = uuidv4(),
    parentBranchId?: string,
  ): Observable<ExecutionBranch> {
    const execData = this.activeExecutions.get(executionId);
    if (!execData) {
      return throwError(
        () => new Error(`Execution ${executionId} not found or not active`),
      );
    }

    // Create branch record
    const branch: ExecutionBranch = {
      id: branchId,
      executionId,
      parentBranchId,
      name: options.name,
      description: options.description,
      status: BranchStatus.PENDING,
      createdAt: new Date(),
      nodeIds: [],
      completedNodeIds: [],
      priority: options.priority,
      tags: options.tags,
      metadata: options.metadata,
    };

    // Create progress and events subjects
    const progress$ = new BehaviorSubject<BranchProgress>({
      branchId,
      executionId,
      status: BranchStatus.PENDING,
      progress: 0,
      name: options.name,
      completedNodeIds: [],
      pendingNodeIds: [],
    });

    const events$ = new Subject<BranchEvent>();

    // Store in active branches
    const cancelFn = () => this.cancelBranch(executionId, branchId);
    execData.branches.set(branchId, {
      branch,
      progress$,
      events$,
      cancel: cancelFn,
    });

    // Save branch record
    this.storageService
      .saveBranch(branch)
      .catch((err) => console.error("Failed to save branch record:", err));

    // Emit branch creation event
    this.emitBranchEvent(branchId, BranchEventType.BRANCH_STARTED, {
      executionId,
      name: options.name,
      parentBranchId,
    });

    // Update execution progress to track active branches
    const progress = execData.progress$.value;
    progress.activeBranches = (progress.activeBranches || 0) + 1;
    execData.progress$.next(progress);

    return of(branch);
  }

  /**
   * Complete all active branches for an execution
   */
  private completeActiveBranches(executionId: string): void {
    const execData = this.activeExecutions.get(executionId);
    if (!execData) return;

    execData.branches.forEach((branchData) => {
      const branch = branchData.branch;
      if (branch.status === BranchStatus.RUNNING) {
        branch.status = BranchStatus.COMPLETED;
        branch.finishedAt = new Date();

        // Update branch
        this.storageService
          .updateBranch(branch)
          .catch((err) =>
            console.error(`Failed to update branch ${branch.id}:`, err),
          );

        // Emit branch event
        this.emitBranchEvent(branch.id, BranchEventType.BRANCH_COMPLETED, {
          executionId,
          name: branch.name,
        });

        // Update progress
        const progress = execData.progress$.value;
        progress.completedBranches = (progress.completedBranches || 0) + 1;
        progress.activeBranches = (progress.activeBranches || 0) - 1;
        execData.progress$.next(progress);
      }
    });
  }

  /**
   * Cancel a branch
   */
  cancelBranch(executionId: string, branchId: string): Promise<boolean> {
    const execData = this.activeExecutions.get(executionId);
    if (!execData) {
      return Promise.resolve(false);
    }

    const branchData = execData.branches.get(branchId);
    if (!branchData) {
      return Promise.resolve(false);
    }

    const branch = branchData.branch;

    // Only cancel if running
    if (branch.status !== BranchStatus.RUNNING) {
      return Promise.resolve(false);
    }

    // Update status
    branch.status = BranchStatus.CANCELED;
    branch.finishedAt = new Date();

    // Emit cancellation event
    this.emitBranchEvent(branchId, BranchEventType.BRANCH_CANCELED, {
      executionId,
      name: branch.name,
      reason: "User requested cancellation",
    });

    // Update branch
    return this.storageService
      .updateBranch(branch)
      .then(() => true)
      .catch((err) => {
        console.error(`Failed to update canceled branch ${branchId}:`, err);
        return false;
      });
  }

  /**
   * Emit a branch event
   */
  private emitBranchEvent(
    branchId: string,
    type: BranchEventType,
    data?: any,
  ): void {
    const execData = this.activeExecutions.get(data.executionId);
    if (!execData) return;

    const branchData = execData.branches.get(branchId);
    if (!branchData) return;

    const event: BranchEvent = {
      branchId,
      executionId: data.executionId,
      timestamp: new Date(),
      type,
      data,
    };

    branchData.events$.next(event);
  }

  /**
   * Cancel multiple branches
   */
  cancelBranches(
    executionId: string,
    branchIds: string[],
  ): Promise<{
    success: boolean;
    canceledBranches: string[];
    failedToCancel: string[];
  }> {
    const execData = this.activeExecutions.get(executionId);
    if (!execData) {
      return Promise.resolve({
        success: false,
        canceledBranches: [],
        failedToCancel: branchIds,
      });
    }

    const results = branchIds.map((branchId) =>
      this.cancelBranch(executionId, branchId).then((success) => ({
        branchId,
        success,
      })),
    );

    return Promise.all(results).then((results) => {
      const canceledBranches = results
        .filter((r) => r.success)
        .map((r) => r.branchId);
      const failedToCancel = results
        .filter((r) => !r.success)
        .map((r) => r.branchId);

      return {
        success: failedToCancel.length === 0,
        canceledBranches,
        failedToCancel,
      };
    });
  }

  /**
   * Get branch by ID
   */
  getBranch(
    executionId: string,
    branchId: string,
  ): Promise<ExecutionBranch | null> {
    const execData = this.activeExecutions.get(executionId);
    if (!execData) {
      // If execution is not active, try to get from storage
      return this.storageService.getBranch(branchId);
    }

    const branchData = execData.branches.get(branchId);
    if (!branchData) {
      // If branch is not in active execution, try to get from storage
      return this.storageService.getBranch(branchId);
    }

    return Promise.resolve(branchData.branch);
  }

  /**
   * Get branch progress
   */
  getBranchProgress(
    executionId: string,
    branchId: string,
  ): Observable<BranchProgress> {
    const execData = this.activeExecutions.get(executionId);
    if (!execData) {
      return throwError(
        () => new Error(`Execution ${executionId} not found or not active`),
      );
    }

    const branchData = execData.branches.get(branchId);
    if (!branchData) {
      return throwError(
        () =>
          new Error(
            `Branch ${branchId} not found for execution ${executionId}`,
          ),
      );
    }

    return branchData.progress$.asObservable();
  }

  /**
   * Get branch events
   */
  getBranchEvents(
    executionId: string,
    branchId: string,
  ): Observable<BranchEvent> {
    const execData = this.activeExecutions.get(executionId);
    if (!execData) {
      return throwError(
        () => new Error(`Execution ${executionId} not found or not active`),
      );
    }

    const branchData = execData.branches.get(branchId);
    if (!branchData) {
      return throwError(
        () =>
          new Error(
            `Branch ${branchId} not found for execution ${executionId}`,
          ),
      );
    }

    return branchData.events$.asObservable();
  }

  /**
   * List branches for an execution with optional filtering
   */
  listBranches(
    executionId: string,
    filter?: {
      status?: BranchStatus[];
      relevanceThreshold?: number;
    },
  ): Promise<ExecutionBranch[]> {
    const execData = this.activeExecutions.get(executionId);

    // For active executions, combine in-memory data with storage
    if (execData) {
      // Get branches from active execution
      const activeBranches = Array.from(execData.branches.values()).map(
        (data) => data.branch,
      );

      return Promise.resolve(activeBranches).then((branches) => {
        // Apply filters if provided
        let filteredBranches = [...branches];

        if (filter?.status && filter.status.length > 0) {
          filteredBranches = filteredBranches.filter((branch) =>
            filter.status!.includes(branch.status),
          );
        }

        if (filter?.relevanceThreshold !== undefined) {
          filteredBranches = filteredBranches.filter(
            (branch) =>
              branch.relevanceScore !== undefined &&
              branch.relevanceScore >= filter.relevanceThreshold!,
          );
        }

        return filteredBranches;
      });
    }

    // For inactive executions, just use storage
    return this.storageService.listBranches(filter);
  }
}
