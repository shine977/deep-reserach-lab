/**
 * Workflow Executor Service
 *
 * This service is responsible for executing workflows.
 * It uses the WorkflowCompiler to compile the workflow and then executes it.
 */

import { Observable, of, catchError, map, finalize } from "rxjs";
import {
  Workflow,
  WorkflowResult,
  WorkflowExecutionState,
} from "@packages/core/types/workflow.types";
import { WorkflowCompiler } from "./workflow-compiler.service";
import { v4 as uuidv4 } from "uuid";
import { Inject, Injectable } from "@nestjs/common";

@Injectable()
export class WorkflowExecutor {
  private executionStates: Map<string, WorkflowExecutionState> = new Map();

  constructor(@Inject() private compiler: WorkflowCompiler) {}

  /**
   * Execute a workflow with the given input
   * @param workflow The workflow to execute
   * @param initialInput The initial input to the workflow
   * @param options Optional execution options
   * @returns An observable that emits the workflow result
   */
  execute(
    workflow: Workflow,
    initialInput: any,
    options?: {
      executionId?: string;
      branchId?: string;
      timeout?: number;
      maxTokens?: number;
      enableBranching?: boolean;
      maxBranches?: number;
    },
  ): Observable<WorkflowResult> {
    // Branching options
    const branchingOptions = {
      enableBranching: options?.enableBranching || false,
      maxBranches: options?.maxBranches || 10,
    };

    // Create execution ID or use provided one
    const executionId = options?.executionId || uuidv4();
    console.log(
      "execute~~~~~~~~~~~~~~~~~~~~~~~~~executionId",
      executionId,
      options,
    );
    // Create main branch ID or use provided one (if branching is enabled)
    const mainBranchId = branchingOptions.enableBranching
      ? options?.branchId || uuidv4()
      : "";
    console.log("execute~~~~~~~~~~~~~~~~~~~~~~~~~mainBranchId", mainBranchId);
    // Create execution state
    const state: WorkflowExecutionState = {
      id: executionId,
      workflowId: workflow.id,
      status: "running",
      progress: 0,
      startTime: new Date(),
    };

    // Store execution state
    this.executionStates.set(executionId, state);

    console.log(
      `Starting workflow execution: ${workflow.name} (ID: ${executionId})`,
    );
    console.log(`Initial input:`, initialInput);

    // Compile the workflow
    try {
      const executableWorkflow = this.compiler.compile(workflow, {
        executionId,
        branchId: mainBranchId,
      });

      // Create initial observable
      return of(initialInput).pipe(
        // Apply workflow operators
        executableWorkflow.operatorChain,

        // Update progress as workflow executes
        map((result, index) => {
          const progress = 100;
          this.updateExecutionState(executionId, {
            status: "completed",
            progress,
            result,
            endTime: new Date(),
          });
          return result;
        }),

        // Map to result
        map(
          (finalOutput) =>
            ({
              status: "completed",
              result: finalOutput,
            }) as WorkflowResult,
        ),

        // Handle errors
        catchError((error) => {
          console.error("Workflow execution failed:", error);

          this.updateExecutionState(executionId, {
            status: "failed",
            error,
            endTime: new Date(),
          });

          return of({
            status: "failed",
            error,
          } as WorkflowResult);
        }),

        // Clean up when done
        finalize(() => {
          console.log(`Workflow execution finished: ${executionId}`);
        }),
      );
    } catch (error) {
      console.error("Failed to compile workflow:", error);

      this.updateExecutionState(executionId, {
        status: "failed",
        error: error as Error,
        endTime: new Date(),
      });

      return of({
        status: "failed",
        error: error as Error,
      });
    }
  }

  /**
   * Get the current execution state
   */
  getExecutionState(executionId: string): WorkflowExecutionState | undefined {
    return this.executionStates.get(executionId);
  }

  /**
   * Update execution state
   */
  private updateExecutionState(
    executionId: string,
    updates: Partial<WorkflowExecutionState>,
  ): void {
    const state = this.executionStates.get(executionId);
    if (!state) return;

    this.executionStates.set(executionId, { ...state, ...updates });
  }
}
