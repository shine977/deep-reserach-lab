/**
 * Workflow Compiler Service
 *
 * This service is responsible for compiling a workflow definition into an executable form.
 * It creates an RxJS operator chain that can be used to execute the workflow.
 */

import { OperatorFunction, Observable, of, throwError, concatMap } from "rxjs";
import {
  Workflow,
  ExecutableWorkflow,
  NodePlugin,
  ExecutionContext,
  WorkflowCompileOptions,
} from "@deep-research-lab/core";
import { PluginRegistry } from "@deep-research-lab/plugin-system";
import { ApplicationLogger, appLogger } from "@deep-research-lab/shared";
import { Injectable } from "@deep-research-lab/core/di";

@Injectable()
export class WorkflowCompiler {
  logger = new ApplicationLogger(WorkflowCompiler.name);
  constructor(private pluginRegistry: PluginRegistry) {}

  /**
   * Compile a workflow into an executable form
   * @param workflow The workflow to compile
   * @param options Optional compilation options including executionId and branchId
   */
  compile(
    workflow: Workflow,
    options?: WorkflowCompileOptions,
  ): ExecutableWorkflow {
    // Determine execution order (topological sort)
    const nodeOrder = this.determineNodeOrder(workflow);

    // Create operator chain for execution
    const operatorChain = this.createOperatorChain(
      workflow,
      nodeOrder,
      options,
    );

    // Return executable workflow
    return {
      original: workflow,
      operatorChain,
      nodeOrder,
      ...(options || {}), // Include any passed options in the result
    };
  }

  /**
   * Determine the execution order of nodes using topological sort
   */
  private determineNodeOrder(workflow: Workflow): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    // Create adjacency list
    const graph: Record<string, string[]> = {};
    for (const node of workflow.nodes) {
      graph[node.id] = [];
    }

    for (const conn of workflow.connections) {
      graph[conn.from].push(conn.to);
    }

    // Helper function for DFS
    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return;

      visited.add(nodeId);

      for (const neighbor of graph[nodeId] || []) {
        visit(neighbor);
      }

      result.unshift(nodeId);
    };

    // Visit all nodes
    for (const node of workflow.nodes) {
      visit(node.id);
    }

    return result;
  }

  /**
   * Create RxJS operator chain for executing the workflow
   */
  private createOperatorChain(
    workflow: Workflow,
    nodeOrder: string[],
    options?: WorkflowCompileOptions,
  ): OperatorFunction<any, any> {
    return (input$) => {
      let chain$ = input$;

      // Chain the operators for each node in order
      for (const nodeId of nodeOrder) {
        const node = workflow.nodes.find((n) => n.id === nodeId);
        if (!node) continue;

        const nodePlugin = this.pluginRegistry.getNodePlugin(node.type);
        if (!nodePlugin) {
          return throwError(() =>
            this.logger.error(
              `Plugin for node type "${node.type}" not found`,
              `nodeId:${nodeId}`,
            ),
          );
        }

        chain$ = chain$.pipe(
          concatMap((input) => {
            // Extract branchId from input if available (for branching workflows)
            const branchId =
              input && typeof input === "object" && input.branchId
                ? input.branchId
                : (options && options.branchId) || `branch-${Date.now()}`;
            // Create execution context
            const context: ExecutionContext = {
              nodeId,
              executionId:
                (options && options.executionId) || "execution-" + Date.now(),
              logger: appLogger,
              branchId: branchId,
              services: {
                getService: (serviceId: string) => undefined,
              },
            };

            // Process the input
            try {
              console.log(`Executing node: ${nodeId} (type: ${node.type})`);
              return nodePlugin.process(input, node.config, context);
            } catch (error) {
              console.error(`Error processing node ${nodeId}:`, error);
              return throwError(() => error);
            }
          }),
        );
      }

      return chain$;
    };
  }
}
