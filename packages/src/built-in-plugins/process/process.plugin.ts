/**
 * Process Plugin
 *
 * A generic processing node for workflow execution.
 * Provides basic data transformation capabilities.
 */

import { Observable, of } from "rxjs";
import {
  NodePlugin,
  PluginContext,
  ExecutionContext,
  JSONSchema,
} from "@delab/core";
import { Injectable } from "@delab/core/di";
import { Logger } from "@delab/shared";

@Injectable()
export class ProcessPlugin implements NodePlugin {
  logger = new Logger(ProcessPlugin.name);
  // Plugin metadata
  id = "process-plugin";
  name = "Process Node";
  version = "1.0.0";
  description = "Generic process node for workflow execution";
  nodeType = "process"; // This is important - matches the node type in workflow definition

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
      transform: {
        type: "string",
        enum: ["none", "uppercase", "lowercase", "trim", "json"],
        default: "none",
      },
      customFunction: {
        type: "string",
        description: "Custom JavaScript function as string (advanced)",
      },
    },
  };

  // Plugin lifecycle methods
  async initialize(context: PluginContext): Promise<void> {
    this.logger.info("Initializing process plugin");
  }

  async activate(): Promise<void> {
    console.log("Process plugin activated");
  }

  async deactivate(): Promise<void> {
    console.log("Process plugin deactivated");
  }

  // Process method
  process(input: any, config: any, context: ExecutionContext): Observable<any> {
    this.logger.info(`Processing data in process node`);

    // Apply transformation based on config
    const transformType = config?.transform || "none";
    let result = input.input; // Extract from input object

    try {
      // Apply standard transformations
      switch (transformType) {
        case "uppercase":
          result = typeof result === "string" ? result.toUpperCase() : result;
          break;
        case "lowercase":
          result = typeof result === "string" ? result.toLowerCase() : result;
          break;
        case "trim":
          result = typeof result === "string" ? result.trim() : result;
          break;
        case "json":
          // Convert to JSON string if not already a string
          result = typeof result !== "string" ? JSON.stringify(result) : result;
          break;
        case "none":
        default:
          // No transformation
          break;
      }

      // Apply custom function if provided (advanced use case)
      if (config?.customFunction) {
        try {
          // Create a function from the string (use with caution!)
          const customFn = new Function("data", config.customFunction);
          result = customFn(result);
        } catch (error: any) {
          this.logger.error(`Error in custom function: ${error.message}`);
        }
      }

      return of({ output: result });
    } catch (error: any) {
      this.logger.error(`Error processing data: ${error.message}`);
      return of({ error: error.message });
    }
  }
}
