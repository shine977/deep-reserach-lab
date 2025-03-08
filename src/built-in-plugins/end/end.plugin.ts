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
} from "../../core/types/plugin.types";

export class EndPlugin implements NodePlugin {
  // Plugin metadata
  id = "end-plugin";
  name = "Workflow End";
  version = "1.0.0";
  description = "Marks the end of a workflow process";
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

  /**
   * Initialize the plugin
   */
  async initialize(context: PluginContext): Promise<void> {
    context.logger.info("End plugin initialized");
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
    context.logger.info(`Workflow end reached: ${context.nodeId}`);

    const result = {
      completed: true,
      result: input,
      ...(config.addTimestamp ? { timestamp: new Date().toISOString() } : {}),
    };

    return of(result);
  }
}
