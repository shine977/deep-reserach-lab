/**
 * Workflow Executor Service
 * 
 * This service is responsible for executing workflows.
 * It uses the WorkflowCompiler to compile the workflow and then executes it.
 */

import { Observable, of, catchError, map, finalize } from 'rxjs';
import { Workflow, WorkflowResult, WorkflowExecutionState } from '../../core/types/workflow.types';
import { WorkflowCompiler } from './workflow-compiler.service';
import { v4 as uuidv4 } from 'uuid';

export class WorkflowExecutor {
  private executionStates: Map<string, WorkflowExecutionState> = new Map();
  
  constructor(private compiler: WorkflowCompiler) {}
  
  /**
   * Execute a workflow with the given input
   */
  execute(workflow: Workflow, initialInput: any): Observable<WorkflowResult> {
    // Generate execution ID
    const executionId = uuidv4();
    
    // Create execution state
    const state: WorkflowExecutionState = {
      id: executionId,
      workflowId: workflow.id,
      status: 'running',
      progress: 0,
      startTime: new Date()
    };
    
    // Store execution state
    this.executionStates.set(executionId, state);
    
    console.log(`Starting workflow execution: ${workflow.name} (ID: ${executionId})`);
    console.log(`Initial input:`, initialInput);
    
    // Compile the workflow
    try {
      const executableWorkflow = this.compiler.compile(workflow);
      
      // Create initial observable
      return of(initialInput).pipe(
        // Apply workflow operators
        executableWorkflow.operatorChain,
        
        // Update progress as workflow executes
        map((result, index) => {
          const progress = 100;
          this.updateExecutionState(executionId, { 
            status: 'completed',
            progress,
            result,
            endTime: new Date()
          });
          return result;
        }),
        
        // Map to result
        map(finalOutput => ({
          status: 'completed',
          result: finalOutput
        } as WorkflowResult)),
        
        // Handle errors
        catchError(error => {
          console.error('Workflow execution failed:', error);
          
          this.updateExecutionState(executionId, { 
            status: 'failed',
            error,
            endTime: new Date()
          });
          
          return of({
            status: 'failed',
            error
          } as WorkflowResult);
        }),
        
        // Clean up when done
        finalize(() => {
          console.log(`Workflow execution finished: ${executionId}`);
        })
      );
    } catch (error) {
      console.error('Failed to compile workflow:', error);
      
      this.updateExecutionState(executionId, { 
        status: 'failed',
        error: error as Error,
        endTime: new Date()
      });
      
      return of({
        status: 'failed',
        error: error as Error
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
  private updateExecutionState(executionId: string, updates: Partial<WorkflowExecutionState>): void {
    const state = this.executionStates.get(executionId);
    if (!state) return;
    
    this.executionStates.set(executionId, { ...state, ...updates });
  }
}