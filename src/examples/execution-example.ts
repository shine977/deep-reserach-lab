/**
 * Execution Module Example
 *
 * This example demonstrates how to use the execution module
 * to execute, monitor, and manage workflow executions.
 */

import { WorkflowCompiler } from "../workflow/services/workflow-compiler.service";
import { WorkflowExecutor } from "../workflow/services/workflow-executor.service";
import { WorkflowStreamService } from "../workflow/services/workflow-stream.service";
import { PluginRegistry } from "../plugin-system/services/plugin-registry.service";
import { ExecutionStorageService } from "../execution/services/execution-storage.service";
import { ExecutionMonitorService } from "../execution/services/execution-monitor.service";
import {
  ExecutionStatus,
  ExecutionType,
} from "../execution/models/execution.types";

// Import built-in plugins
import { SearchPlugin } from "../built-in-plugins/search/search.plugin";
import { WebReaderPlugin } from "../built-in-plugins/web-reader/web-reader.plugin";
import { ReasoningPlugin } from "../built-in-plugins/reasoning/reasoning.plugin";
import { TokenBudgetPlugin } from "../built-in-plugins/token-budget/token-budget.plugin";
import { Workflow } from "../core/types/workflow.types";
import { ExecutionService } from "../execution/services/execution.service";
import { v4 as uuidv4 } from "uuid";
import { BranchStatus } from "../execution/models/execution.types";
import { EndPlugin } from "@deep-research-lab/built-in-plugins";

/**
 * Run the execution example
 */
async function runExecutionExample() {
  console.log("========================================");
  console.log("Running Execution Module Example...");
  console.log("========================================");

  // Create services
  const pluginRegistry = new PluginRegistry();
  const workflowCompiler = new WorkflowCompiler(pluginRegistry);
  const streamService = new WorkflowStreamService();
  const workflowExecutor = new WorkflowExecutor(workflowCompiler);
  const storageService = new ExecutionStorageService();
  const monitorService = new ExecutionMonitorService();

  // Create execution service
  const executionService = new ExecutionService(
    workflowExecutor,
    streamService,
    storageService,
    monitorService
  );

  // Register plugins
  const plugins = [
    new SearchPlugin(),
    new WebReaderPlugin(),
    new ReasoningPlugin(),
    new TokenBudgetPlugin(),
    new EndPlugin()
  ];

  // Initialize and register plugins
  const logger = console;
  const context = {
    logger,
    services: { getService: () => undefined },
  };

  for (const plugin of plugins) {
    await plugin.initialize(context);
    pluginRegistry.registerPlugin(plugin);
    await plugin.activate();
    console.log(`Registered plugin: ${plugin.name}`);
  }

  // Define a sample workflow
  const workflow: Workflow = {
    id: "example-workflow",
    name: "Example Workflow",
    nodes: [
      {
        id: "start",
        type: "start",
        name: "Start",
        config:{
            next: ["branch-node"],
        }
      },
      {
        id: "branch-node",
        type: "branch",
        name: "Branch Node",
        // This node will create multiple branches
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
          // Simulated processing that can be specific to each branch
          processingTime: 1000,
          next: ["end"],
        },
      },
      {
        id: "end",
        type: "end",
        name: "End",
        config:{}
      },
    ],
    connections:[],
    // createdAt: new Date(),
    // updatedAt: new Date(),
    // version: 1,
  };

  try {
    // Example 1: Execute a workflow with monitoring
    console.log("\n1. Executing workflow with standard options");

    // Subscribe to execution progress
    const execution$ = executionService.executeWorkflow(
      workflow,
      { input: "test-input" },
      {
        enableBranching: true,
        maxBranches: 10,
        tags: ["example", "demo"],
        userId: "user-123",
      }
    );

    // Track the execution ID for later reference
    let executionId: string;

    // First, setup progress monitoring
    execution$.subscribe({
      next: (record) => {
        executionId = record.id;
        console.log(`Execution started with ID: ${record.id}`);

        // Monitor progress
        executionService.getExecutionProgress(record.id).subscribe({
          next: (progress) =>
            console.log(
              `Progress: ${progress.progress}% | Status: ${progress.status} | ` +
                `Active branches: ${progress.activeBranches || 0}, ` +
                `Completed branches: ${progress.completedBranches || 0}`
            ),
          error: (err) => console.error("Error monitoring progress:", err),
        });

        // Monitor events
        executionService.getExecutionEvents(record.id).subscribe({
          next: (event) => {
            if (event.branchId) {
              console.log(
                `Branch event: ${event.type} - Branch: ${event.branchId}`
              );

              // Demonstration: Cancel a specific branch after it starts
              if (
                event.type === "branch:start" &&
                event.data?.name?.includes("Low Priority")
              ) {
                console.log(`Canceling low priority branch: ${event.branchId}`);

                setTimeout(async () => {
                  const canceled = await executionService.cancelBranch(
                    executionId,
                    event.branchId!
                  );
                  console.log(
                    `Branch cancellation ${canceled ? "succeeded" : "failed"}`
                  );
                }, 500);
              }
            } else {
              console.log(
                `Execution event: ${event.type}${
                  event.nodeId ? ` - Node: ${event.nodeId}` : ""
                }`
              );
            }
          },
          complete: () => {
            console.log("Execution events completed");
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
      //   sortBy: 'createdAt',
      //   sortDirection: 'desc'
    });

    console.log(`Found ${executions.length} executions:`);
    executions.forEach((exec) => {
      console.log(
        `- ID: ${exec.id} | Status: ${exec.status} | Workflow: ${exec.workflowId}`
      );
    });

    // Example 3: Cancel an execution (simulation)
    console.log("\n3. Canceling an execution");
    const cancelSuccess = await executionService.cancelExecution(
      executions[0].id
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
      }
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
        executions[0].id
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

    // Example 6: Get execution by ID
    console.log("\n6. Getting execution by ID");
    const execution = await executionService.getExecution(executions[0].id);
    if (!execution) {
      console.log("Execution not found");
      return;
    }
    console.log("Execution details:", {
      id: execution.id,
      status: execution.status,
      startedAt: execution.startedAt,
      finishedAt: execution.finishedAt,
      tokenUsage: execution.tokenUsage?.total || 0,
    });
    // Use the confirmed executions[0].id instead of potentially undefined executionId
    const currentExecutionId = executions[0].id;
    // Get all branches
    const branches = await executionService.listBranches(currentExecutionId);
    console.log(`Total branches: ${branches.length}`);

    // Display branch results
    for (const branch of branches) {
      console.log(
        `Branch: ${branch.name} (${branch.id}), Status: ${branch.status}`
      );
    }

    // Filter completed branches
    const completedBranches = await executionService.listBranches(currentExecutionId, {
      status: [BranchStatus.COMPLETED],
    });
    console.log(`Completed branches: ${completedBranches.length}`);

    // Filter canceled branches
    const canceledBranches = await executionService.listBranches(currentExecutionId, {
      status: [BranchStatus.CANCELED],
    });
    console.log(`Canceled branches: ${canceledBranches.length}`);
  } catch (error) {
    console.error("Error in execution example:", error);
  }

  console.log("\nExecution Example Completed");
}

// Run the example
runExecutionExample().catch(console.error);

// Export for import in other files
export { runExecutionExample };
