/**
 * DeepSearch System Main Entry Point
 * 
 * This file serves as the main entry point for the DeepSearch system.
 * It integrates all the plugins and workflow system to provide a complete
 * search-read-reason workflow.
 */

import { PluginRegistry } from './plugin-system/services/plugin-registry.service';
import { WorkflowCompiler } from './workflow/services/workflow-compiler.service';
import { WorkflowExecutor } from './workflow/services/workflow-executor.service';
import { Workflow } from './core/types/workflow.types';

// Import built-in plugins
import { SearchPlugin } from './built-in-plugins/search/search.plugin';
import { WebReaderPlugin } from './built-in-plugins/web-reader/web-reader.plugin';
import { ReasoningPlugin } from './built-in-plugins/reasoning/reasoning.plugin';
import { TokenBudgetPlugin } from './built-in-plugins/token-budget/token-budget.plugin';
import { EndPlugin } from './built-in-plugins';

// Simple console logger
const logger = {
  info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
  debug: (message: string, ...args: any[]) => console.debug(`[DEBUG] ${message}`, ...args)
};

/**
 * Define the default workflow
 */
function createDefaultWorkflow(): Workflow {
  return {
    id: 'default-deep-search-workflow',
    name: 'Default DeepSearch Workflow',
    description: 'A workflow that searches, reads web content, reasons about it, and manages token budget',
    nodes: [
      {
        id: 'search-node',
        type: 'search',
        config: {
          resultLimit: 5,
          provider: 'mock' // Use 'jina' for real search
        }
      },
      {
        id: 'web-reader-node',
        type: 'web-reader',
        config: {
          concurrency: 3,
          useMock: true // Set to false for real web reading
        }
      },
      {
        id: 'reasoning-node',
        type: 'reasoning',
        config: {
          model: 'mock', // Use 'gemini' or 'openai' for real reasoning
          useMock: true, // Set to false for real LLM inference
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
}

/**
 * Main function 
 */
async function main() {
  console.log('========================================');
  console.log('DeepSearch System');
  console.log('========================================');
  
  try {
    // Create plugin registry
    const pluginRegistry = new PluginRegistry();
    
    // Create workflow compiler and executor
    const workflowCompiler = new WorkflowCompiler(pluginRegistry);
    const workflowExecutor = new WorkflowExecutor(workflowCompiler);
    
    // Register built-in plugins
    const plugins = [
      new SearchPlugin(),
      new WebReaderPlugin(),
      new ReasoningPlugin(),
      new TokenBudgetPlugin(),
      new EndPlugin()
    ];
    
    // Initialize and register all plugins
    for (const plugin of plugins) {
      // Initialize plugin
      await plugin.initialize({
        logger,
        services: {
          getService: (serviceId: string) => undefined
        }
      });
      
      // Register plugin
      const result = pluginRegistry.registerPlugin(plugin);
      
      if (!result.valid) {
        console.error(`Failed to register plugin ${plugin.id}:`, result.errors);
        continue;
      }
      
      // Activate plugin
      await plugin.activate();
      
      logger.info(`Registered plugin: ${plugin.name} (${plugin.id})`);
    }
    
    // Create default workflow
    const workflow = createDefaultWorkflow();
    
    // Get query from command line arguments
    const query = process.argv[2];
    if (!query) {
      console.error('No query provided. Please provide a query as a command line argument.');
      console.log('Example: npm run dev "What are the latest developments in AI?"');
      process.exit(1);
    }
    
    logger.info(`Executing workflow with query: "${query}"`);
    
    // Execute workflow
    const result$ = workflowExecutor.execute(workflow, { 
      query,
      operation: 'check' // For token budget plugin
    });
    
    // Subscribe to results
    result$.subscribe({
      next: result => {
        logger.info('Workflow execution completed');
        
        if (result.status === 'completed') {
          logger.info('==== Final Answer ====');
          console.log(result.result.answer || 'No answer provided');
          logger.info('====================');
          
          // Show token usage if available
          if (result.result && result.result.budget) {
            const budget = result.result.budget;
            logger.info(`Token Usage: ${budget.used}/${budget.total} tokens used (${budget.remaining} remaining)`);
          }
        } else {
          logger.error('Workflow execution failed:', result.error);
        }
      },
      error: error => {
        logger.error('Workflow execution failed:', error);
      }
    });
    
  } catch (error) {
    logger.error('Error in main:', error);
  }
}

// Run the main function
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { main, createDefaultWorkflow };