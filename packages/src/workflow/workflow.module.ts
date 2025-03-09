// packages/src/workflow/workflow.module.ts
import { Module } from "@nestjs/common";
import { WorkflowCompiler } from "./services/workflow-compiler.service";
import { WorkflowExecutor } from "./services/workflow-executor.service";
import { WorkflowStreamService } from "./services/workflow-stream.service";
import { PluginSystemModule } from "../plugin-system/plugin-system.module";

@Module({
  imports: [PluginSystemModule],
  providers: [WorkflowCompiler, WorkflowExecutor, WorkflowStreamService],
  exports: [WorkflowCompiler, WorkflowExecutor, WorkflowStreamService],
})
export class WorkflowModule {}
