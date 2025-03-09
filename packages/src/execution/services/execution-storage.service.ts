/**
 * Execution Storage Service
 *
 * This service handles the persistent storage of execution records and branches,
 * providing methods to save, retrieve, and query execution history.
 */

import { Injectable } from "@nestjs/common";
import {
  ExecutionRecord,
  ExecutionFilter,
  ExecutionStatus,
  ExecutionBranch,
  BranchStatus,
  BranchFilter,
} from "../models/execution.types";

@Injectable()
export class ExecutionStorageService {
  // In-memory storage for the MVP
  private executionRecords: Map<string, ExecutionRecord> = new Map();
  private branchRecords: Map<string, ExecutionBranch> = new Map();

  /**
   * Save a new execution record
   */
  async saveExecution(record: ExecutionRecord): Promise<void> {
    this.executionRecords.set(record.id, { ...record });
    console.log(`Saved execution record: ${record.id}`);
  }

  /**
   * Update an existing execution record
   */
  async updateExecution(record: ExecutionRecord): Promise<void> {
    if (!this.executionRecords.has(record.id)) {
      throw new Error(`Execution ${record.id} not found`);
    }

    this.executionRecords.set(record.id, { ...record });
    console.log(`Updated execution record: ${record.id}`);
  }

  /**
   * Get an execution record by ID
   */
  async getExecution(id: string): Promise<ExecutionRecord | null> {
    const record = this.executionRecords.get(id);
    return record ? { ...record } : null;
  }

