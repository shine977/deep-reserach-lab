/**
 * Plugin System Type Definitions
 *
 * This file contains the core type definitions for the plugin system.
 * It defines interfaces for plugins, plugin context, and related types.
 */

import { ApplicationLogger } from "@deep-research-lab/shared";
import { Observable } from "rxjs";

// Plugin metadata
export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
}

// Plugin context - provided to plugins during execution
export interface PluginContext {
  logger: ApplicationLogger;
  services: ServiceRegistry;
}
// Service registry interface
export interface ServiceRegistry {
  getService<T>(serviceId: string): T | undefined;
}

// Plugin execution context
export interface ExecutionContext extends PluginContext {
  nodeId: string;
  executionId: string;
  branchId?: string;
}

// JSON Schema type (simplified)
export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  [key: string]: any;
}

// Base Plugin interface
export interface Plugin {
  // Metadata
  id: string;
  name: string;
  version: string;
  description: string;

  // Lifecycle methods
  initialize(context: PluginContext): Promise<void>;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
}

// Node Plugin interface
export interface NodePlugin extends Plugin {
  // Node type
  nodeType: string;

  // Schema definitions
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  configSchema: JSONSchema;

  // Process method
  process(input: any, config: any, context: ExecutionContext): Observable<any>;
}

// Method definition
export interface Method {
  (params: any, context: ExecutionContext): Promise<any>;
}

// Plugin validation result
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
