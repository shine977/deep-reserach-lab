/**
 * End Plugin
 *
 * This plugin represents the end of a workflow.
 * It serves as a terminator node that indicates the workflow has completed.
 */

import { Observable, of } from "rxjs";
import {
  NodePlugin,
  PluginContext,
  ExecutionContext,
  JSONSchema,
  PluginMetadata,
} from "@packages/core/types/plugin.types";
import { Inject, Injectable } from "@nestjs/common";
import { Logger } from "@packages/shared";
import { ExecutionService } from "@packages/execution";

@Injectable()
export class EndPlugin implements NodePlugin {
  logger = new Logger(EndPlugin.name);

  // Plugin metadata
  metadata: PluginMetadata = {
    id: "end-plugin",
    name: "Workflow End",
    version: "1.0.0",
    description: "Marks the end of a workflow process",
  };
  nodeType = "end";
  // Schema definitions
  inputSchema: JSONSchema = {
    type: "object",
    properties: {
      result: { type: "any" }, // Accept any input
    },
  };

  outputSchema: JSONSchema = {
    type: "object",
    properties: {
      completed: { type: "boolean" },
      result: { type: "any" },
    },
  };

  configSchema: JSONSchema = {
    type: "object",
    properties: {
      addTimestamp: {
        type: "boolean",
        description: "Add timestamp to the result",
      },
    },
  };
  constructor(
    @Inject()
    private executionService: ExecutionService,
  ) {
    console.log("enplugin~~~~~this.executionService", this.executionService);
  }
  /**
   * Initialize the plugin
   */
  async initialize(context: PluginContext): Promise<void> {
    this.logger.info("End plugin initialized");
  }

  /**
   * Activate the plugin
   */
  async activate(): Promise<void> {
    // Nothing to do here
  }

  /**
   * Deactivate the plugin
   */
  async deactivate(): Promise<void> {
    // Nothing to do here
  }

  /**
   * Process the input
   * Simply marks the workflow as completed and passes through any data
   */
  process(
    input: any,
    config: { addTimestamp?: boolean } = {},
    context: ExecutionContext,
  ): Observable<any> {
    this.logger.info(`Workflow end reached: ${context.nodeId}`);
    this.logger.info(
      `process method execute: ${context.executionId}:${context.branchId}`,
    );
    // complete the branch
    if (context.executionId && context.branchId) {
      this.logger.info(
        `Completing branch: ${context.branchId} for execution: ${context.executionId}`,
      );
      this.executionService.emitExecutionEvent(
        context.executionId,
        "branch:complete",
        { branchId: context.branchId, result: input },
      );
    } else {
      this.logger.warn(
        `Cannot complete branch: executionId or branchId is missing.`,
      );
    }
    return of({
      completed: true,
      result: input,
      ...(config.addTimestamp ? { timestamp: new Date().toISOString() } : {}),
    });
  }
}
