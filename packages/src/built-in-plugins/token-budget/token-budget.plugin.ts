/**
 * Token Budget Plugin
 *
 * This plugin manages the token budget throughout the search process.
 * It tracks token usage and ensures the process stays within budget constraints.
 */

import { Observable } from "rxjs";
import {
  NodePlugin,
  PluginContext,
  ExecutionContext,
  JSONSchema,
  PluginMetadata,
} from "@packages/core/types/plugin.types";
import { Injectable } from "@nestjs/common";
import { Logger } from "@packages/shared";

export interface TokenUsage {
  total: number;
  remaining: number;
  used: number;
  details: Record<string, number>;
}

@Injectable()
export class TokenBudgetPlugin implements NodePlugin {
  logger = new Logger(TokenBudgetPlugin.name);
  // Plugin metadata
  metadata: PluginMetadata = {
    id: "token-budget-plugin",
    name: "Token Budget Manager",
    version: "1.0.0",
    description: "Manages token usage throughout the search process",
  };

  nodeType = "token-budget";

  // Schema definitions
  inputSchema: JSONSchema = {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["check", "update", "reset"],
      },
      tokensUsed: { type: "number" },
      source: { type: "string" },
    },
    required: ["operation"],
  };

  outputSchema: JSONSchema = {
    type: "object",
    properties: {
      budget: {
        type: "object",
        properties: {
          total: { type: "number" },
          remaining: { type: "number" },
          used: { type: "number" },
          details: {
            type: "object",
            additionalProperties: { type: "number" },
          },
        },
      },
      exceedsBudget: { type: "boolean" },
    },
  };

  configSchema: JSONSchema = {
    type: "object",
    properties: {
      totalBudget: {
        type: "number",
        default: 100000,
      },
      warningThreshold: {
        type: "number",
        default: 0.8,
      },
    },
  };

  private budget: TokenUsage = {
    total: 100000,
    remaining: 100000,
    used: 0,
    details: {},
  };

  // Plugin lifecycle methods
  async initialize(context: PluginContext): Promise<void> {
    this.logger.info("Initializing token budget plugin");
  }

  async activate(): Promise<void> {
    console.log("Token budget plugin activated");
  }

  async deactivate(): Promise<void> {
    console.log("Token budget plugin deactivated");
  }

  // Process method
  process(input: any, config: any, context: ExecutionContext): Observable<any> {
    const operation = input.operation;
    const totalBudget = config.totalBudget || 100000;

    // Initialize budget if needed
    if (this.budget.total !== totalBudget) {
      this.budget = {
        total: totalBudget,
        remaining: totalBudget,
        used: 0,
        details: {},
      };
    }

    return new Observable((observer) => {
      switch (operation) {
        case "update":
          this.updateBudget(input.tokensUsed || 0, input.source || "unknown");
          break;

        case "reset":
          this.resetBudget(totalBudget);
          break;

        case "check":
        default:
          // No action needed for check
          break;
      }

      const exceedsBudget = this.budget.remaining <= 0;

      if (exceedsBudget) {
        this.logger.warn("Token budget exceeded!");
      } else if (
        this.budget.remaining <
        this.budget.total * (config.warningThreshold || 0.8)
      ) {
        this.logger.warn(
          `Token budget running low: ${this.budget.remaining} tokens remaining`,
        );
      }

      observer.next({
        budget: { ...this.budget },
        exceedsBudget,
      });

      observer.complete();
    });
  }

  // Update the token budget
  private updateBudget(tokensUsed: number, source: string): void {
    // Update total used
    this.budget.used += tokensUsed;
    this.budget.remaining = Math.max(0, this.budget.total - this.budget.used);

    // Update source details
    this.budget.details[source] =
      (this.budget.details[source] || 0) + tokensUsed;
  }

  // Reset the token budget
  private resetBudget(totalBudget: number): void {
    this.budget = {
      total: totalBudget,
      remaining: totalBudget,
      used: 0,
      details: {},
    };
  }
}