  /**
   * List execution records with filtering
   */
  async listExecutions(
    filter: ExecutionFilter = {},
  ): Promise<ExecutionRecord[]> {
    let records = Array.from(this.executionRecords.values());

    // Apply filters
    if (filter.workflowId) {
      records = records.filter((r) => r.workflowId === filter.workflowId);
    }

    if (filter.status) {
      const statuses = Array.isArray(filter.status)
        ? filter.status
        : [filter.status];
      records = records.filter((r) => statuses.includes(r.status));
    }

    if (filter.userId) {
      records = records.filter((r) => r.userId === filter.userId);
    }

    if (filter.tags && filter.tags.length > 0) {
      records = records.filter(
        (r) => r.tags && filter.tags?.some((tag) => r.tags?.includes(tag)),
      );
    }

    if (filter.dateFrom !== undefined) {
      const dateFrom = filter.dateFrom!; // Use non-null assertion for TypeScript
      records = records.filter((r) => r.createdAt >= dateFrom);
    }

    if (filter.dateTo !== undefined) {
      const dateTo = filter.dateTo!; // Use non-null assertion for TypeScript
      records = records.filter((r) => r.createdAt <= dateTo);
    }

    // Apply special branch filter
    if (filter.hasBranches !== undefined) {
      records = records.filter((r) => {
        const hasBranches = r.branches && r.branches.length > 0;
        return filter.hasBranches ? hasBranches : !hasBranches;
      });
    }

    // Apply sorting
    if (filter.sortBy) {
      const sortField = filter.sortBy;
      const sortDirection = filter.sortDirection || "desc";

      records.sort((a, b) => {
        const aValue = a[sortField];
        const bValue = b[sortField];

        if (!aValue && !bValue) return 0;
        if (!aValue) return sortDirection === "asc" ? -1 : 1;
        if (!bValue) return sortDirection === "asc" ? 1 : -1;

        const comparison = aValue > bValue ? 1 : -1;
        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    // Apply pagination
    if (filter.offset || filter.limit) {
      const offset = filter.offset || 0;
      const limit = filter.limit || records.length;
      records = records.slice(offset, offset + limit);
    }

    return records;
  }

  /**
   * Save a new branch record
   */
  async saveBranch(branch: ExecutionBranch): Promise<void> {
    this.branchRecords.set(branch.id, { ...branch });

    // Update the parent execution record to include the branch
    const execution = await this.getExecution(branch.executionId);
    if (execution) {
      if (!execution.branches) {
        execution.branches = [];
      }

      // Add branch if not already in the list
      if (!execution.branches.some((b) => b.id === branch.id)) {
        execution.branches.push(branch);
        await this.updateExecution(execution);
      }
    }

    console.log(
      `Saved branch record: ${branch.id} for execution: ${branch.executionId}`,
    );
  }

  /**
   * Update an existing branch record
   */
  async updateBranch(branch: ExecutionBranch): Promise<void> {
    if (!this.branchRecords.has(branch.id)) {
      throw new Error(`Branch ${branch.id} not found`);
    }

    this.branchRecords.set(branch.id, { ...branch });

    // Update the branch in the parent execution record
    const execution = await this.getExecution(branch.executionId);
    if (execution && execution.branches) {
      const index = execution.branches.findIndex((b) => b.id === branch.id);
      if (index >= 0) {
        execution.branches[index] = branch;
        await this.updateExecution(execution);
      }
    }

    console.log(`Updated branch record: ${branch.id}`);
  }

  /**
   * Get a branch record by ID
   */
  async getBranch(id: string): Promise<ExecutionBranch | null> {
    const branch = this.branchRecords.get(id);
    return branch ? { ...branch } : null;
  }

  /**
   * Get all branches for an execution
   */
  async getExecutionBranches(executionId: string): Promise<ExecutionBranch[]> {
    return Array.from(this.branchRecords.values()).filter(
      (branch) => branch.executionId === executionId,
    );
  }

  /**
   * List branch records with filtering
   */
  async listBranches(filter: BranchFilter = {}): Promise<ExecutionBranch[]> {
    let branches = Array.from(this.branchRecords.values());

    // Apply filters
    if (filter.executionId) {
      branches = branches.filter((b) => b.executionId === filter.executionId);
    }

    if (filter.status) {
      const statuses = Array.isArray(filter.status)
        ? filter.status
        : [filter.status];
      branches = branches.filter((b) => statuses.includes(b.status));
    }

    if (filter.parentBranchId) {
      branches = branches.filter(
        (b) => b.parentBranchId === filter.parentBranchId,
      );
    }

    if (filter.tags && filter.tags.length > 0) {
      branches = branches.filter(
        (b) => b.tags && filter.tags?.some((tag) => b.tags?.includes(tag)),
      );
    }

    if (filter.minRelevanceScore !== undefined) {
      branches = branches.filter(
        (b) =>
          b.relevanceScore !== undefined &&
          b.relevanceScore >= filter.minRelevanceScore!,
      );
    }

    // Apply sorting
    if (filter.sortBy) {
      const sortField = filter.sortBy;
      const sortDirection = filter.sortDirection || "desc";

      branches.sort((a, b) => {
        const aValue = a[sortField as keyof ExecutionBranch];
        const bValue = b[sortField as keyof ExecutionBranch];

        if (!aValue && !bValue) return 0;
        if (!aValue) return sortDirection === "asc" ? -1 : 1;
        if (!bValue) return sortDirection === "asc" ? 1 : -1;

        const comparison = aValue > bValue ? 1 : -1;
        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    // Apply pagination
    if (filter.offset || filter.limit) {
      const offset = filter.offset || 0;
      const limit = filter.limit || branches.length;
      branches = branches.slice(offset, offset + limit);
    }

    return branches;
  }

  /**
   * Delete branches by IDs
   */
  async deleteBranches(branchIds: string[]): Promise<string[]> {
    const deletedIds: string[] = [];

    for (const id of branchIds) {
      const branch = this.branchRecords.get(id);
      if (branch) {
        // Remove from branch records
        this.branchRecords.delete(id);

        // Remove from the parent execution record
        const execution = await this.getExecution(branch.executionId);
        if (execution && execution.branches) {
          execution.branches = execution.branches.filter((b) => b.id !== id);
          await this.updateExecution(execution);
        }

        deletedIds.push(id);
        console.log(`Deleted branch record: ${id}`);
      }
    }

    return deletedIds;
  }
}
