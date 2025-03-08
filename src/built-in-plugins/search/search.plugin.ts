/**
 * Search Plugin
 *
 * This plugin handles search queries and returns search results.
 * It integrates with external search APIs to provide search functionality.
 */

import { Observable, from } from "rxjs";
import {
  NodePlugin,
  PluginContext,
  ExecutionContext,
  JSONSchema,
} from "../../core/types/plugin.types";
import axios from "axios";

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
}

export class SearchPlugin implements NodePlugin {
  // Plugin metadata
  id = "search-plugin";
  name = "Web Search";
  version = "1.0.0";
  description = "Performs web searches and returns results";
  nodeType = "search";

  // Schema definitions
  inputSchema: JSONSchema = {
    type: "object",
    properties: {
      query: { type: "string" },
    },
    required: ["query"],
  };

  outputSchema: JSONSchema = {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            url: { type: "string" },
            title: { type: "string" },
            snippet: { type: "string" },
          },
        },
      },
    },
  };

  configSchema: JSONSchema = {
    type: "object",
    properties: {
      resultLimit: {
        type: "number",
        default: 5,
      },
      provider: {
        type: "string",
        enum: ["mock", "jina"],
        default: "mock",
      },
    },
  };

  // Plugin lifecycle methods
  async initialize(context: PluginContext): Promise<void> {
    context.logger.info("Initializing search plugin");
  }

  async activate(): Promise<void> {
    console.log("Search plugin activated");
  }

  async deactivate(): Promise<void> {
    console.log("Search plugin deactivated");
  }

  // Process method
  process(input: any, config: any, context: ExecutionContext): Observable<any> {
    context.logger.info(`Processing search query: ${input.query}`);

    const provider = config.provider || "mock";
    const resultLimit = config.resultLimit || 5;

    // Select the appropriate search provider
    switch (provider) {
      case "jina":
        return this.searchWithJina(input.query, resultLimit, context);
      case "mock":
      default:
        return this.mockSearch(input.query, resultLimit, context);
    }
  }

  // Mock search for testing
  private mockSearch(
    query: string,
    limit: number,
    context: ExecutionContext,
  ): Observable<any> {
    return new Observable((observer) => {
      setTimeout(() => {
        const results: SearchResult[] = [
          {
            url: "https://example.com/result1",
            title: `Result 1 for "${query}"`,
            snippet: `This is a sample result for the query "${query}". This is just mock data.`,
          },
          {
            url: "https://example.com/result2",
            title: `Result 2 for "${query}"`,
            snippet: `Another sample result for "${query}". This is mock data for testing.`,
          },
          {
            url: "https://example.com/result3",
            title: `Result 3 for "${query}"`,
            snippet: `A third sample result for "${query}". More mock data for testing.`,
          },
        ].slice(0, limit);

        observer.next({ results });
        observer.complete();
      }, 500); // Simulate network delay
    });
  }

  // Jina search implementation
  private searchWithJina(
    query: string,
    limit: number,
    context: ExecutionContext,
  ): Observable<any> {
    return new Observable((observer) => {
      // Check for API key
      const jinaApiKey = process.env.JINA_API_KEY;
      if (!jinaApiKey) {
        observer.error(new Error("JINA_API_KEY is not set"));
        return;
      }

      // Make API request
      axios
        .get("https://api.jina.ai/search", {
          params: {
            query,
            limit,
          },
          headers: {
            Authorization: `Bearer ${jinaApiKey}`,
          },
        })
        .then((response) => {
          observer.next({ results: response.data.results });
          observer.complete();
        })
        .catch((error) => {
          context.logger.error("Jina search error:", error);
          observer.error(error);
        });
    });
  }
}
