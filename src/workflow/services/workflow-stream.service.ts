/**
 * Workflow Stream Service
 * 
 * This service handles the reactive data flow between nodes in a workflow
 * using RxJS. It manages streams of data and applies transformations
 * based on the workflow definition.
 */

import { Observable, Subject, of, from, throwError, merge } from 'rxjs';
import { 
  map, 
  mergeMap, 
  catchError, 
  tap, 
  finalize, 
  share, 
  bufferCount,
  filter,
  timeout,
  toArray
} from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { 
  WorkflowNode, 
  Workflow, 
  Connection 
} from '../../core/types/workflow.types';
import { 
  StreamItem, 
  StreamEvent, 
  StreamOptions, 
  NodeContext
} from '../models/stream-types';
import { 
  bufferUntilComplete, 
  withProgress, 
  withTimeout, 
  trackTokens 
} from '../utils/rxjs-operators';

export class WorkflowStreamService {
  // Event subject for workflow events
  private workflowEvents = new Subject<StreamEvent>();
  
  /**
   * Create a data stream for a workflow
   * 
   * @param workflow The workflow definition
   * @param input Initial input data
   * @param options Stream options
   * @returns Observable stream of workflow data
   */
  createStream(
    workflow: Workflow, 
    input: any, 
    options: StreamOptions = {}
  ): Observable<StreamItem> {
    // Generate execution ID
    const executionId = options.executionId || uuidv4();
    
    // Create node map for quick access
    const nodeMap = new Map<string, WorkflowNode>();
    workflow.nodes.forEach(node => nodeMap.set(node.id, node));
    
    // Create connection map
    const connectionMap = this.createConnectionMap(workflow.connections);
    
    // Create node pipelines
    const nodePipelines = this.createNodePipelines(
      workflow, 
      nodeMap, 
      connectionMap, 
      executionId, 
      options
    );
    
    // Create initial stream item
    const initialItem: StreamItem = {
      executionId,
      nodeId: 'entry',
      data: input,
      timestamp: Date.now(),
      metadata: {
        step: 0,
        tokenUsage: { input: 0, output: 0, total: 0 }
      }
    };
    
    // Emit workflow start event
    this.emitEvent({
      type: 'workflow:start',
      executionId,
      workflowId: workflow.id,
      timestamp: Date.now(),
      data: { input }
    });
    
    // Process the stream through node pipelines
    return of(initialItem).pipe(
      // Process through node pipelines
      mergeMap(item => {
        const targets = connectionMap.get('entry') || [];
        
        if (targets.length === 0) {
          // If no targets, just return the initial item
          return of(item);
        }
        
        // Process through each target node
        const streams = targets.map(target => {
          const pipeline = nodePipelines.get(target);
          return pipeline ? pipeline(item) : of(item);
        });
        
        // Merge all streams
        return merge(...streams);
      }),
      
      // Handle errors
      catchError(error => {
        this.emitEvent({
          type: 'workflow:error',
          executionId,
          workflowId: workflow.id,
          timestamp: Date.now(),
          data: { error }
        });
        
        return throwError(() => error);
      }),
      
      // Emit workflow complete event when done
      finalize(() => {
        this.emitEvent({
          type: 'workflow:complete',
          executionId,
          workflowId: workflow.id,
          timestamp: Date.now(),
          data: {}
        });
      }),
      
      // Share the stream among multiple subscribers
      share()
    );
  }
  
  /**
   * Get a stream of workflow events
   */
  getEvents(): Observable<StreamEvent> {
    return this.workflowEvents.asObservable();
  }
  
  /**
   * Create a map of node connections
   */
  private createConnectionMap(connections: Connection[]): Map<string, string[]> {
    const connectionMap = new Map<string, string[]>();
    
    // Add entry node
    connectionMap.set('entry', []);
    
    // Add connections
    connections.forEach(conn => {
      const fromNode = conn.from;
      const toNode = conn.to;
      
      // First node connects to entry
      if (fromNode === 'entry' || !connectionMap.has('entry')) {
        const entryTargets = connectionMap.get('entry') || [];
        entryTargets.push(toNode);
        connectionMap.set('entry', entryTargets);
      }
      
      // Add regular connection
      if (!connectionMap.has(fromNode)) {
        connectionMap.set(fromNode, []);
      }
      
      const targets = connectionMap.get(fromNode) || [];
      targets.push(toNode);
      connectionMap.set(fromNode, targets);
    });
    
    return connectionMap;
  }
  
