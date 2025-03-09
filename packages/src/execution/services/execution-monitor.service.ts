/**
 * Execution Monitor Service
 *
 * This service monitors workflow executions, collecting metrics
 * and tracking progress for both the overall execution and individual branches.
 */

import { Observable, Subscription } from "rxjs";
import {
  ExecutionMetrics,
  ExecutionProgress,
  ExecutionEvent,
  ExecutionBranch,
  BranchProgress,
  BranchEvent,
  BranchStatus,
} from "../models/execution.types";
import { Workflow } from "@packages/core/types/workflow.types";
import { Injectable } from "@nestjs/common";

@Injectable()
export class ExecutionMonitorService {
  // Track active execution subscriptions
  private executionSubscriptions: Map<string, Subscription> = new Map();

  // Store execution metrics
  private executionMetrics: Map<string, ExecutionMetrics> = new Map();

  // Store branch metrics
  private branchMetrics: Map<
    string,
    {
      branchId: string;
      executionId: string;
      startTime: Date;
      endTime?: Date;
      nodeMetrics: Record<
        string,
        {
          startTime: Date;
          endTime?: Date;
          tokenUsage: number;
        }
      >;
      tokenUsage: number;
    }
  > = new Map();

  // Branch progress tracking
  private branchProgress: Map<string, BranchProgress> = new Map();

  /**
   * Monitor an execution stream and collect metrics
   */
  monitorExecution(
    stream$: Observable<any>,
    executionId: string,
    workflow: Workflow,
  ): void {
    // Initialize execution metrics
    const metrics: ExecutionMetrics = {
      executionId,
      duration: 0,
      tokenUsage: {
        input: 0,
        output: 0,
        total: 0,
      },
      nodeMetrics: {},
      totalNodes: workflow.nodes.length,
      completedNodes: 0,
      failedNodes: 0,
      totalBranches: 0,
      completedBranches: 0,
      failedBranches: 0,
      canceledBranches: 0,
      branchMetrics: {},
    };

    this.executionMetrics.set(executionId, metrics);

    // Subscribe to the stream
    const subscription = stream$.subscribe({
      next: (data) => {
        // Update metrics based on event type
        if (data.type === "node:start") {
          const nodeId = data.nodeId;

          if (!metrics.nodeMetrics[nodeId]) {
            metrics.nodeMetrics[nodeId] = {
              duration: 0,
              tokenUsage: 0,
              startTime: new Date(),
            };
          }

          // Track branch node execution if branch information is available
          if (data.branchId) {
            this.trackBranchNodeStart(data.branchId, nodeId, executionId);
          }
        }

        if (data.type === "node:complete") {
          const nodeId = data.nodeId;
          const nodeMetrics = metrics.nodeMetrics[nodeId];

          if (nodeMetrics) {
            nodeMetrics.endTime = new Date();
            nodeMetrics.duration =
              nodeMetrics.endTime.getTime() - nodeMetrics.startTime.getTime();

            // Update token usage if available
            if (data.data && data.data.tokenUsage) {
              nodeMetrics.tokenUsage = data.data.tokenUsage;
              metrics.tokenUsage.total += data.data.tokenUsage;
            }

            metrics.completedNodes++;
          }

          // Track branch node completion if branch information is available
          if (data.branchId) {
            this.trackBranchNodeComplete(data.branchId, nodeId, data.data);
          }
        }

        if (data.type === "node:error") {
          metrics.failedNodes++;

          // Track branch node error if branch information is available
          if (data.branchId) {
            this.trackBranchNodeError(
              data.branchId,
              data.nodeId,
              data.data?.error,
            );
          }
        }

        // Handle branch-specific events
        if (data.type === "branch:start") {
          this.trackBranchStart(data.branchId, executionId, data.data);
          metrics.totalBranches = (metrics.totalBranches || 0) + 1;
        }

        if (data.type === "branch:complete") {
          this.trackBranchComplete(data.branchId, data.data);
          metrics.completedBranches = (metrics.completedBranches || 0) + 1;
        }

        if (data.type === "branch:failed") {
          this.trackBranchFailed(data.branchId, data.data?.error);
          metrics.failedBranches = (metrics.failedBranches || 0) + 1;
        }

        if (data.type === "branch:canceled") {
          this.trackBranchCanceled(data.branchId, data.data?.reason);
          metrics.canceledBranches = (metrics.canceledBranches || 0) + 1;
        }

        // Update the metrics
        this.executionMetrics.set(executionId, metrics);
      },
      error: (err) => {
        console.error(`Error in execution ${executionId}:`, err);
      },
      complete: () => {
        console.log(`Monitoring completed for execution ${executionId}`);
      },
    });

    // Store the subscription
    this.executionSubscriptions.set(executionId, subscription);
  }

