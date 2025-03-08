/**
 * Simple Example
 * 
 * This file contains a simple example of using the DeepSearch system.
 * It shows how to register plugins, define a workflow, and execute it.
 */

import { PluginRegistry } from '../plugin-system/services/plugin-registry.service';
import { WorkflowCompiler } from '../workflow/services/workflow-compiler.service';
import { WorkflowExecutor } from '../workflow/services/workflow-executor.service';
import { Workflow } from '../core/types/workflow.types';

import { SearchPlugin } from '../built-in-plugins/search/search.plugin';
import { WebReaderPlugin } from '../built-in-plugins/web-reader/web-reader.plugin';
import { ReasoningPlugin } from '../built-in-plugins/reasoning/reasoning.plugin';
import { TokenBudgetPlugin } from '../built-in-plugins/token-budget/token-budget.plugin';

// Simple console logger
const logger = {
  info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
  debug: (message: string, ...args: any[]) => console.debug(`[DEBUG] ${message}`, ...args)
};

async function runSimpleExample() {
  console.log('========================================');
  console.log('Running DeepSearch MVP Simple Example...');
  console.log('========================================');
  
  // Create plugin registry
  const pluginRegistry = new PluginRegistry();
  
  // Create plugins
  const searchPlugin = new SearchPlugin();
  const webReaderPlugin = new WebReaderPlugin();
  const reasoningPlugin = new ReasoningPlugin();
  const tokenBudgetPlugin = new TokenBudgetPlugin();
  
  // Initialize plugins with context
  const context = {
    logger,
    services: { getService: () => undefined }
  };
  
  logger.info('Initializing plugins...');
  await searchPlugin.initialize(context);
  await webReaderPlugin.initialize(context);
  await reasoningPlugin.initialize(context);
  await tokenBudgetPlugin.initialize(context);
  
  // Register plugins
  logger.info('Registering plugins...');
  const plugins = [searchPlugin, webReaderPlugin, reasoningPlugin, tokenBudgetPlugin];
  
  for (const plugin of plugins) {
    const result = pluginRegistry.registerPlugin(plugin);
    if (result.valid) {
      logger.info(`Successfully registered plugin: ${plugin.name}`);
    } else {
      logger.error(`Failed to register plugin ${plugin.name}:`, result.errors);
    }
  }
  
  // Create workflow compiler and executor
  const workflowCompiler = new WorkflowCompiler(pluginRegistry);
  const workflowExecutor = new WorkflowExecutor(workflowCompiler);
  
  // Define complex workflow with token budget
  const workflow: Workflow = {
    id: 'deep-search-workflow',
    name: 'DeepSearch Workflow',
    description: 'A workflow that searches, reads web content, reasons about it, and manages token budget',
    nodes: [
      {
        id: 'search-node',
        type: 'search',
        config: {
          resultLimit: 3,
          provider: 'mock'
        }
      },
      {
        id: 'web-reader-node',
        type: 'web-reader',
        config: {
          concurrency: 2,
          useMock: true
        }
      },
      {
        id: 'reasoning-node',
        type: 'reasoning',
        config: {
          model: 'mock',
          useMock: true,
          temperature: 0.7
        }
      },
      {
        id: 'token-budget-node',
        type: 'token-budget',
        config: {
          totalBudget: 100000,
          warningThreshold: 0.8
        }
      }
    ],
    connections: [
      {
        from: 'search-node',
        to: 'web-reader-node'
      },
      {
        from: 'web-reader-node',
        to: 'reasoning-node'
      },
      {
        from: 'reasoning-node',
        to: 'token-budget-node'
      }
    ]
  };
  
  // Get query from command line arguments or use default
  const query = process.argv[2] || 'What is the latest advancement in AI technology?';
  
  // Execute workflow
  logger.info(`Executing workflow with query: "${query}"`);
  const result$ = workflowExecutor.execute(workflow, { 
    query,
    operation: 'check' // for token budget plugin
  });
  
  // Subscribe to results
  return new Promise<void>((resolve, reject) => {
    result$.subscribe({
      next: result => {
        logger.info('Workflow execution completed successfully');
        logger.info('Final result:');
        console.log(JSON.stringify(result, null, 2));
        
        // Display token usage if available
        if (result.result && result.result.budget) {
          const budget = result.result.budget;
          logger.info(`Token Usage Summary: ${budget.used}/${budget.total} tokens used (${budget.remaining} remaining)`);
          
          logger.info('Token Usage Details:');
          for (const [source, tokens] of Object.entries(budget.details)) {
            logger.info(`- ${source}: ${tokens} tokens`);
          }
        }
        
        resolve();
      },
      error: error => {
        logger.error('Workflow execution failed:', error);
        reject(error);
      }
    });
  });
}

// Run the example if this file is executed directly
if (require.main === module) {
  runSimpleExample().catch(error => {
    console.error('Error running example:', error);
    process.exit(1);
  });
}

export { runSimpleExample };