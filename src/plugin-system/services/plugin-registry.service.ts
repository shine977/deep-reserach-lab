/**
 * Plugin Registry Service
 *
 * This service is responsible for registering and managing plugins.
 * It maintains a registry of all available plugins and provides methods to access them.
 */

import {
  Plugin,
  NodePlugin,
  ValidationResult,
} from "../../core/types/plugin.types";

export class PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();
  private nodePlugins: Map<string, NodePlugin> = new Map();

  /**
   * Register a plugin with the system
   */
  registerPlugin(plugin: Plugin): ValidationResult {
    // Validate plugin
    const validationResult = this.validatePlugin(plugin);
    if (!validationResult.valid) {
      return validationResult;
    }

    // Store plugin
    this.plugins.set(plugin.id, plugin);

    // If it's a node plugin, store it in the node plugins map
    if (this.isNodePlugin(plugin)) {
      this.nodePlugins.set(
        (plugin as NodePlugin).nodeType,
        plugin as NodePlugin,
      );
    }

    return { valid: true, errors: [] };
  }

  /**
   * Get a plugin by its ID
   */
  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get a node plugin by its type
   */
  getNodePlugin(nodeType: string): NodePlugin | undefined {
    return this.nodePlugins.get(nodeType);
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get all registered node plugins
   */
  getAllNodePlugins(): NodePlugin[] {
    return Array.from(this.nodePlugins.values());
  }

  /**
   * Unregister a plugin
   */
  unregisterPlugin(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return false;
    }

    this.plugins.delete(pluginId);

    if (this.isNodePlugin(plugin)) {
      const nodePlugin = plugin as NodePlugin;
      this.nodePlugins.delete(nodePlugin.nodeType);
    }

    return true;
  }

  /**
   * Check if a plugin is a node plugin
   */
  private isNodePlugin(plugin: Plugin): boolean {
    return "nodeType" in plugin && "process" in plugin;
  }

  /**
   * Validate a plugin
   */
  private validatePlugin(plugin: Plugin): ValidationResult {
    const errors: string[] = [];

    // Check required fields
    if (!plugin.id) errors.push("Plugin ID is required");
    if (!plugin.name) errors.push("Plugin name is required");
    if (!plugin.version) errors.push("Plugin version is required");

    // Check for duplicate IDs
    if (this.plugins.has(plugin.id)) {
      errors.push(`Plugin with ID "${plugin.id}" is already registered`);
    }

    // Additional validation for node plugins
    if (this.isNodePlugin(plugin)) {
      const nodePlugin = plugin as NodePlugin;

      if (!nodePlugin.nodeType) {
        errors.push("Node plugin must have a nodeType");
      }

      if (!nodePlugin.inputSchema) {
        errors.push("Node plugin must have an inputSchema");
      }

      if (!nodePlugin.outputSchema) {
        errors.push("Node plugin must have an outputSchema");
      }

      if (!nodePlugin.process || typeof nodePlugin.process !== "function") {
        errors.push("Node plugin must have a process method");
      }

      // Check for duplicate node types
      if (nodePlugin.nodeType && this.nodePlugins.has(nodePlugin.nodeType)) {
        errors.push(
          `Node plugin with type "${nodePlugin.nodeType}" is already registered`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