  /**
   * Stop monitoring an execution
   */
  stopMonitoring(executionId: string): void {
    const subscription = this.executionSubscriptions.get(executionId);
    if (subscription) {
      subscription.unsubscribe();
      this.executionSubscriptions.delete(executionId);
      console.log(`Stopped monitoring execution ${executionId}`);
    }
  }

  /**
   * Get execution metrics
   */
  async collectExecutionMetrics(
    executionId: string,
  ): Promise<ExecutionMetrics> {
    const metrics = this.executionMetrics.get(executionId);

    if (!metrics) {
      throw new Error(`No metrics found for execution ${executionId}`);
    }

    // Calculate total duration
    // Find the earliest startTime across all node metrics
    let earliestStartTime: Date | undefined;

    // Iterate through all node metrics to find the earliest start time
    Object.values(metrics.nodeMetrics).forEach((nodeMetric) => {
      if (
        nodeMetric.startTime &&
        (!earliestStartTime || nodeMetric.startTime < earliestStartTime)
      ) {
        earliestStartTime = nodeMetric.startTime;
      }
    });

    // Calculate duration based on the earliest start time or use 0 if no start time found
    metrics.duration = earliestStartTime
      ? new Date().getTime() - earliestStartTime.getTime()
      : 0;

    // Add branch metrics to the execution metrics
    metrics.branchMetrics = {};

    for (const [branchId, branchMetric] of this.branchMetrics.entries()) {
      if (branchMetric.executionId === executionId) {
        const nodeIds = Object.keys(branchMetric.nodeMetrics);
        const completed = nodeIds.filter(
          (id) => branchMetric.nodeMetrics[id].endTime,
        ).length;

        metrics.branchMetrics[branchId] = {
          branchId,
          name: this.branchProgress.get(branchId)?.name || "Unknown Branch",
          duration: branchMetric.endTime
            ? branchMetric.endTime.getTime() - branchMetric.startTime.getTime()
            : new Date().getTime() - branchMetric.startTime.getTime(),
          tokenUsage: branchMetric.tokenUsage,
          relevanceScore: this.branchProgress.get(branchId)?.relevanceScore,
          completedNodes: completed,
          totalNodes: nodeIds.length,
        };
      }
    }

    return metrics;
  }

  /**
   * Get branch progress
   */
  getBranchProgress(branchId: string): BranchProgress | null {
    return this.branchProgress.get(branchId) || null;
  }

  /**
   * Get all branch progress for an execution
   */
  getExecutionBranchProgress(executionId: string): BranchProgress[] {
    return Array.from(this.branchProgress.values()).filter(
      (progress) => progress.executionId === executionId,
    );
  }

