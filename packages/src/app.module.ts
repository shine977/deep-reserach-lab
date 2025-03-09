// packages/src/app.module.ts
import { Module } from "@nestjs/common";
import { PluginRegistry } from "./plugin-system/services/plugin-registry.service";
import { WorkflowCompiler } from "./workflow/services/workflow-compiler.service";
import { WorkflowExecutor } from "./workflow/services/workflow-executor.service";
import { WorkflowStreamService } from "./workflow/services/workflow-stream.service";
import { ExecutionStorageService } from "./execution/services/execution-storage.service";
import { ExecutionMonitorService } from "./execution/services/execution-monitor.service";
import { ExecutionService } from "./execution/services/execution.service";
import {
  StartPlugin,
  BranchPlugin,
  EndPlugin,
  ProcessPlugin,
  SearchPlugin,
  WebReaderPlugin,
  ReasoningPlugin,
  TokenBudgetPlugin,
} from "./built-in-plugins";
import { PluginSystemModule } from "./plugin-system/plugin-system.module";
import { WorkflowModule } from "./workflow/workflow.module";

/**
 * Main application module
 *
 * This module provides all services and plugins needed for the workflow
 * execution system, leveraging NestJS dependency injection.
 */
@Module({
  imports: [PluginSystemModule, WorkflowModule],
  providers: [
    // Core services

    ExecutionStorageService,
    ExecutionMonitorService,
    ExecutionService,

    // Plugins
    StartPlugin,
    BranchPlugin,
    EndPlugin,
    ProcessPlugin,
    SearchPlugin,
    WebReaderPlugin,
    ReasoningPlugin,
    TokenBudgetPlugin,
  ],
  exports: [
    // Export all services and plugins for external access

    ExecutionStorageService,
    ExecutionMonitorService,
    ExecutionService,

    StartPlugin,
    BranchPlugin,
    EndPlugin,
    ProcessPlugin,
    SearchPlugin,
    WebReaderPlugin,
    ReasoningPlugin,
    TokenBudgetPlugin,
  ],
})
export class AppModule {}
