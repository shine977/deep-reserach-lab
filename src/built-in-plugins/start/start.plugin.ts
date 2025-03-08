/**
 * Start Plugin
 *
 * Serves as the entry point for workflow execution.
 * Handles initialization and prepares the initial data for workflow.
 */

import { Observable, of } from "rxjs";
import {
  NodePlugin,
  PluginContext,
  ExecutionContext,
  JSONSchema,
} from "../../core/types/plugin.types";
import { Injectable } from "@deep-research-lab/core/di";

@Injectable()
export class StartPlugin implements NodePlugin {
  // Plugin metadata
  id = "start-plugin";
  name = "Workflow Start";
  version = "1.0.0";
  description = "Serves as the entry point for workflow execution";
  nodeType = "start"; // This matches the node type in workflow definition

  // Schema definitions
  inputSchema: JSONSchema = {
    type: "object",
    properties: {
      input: { type: "any" },
    },
  };

  outputSchema: JSONSchema = {
    type: "object",
    properties: {
      output: { type: "any" },
    },
  };

  configSchema: JSONSchema = {
    type: "object",
    properties: {
      initialTransform: {
        type: "string",
        enum: ["none", "stringify", "parse"],
        default: "none",
      },
      metadata: {
        type: "object",
        description: "Optional metadata to include with workflow output",
      },
    },
  };

  // Plugin lifecycle methods
  async initialize(context: PluginContext): Promise<void> {
    context.logger.info("Initializing start plugin");
  }

  async activate(): Promise<void> {
    console.log("Start plugin activated");
  }

  async deactivate(): Promise<void> {
    console.log("Start plugin deactivated");
  }

  // Process method
  process(input: any, config: any, context: ExecutionContext): Observable<any> {
    context.logger.info(`Starting workflow execution`);

    try {
      // Apply initial transformation if configured
      let result = input.input;

      if (config?.initialTransform) {
        switch (config.initialTransform) {
          case "stringify":
            // Convert to JSON string
            result =
              typeof result !== "string" ? JSON.stringify(result) : result;
            break;
          case "parse":
            // Parse from JSON string if it's a string
            result = typeof result === "string" ? JSON.parse(result) : result;
            break;
          case "none":
          default:
            // No transformation
            break;
        }
      }

      // Add metadata if provided
      const output = { output: result };
      if (config?.metadata) {
        Object.assign(output, { metadata: config.metadata });
      }

      return of(output);
    } catch (error: any) {
      context.logger.error(`Error in workflow start: ${error.message}`);
      return of({ error: error.message });
    }
  }
}