  /**
   * Track when a branch starts
   */
  private trackBranchStart(
    branchId: string,
    executionId: string,
    data: any,
  ): void {
    // Initialize branch metrics
    this.branchMetrics.set(branchId, {
      branchId,
      executionId,
      startTime: new Date(),
      nodeMetrics: {},
      tokenUsage: 0,
    });

    // Initialize branch progress
    this.branchProgress.set(branchId, {
      branchId,
      executionId,
      status: BranchStatus.RUNNING,
      progress: 0,
      name: data.name || `Branch ${branchId}`,
      currentNodeId: undefined,
      completedNodeIds: [],
      pendingNodeIds: data.nodeIds || [],
      startTime: new Date(),
      relevanceScore: data.relevanceScore,
    });
  }

  /**
   * Track when a branch node starts
   */
  private trackBranchNodeStart(
    branchId: string,
    nodeId: string,
    executionId: string,
  ): void {
    const branchMetric = this.branchMetrics.get(branchId);
    const progress = this.branchProgress.get(branchId);

    if (branchMetric) {
      branchMetric.nodeMetrics[nodeId] = {
        startTime: new Date(),
        tokenUsage: 0,
      };
    }

    if (progress) {
      progress.currentNodeId = nodeId;
    }
  }

  /**
   * Track when a branch node completes
   */
  private trackBranchNodeComplete(
    branchId: string,
    nodeId: string,
    data: any,
  ): void {
    const branchMetric = this.branchMetrics.get(branchId);
    const progress = this.branchProgress.get(branchId);

    if (branchMetric && branchMetric.nodeMetrics[nodeId]) {
      const nodeMetric = branchMetric.nodeMetrics[nodeId];
      nodeMetric.endTime = new Date();

      // Update token usage if available
      if (data && data.tokenUsage) {
        nodeMetric.tokenUsage = data.tokenUsage;
        branchMetric.tokenUsage += data.tokenUsage;
      }
    }

    if (progress) {
      // Add to completed nodes
      if (!progress.completedNodeIds.includes(nodeId)) {
        progress.completedNodeIds.push(nodeId);
      }

      // Remove from pending nodes
      progress.pendingNodeIds = progress.pendingNodeIds.filter(
        (id) => id !== nodeId,
      );

      // Update progress percentage
      const totalNodes =
        progress.completedNodeIds.length + progress.pendingNodeIds.length;
      progress.progress = Math.round(
        (progress.completedNodeIds.length / totalNodes) * 100,
      );

      // Clear current node
      progress.currentNodeId = undefined;
    }
  }

  /**
   * Track when a branch node has an error
   */
  private trackBranchNodeError(
    branchId: string,
    nodeId: string,
    error: any,
  ): void {
    const progress = this.branchProgress.get(branchId);

    if (progress) {
      progress.currentNodeId = undefined;
    }
  }

  /**
   * Track when a branch completes
   */
  private trackBranchComplete(branchId: string, data: any): void {
    const branchMetric = this.branchMetrics.get(branchId);
    const progress = this.branchProgress.get(branchId);

    if (branchMetric) {
      branchMetric.endTime = new Date();
    }

    if (progress) {
      progress.status = BranchStatus.COMPLETED;
      progress.progress = 100;
      progress.currentNodeId = undefined;

      // Update relevance score if available
      if (data && data.relevanceScore !== undefined) {
        progress.relevanceScore = data.relevanceScore;
      }
    }
  }

  /**
   * Track when a branch fails
   */
  private trackBranchFailed(branchId: string, error: any): void {
    const branchMetric = this.branchMetrics.get(branchId);
    const progress = this.branchProgress.get(branchId);

    if (branchMetric) {
      branchMetric.endTime = new Date();
    }

    if (progress) {
      progress.status = BranchStatus.FAILED;
      progress.currentNodeId = undefined;
    }
  }

  /**
   * Track when a branch is canceled
   */
  private trackBranchCanceled(branchId: string, reason: string): void {
    const branchMetric = this.branchMetrics.get(branchId);
    const progress = this.branchProgress.get(branchId);

    if (branchMetric) {
      branchMetric.endTime = new Date();
    }

    if (progress) {
      progress.status = BranchStatus.CANCELED;
      progress.currentNodeId = undefined;
    }
  }
}