  /**
   * Create pipeline functions for each node
   */
  private createNodePipelines(
    workflow: Workflow,
    nodeMap: Map<string, WorkflowNode>,
    connectionMap: Map<string, string[]>,
    executionId: string,
    options: StreamOptions
  ): Map<string, (item: StreamItem) => Observable<StreamItem>> {
    const pipelines = new Map<string, (item: StreamItem) => Observable<StreamItem>>();
    const { timeout: timeoutMs = 30000, maxTokens } = options;
    
    // Create pipeline for each node
    workflow.nodes.forEach(node => {
      // Create pipeline function
      const pipeline = (inputItem: StreamItem): Observable<StreamItem> => {
        // Skip if this node is not the target
        if (inputItem.nodeId !== 'entry' && 
            !connectionMap.get(inputItem.nodeId)?.includes(node.id)) {
          return of(inputItem);
        }
        
        // Create node context
        const context: NodeContext = {
          executionId,
          nodeId: node.id,
          nodeType: node.type,
          step: (inputItem.metadata?.step || 0) + 1,
          logger: console,
          emitEvent: (type, data) => this.emitNodeEvent(
            type, executionId, node.id, data
          )
        };
        
        // Emit node start event
        this.emitNodeEvent(
          'node:start', 
          executionId, 
          node.id, 
          { input: inputItem.data, config: node.config }
        );
        
        // TODO: Get actual node processor from plugin registry
        // For now, just echo the input with node info
        const processor = (data: any) => {
          return of({
            ...data,
            processedBy: node.id,
            nodeType: node.type,
            timestamp: Date.now()
          });
        };
        
        // Process the node
        return processor(inputItem.data).pipe(
          // Apply timeout
          withTimeout(timeoutMs),
          
          // Track token usage
          trackTokens(),
          
          // Map to stream item
          map(output => ({
            executionId,
            nodeId: node.id,
            data: output,
            timestamp: Date.now(),
            metadata: {
              step: context.step,
              tokenUsage: {
                input: inputItem.metadata?.tokenUsage?.total || 0,
                output: 0, // Would be calculated in actual implementation
                total: 0  // Would be calculated in actual implementation
              }
            }
          } as StreamItem)),
          
          // Handle node processing errors
          catchError(error => {
            this.emitNodeEvent(
              'node:error', 
              executionId, 
              node.id, 
              { error, input: inputItem.data }
            );
            
            return throwError(() => error);
          }),
          
          // Emit node complete event
          tap(outputItem => {
            this.emitNodeEvent(
              'node:complete', 
              executionId, 
              node.id, 
              { input: inputItem.data, output: outputItem.data }
            );
          }),
          
          // Process through downstream nodes
          mergeMap(outputItem => {
            const targets = connectionMap.get(node.id) || [];
            
            if (targets.length === 0) {
              // If no targets, just return this node's output
              return of(outputItem);
            }
            
            // Process through each target node
            const streams = targets.map(target => {
              const targetPipeline = pipelines.get(target);
              return targetPipeline ? targetPipeline(outputItem) : of(outputItem);
            });
            
            // Return this node's output and all downstream outputs
            return merge(of(outputItem), merge(...streams));
          })
        );
      };
      
      // Store the pipeline
      pipelines.set(node.id, pipeline);
    });
    
    return pipelines;
  }
  
  /**
   * Emit a workflow event
   */
  private emitEvent(event: StreamEvent): void {
    this.workflowEvents.next(event);
  }
  
  /**
   * Emit a node event
   */
  private emitNodeEvent(
    type: string,
    executionId: string,
    nodeId: string,
    data: any
  ): void {
    this.emitEvent({
      type,
      executionId,
      nodeId,
      timestamp: Date.now(),
      data
    });
  }
}