// packages/src/examples/nest-execution-example.ts
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { PluginRegistry } from "../plugin-system/services/plugin-registry.service";
import { ExecutionService } from "../execution/services/execution.service";
import { ExecutionMonitorService } from "../execution/services/execution-monitor.service";
import { BranchStatus } from "../execution/models/execution.types";
import { Workflow } from "../core/types/workflow.types";
import { Logger } from "../shared/logger";
import {
  StartPlugin,
  BranchPlugin,
  EndPlugin,
  ProcessPlugin,
  SearchPlugin,
  WebReaderPlugin,
  ReasoningPlugin,
  TokenBudgetPlugin,
} from "../built-in-plugins";
import { WorkflowCompiler } from "@packages/workflow";

// 在runNestExecutionExample函数开始处添加
console.log(
  "PluginRegistry构造函数:",
  PluginRegistry.toString().match(/constructor\s*\(([^)]*)\)/)?.[1] ||
    "No constructor",
);

console.log(
  "WorkflowCompiler构造函数:",
  WorkflowCompiler.toString().match(/constructor\s*\(([^)]*)\)/)?.[1] ||
    "No constructor",
);

/**
 * Main function to run the NestJS execution example
 * This demonstrates how to execute, monitor, and manage workflow executions
 * within a NestJS dependency injection context
 */
