/**
 * Workflow Compiler Service
 *
 * This service is responsible for compiling a workflow definition into an executable form.
 * It creates an RxJS operator chain that can be used to execute the workflow.
 */

import { OperatorFunction, Observable, of, throwError, concatMap } from "rxjs";
import { Workflow, ExecutableWorkflow } from "../../core/types/workflow.types";
import { NodePlugin, ExecutionContext } from "../../core/types/plugin.types";
import { PluginRegistry } from "../../plugin-system/services/plugin-registry.service";
import { ApplicationLogger } from "../../shared";

export class WorkflowCompiler {
  logger = new ApplicationLogger(WorkflowCompiler.name);
  constructor(private pluginRegistry: PluginRegistry) {}

  /**
   * Compile a workflow into an executable form
   */
  compile(workflow: Workflow): ExecutableWorkflow {
    // Determine execution order (topological sort)
    const nodeOrder = this.determineNodeOrder(workflow);

    // Create the operator chain
    const operatorChain = this.createOperatorChain(workflow, nodeOrder);

    return {
      original: workflow,
      operatorChain,
      nodeOrder,
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
            // Create execution context
            const context: ExecutionContext = {
              nodeId,
              executionId: "execution-" + Date.now(),
              logger: console,
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
