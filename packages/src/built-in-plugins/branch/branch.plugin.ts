/**
 * Branch Plugin
 *
 * Provides conditional branching capability in workflows.
 * Evaluates conditions and directs execution flow accordingly.
 */

import { Observable, of } from "rxjs";
import {
  NodePlugin,
  PluginContext,
  ExecutionContext,
  JSONSchema,
} from "../../core/types/plugin.types";
import { Injectable } from "@delab/core/di";
import { Logger } from "@delab/shared";

@Injectable()
export class BranchPlugin implements NodePlugin {
  logger = new Logger(BranchPlugin.name);
  // Plugin metadata
  id = "branch-plugin";
  name = "Conditional Branch";
  version = "1.0.0";
  description = "Evaluates conditions and directs workflow execution flow";
  nodeType = "branch"; // This is important - matches the node type in workflow definition

  // Schema definitions
  inputSchema: JSONSchema = {
    type: "object",
    properties: {
      value: { type: "any" },
    },
  };

  outputSchema: JSONSchema = {
    type: "object",
    properties: {
      path: { type: "string" },
      value: { type: "any" },
    },
  };

  configSchema: JSONSchema = {
    type: "object",
    properties: {
      conditions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            path: { type: "string" },
            condition: {
              type: "string",
              description: "JavaScript expression returning boolean",
            },
          },
          required: ["path", "condition"],
        },
      },
      defaultPath: {
        type: "string",
        default: "default",
      },
    },
    required: ["conditions"],
  };

  // Plugin lifecycle methods
  async initialize(context: PluginContext): Promise<void> {
    this.logger.info("Initializing branch plugin");
  }

  async activate(): Promise<void> {
    console.log("Branch plugin activated");
  }

  async deactivate(): Promise<void> {
    console.log("Branch plugin deactivated");
  }

  // Process method
  process(input: any, config: any, context: ExecutionContext): Observable<any> {
    this.logger.info(`Processing branch decision`);

    try {
      // Get the input value to evaluate
      const value = input.value;

      // Check if conditions are defined
      if (
        !config.conditions ||
        !Array.isArray(config.conditions) ||
        config.conditions.length === 0
      ) {
        this.logger.warn("No conditions defined for branch node");
        return of({
          path: config.defaultPath || "default",
          value,
        });
      }

      // Evaluate each condition in order
      for (const condition of config.conditions) {
        try {
          // Create a function from the condition string
          const conditionFn = new Function(
            "value",
            `return ${condition.condition}`,
          );
          const result = conditionFn(value);

          if (result) {
            this.logger.info(
              `Branch condition satisfied: taking path "${condition.path}"`,
            );
            return of({
              path: condition.path,
              value,
            });
          }
        } catch (error: any) {
          this.logger.error(`Error evaluating condition: ${error.message}`);
        }
      }

      // If no condition matched, use default path
      this.logger.info(
        `No branch conditions matched: taking default path "${config.defaultPath || "default"}"`,
      );
      return of({
        path: config.defaultPath || "default",
        value,
      });
    } catch (error: any) {
      this.logger.error(`Error in branch processing: ${error.message}`);
      return of({
        path: "error",
        error: error.message,
        value: input.value,
      });
    }
  }
}