async function runNestExecutionExample() {
  console.log("========================================");
  console.log("Running NestJS Execution Module Example...");
  console.log("========================================");

  // Create NestJS application instance
  const app = await NestFactory.createApplicationContext(AppModule);
  // Retrieve required services from NestJS container
  const pluginRegistry = app.get(PluginRegistry);
  const executionService = app.get(ExecutionService);
  const monitorService = app.get(ExecutionMonitorService);

  // Initialize logger

  // Create plugin context
  const context = {
    services: {
      getService<T>(serviceId: string): T | undefined {
        if (serviceId === "executionService") {
          return executionService as T;
        }
        return undefined;
      },
    },
  };

  // Get plugins from NestJS container
  const plugins = [
    app.get(SearchPlugin),
    app.get(WebReaderPlugin),
    app.get(ReasoningPlugin),
    app.get(TokenBudgetPlugin),
    app.get(EndPlugin),
    app.get(ProcessPlugin),
    app.get(BranchPlugin),
    app.get(StartPlugin),
  ];

  // Initialize and register plugins
  for (const plugin of plugins) {
    await plugin.initialize(context);
    pluginRegistry.registerPlugin(plugin);
    await plugin.activate();
    console.log(`Registered plugin: ${plugin.metadata.name}`);
  }

  // Define sample workflow
  const workflow: Workflow = {
    id: "example-workflow",
    name: "Example Workflow",
    nodes: [
      {
        id: "start",
        type: "start",
        name: "Start",
        config: {
          next: ["branch-node"],
        },
      },
      {
        id: "branch-node",
        type: "branch",
        name: "Branch Node",
        config: {
          next: ["process-node"],
          branches: [
            { id: "branch1", name: "High Priority Branch", priority: 10 },
            { id: "branch2", name: "Medium Priority Branch", priority: 5 },
            { id: "branch3", name: "Low Priority Branch", priority: 1 },
          ],
        },
      },
      {
        id: "process-node",
        type: "process",
        name: "Process Data",
        config: {
          processingTime: 1000,
          next: ["end"],
        },
      },
      {
        id: "end",
        type: "end",
        name: "End",
        config: {},
      },
    ],
    connections: [],
  };

  try {
    // Example 1: Execute a workflow with monitoring
    console.log("\n1. Executing workflow with standard options");

    const execution$ = executionService.executeWorkflow(
      workflow,
      { input: "test-input" },
      {
        enableBranching: true,
        maxBranches: 10,
        tags: ["example", "demo"],
        userId: "user-123",
      },
    );

    // Track the execution ID for later reference
    let executionId: string;

    // Setup progress monitoring
    execution$.subscribe({
      next: (record: any) => {
        executionId = record.id;
        console.log(`Execution started with ID: ${record.branchId}`);

        // Monitor progress
        executionService.getExecutionProgress(record.id).subscribe({
          next: (progress: any) =>
            console.log(
              `Progress: ${progress.progress}% | Status: ${progress.status} | ` +
                `Active branches: ${progress.activeBranches || 0}, ` +
                `Completed branches: ${progress.completedBranches || 0} ${record.completedBranchCount} ${record.status}`,
            ),
          error: (err) => console.error("Error monitoring progress:", err),
          complete: () => {
            console.log(
              "Execution completed with " +
                record.completedBranchCount +
                " branches, status: " +
                record.status,
            );
          },
        });

        // Monitor events
        executionService.getExecutionEvents(record.id).subscribe({
          next: (event) => {
            console.log("execution-example getExecutionEvents:", event);
            if (event.branchId) {
              console.log(
                `Branch event: ${event.type} - Branch: ${event.branchId}`,
              );
              executionService
                .getBranchEvents(executionId, event.branchId)
                .subscribe({
                  next: (branchEvent) => {
                    if (
                      branchEvent.type === "branch:start" &&
                      branchEvent.data?.name?.includes("Low Priority")
                    ) {
                      console.log(
                        `Canceling low priority branch: ${branchEvent.branchId}`,
                      );

                      setTimeout(async () => {
                        const canceled = await executionService.cancelBranch(
                          executionId,
                          event.branchId!,
                        );
                        console.log(
                          `Branch cancellation ${canceled ? "succeeded" : "failed"}`,
                        );
                      }, 500);
                    }
                  },
                  error: (err) =>
                    console.error("Error monitoring branch events:", err),
                  complete: () => console.log("Branch events completed"),
                });
              // Demonstration: Cancel a specific branch after it starts
            } else {
              console.log(
                `Execution event: ${event.type}${
                  event.nodeId ? ` - Node: ${event.nodeId}` : ""
                }`,
              );
            }
          },
          complete: () => {
            console.log(
              "execution-example getExecutionEvents Execution events completed",
            );
          },
        });
      },
      error: (err) => console.error("Execution error:", err),
      complete: () => console.log("Execution observable completed"),
    });

    // Wait for execution to complete (simulated)
    console.log("Waiting for execution to complete...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Example 2: List executions
    console.log("\n2. Listing executions");
    const executions = await executionService.listExecutions({
      limit: 10,
    });

    console.log(`Found ${executions.length} executions:`);
    executions.forEach((exec) => {
      console.log(
        `- ID: ${exec.id} | Status: ${exec.status} | Workflow: ${exec.workflowId}`,
      );
    });

    // Example 3: Cancel an execution (simulation)
    console.log("\n3. Canceling an execution");
    const cancelSuccess = await executionService.cancelExecution(
      executions[0].id,
    );
    console.log(`Cancellation ${cancelSuccess ? "successful" : "failed"}`);
    // Example 4: Execute with different options
    console.log("\n4. Executing workflow with high priority");
    const priorityExecution$ = executionService.executeWorkflow(
      workflow,
      { input: "test-input" },
      {
        priority: 10,
        enableBranching: true,
        maxBranches: 10,
        tags: ["high-priority", "demo"],
        userId: "user-123",
        metadata: { source: "example", importance: "high" },
      },
    );

    let priorityExecutionId: string;
    priorityExecution$.subscribe({
      next: (record) => {
        priorityExecutionId = record.id;
        console.log(`High priority execution started with ID: ${record.id}`);
      },
    });

    // Wait for some time
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Example 5: Get execution metrics
    console.log("\n5. Getting execution metrics");
    try {
      const metrics = await monitorService.collectExecutionMetrics(
        executions[0].id,
      );
      console.log("Execution metrics:", {
        executionId: metrics.executionId,
        duration: `${metrics.duration}ms`,
        tokenUsage: metrics.tokenUsage.total,
        completedNodes: metrics.completedNodes,
        failedNodes: metrics.failedNodes,
      });
    } catch (err) {
      console.error("Error getting metrics:", err);
    }

    console.log("\nExecution Example Completed");

    // Close NestJS application
    await app.close();
  } catch (error) {
    console.error("Error in execution example:", error);
    // Ensure NestJS application is closed on error
    await app.close();
  }
}

// Run the example
runNestExecutionExample().catch(console.error);

export { runNestExecutionExample };
