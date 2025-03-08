/**
 * Web Reader Plugin
 *
 * This plugin fetches and processes web content from URLs.
 * It extracts relevant information from web pages.
 */

import { Observable, from, of, mergeMap, toArray, map } from "rxjs";
import {
  NodePlugin,
  PluginContext,
  ExecutionContext,
  JSONSchema,
} from "../../core/types/plugin.types";
import axios from "axios";
import { Injectable } from "@deep-research-lab/core/di";

export interface ContentItem {
  url: string;
  title: string;
  content: string;
  error?: string;
}

interface SearchResult {
  url: string;
  title: string;
  snippet: string;
}

@Injectable()
export class WebReaderPlugin implements NodePlugin {
  // Plugin metadata
  id = "web-reader-plugin";
  name = "Web Content Reader";
  version = "1.0.0";
  description = "Reads and extracts content from web pages";
  nodeType = "web-reader";

  // Schema definitions
  inputSchema: JSONSchema = {
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
      urls: {
        type: "array",
        items: { type: "string" },
      },
    },
  };

  outputSchema: JSONSchema = {
    type: "object",
    properties: {
      contents: {
        type: "array",
        items: {
          type: "object",
          properties: {
            url: { type: "string" },
            title: { type: "string" },
            content: { type: "string" },
            error: { type: "string" },
          },
        },
      },
    },
  };

  configSchema: JSONSchema = {
    type: "object",
    properties: {
      concurrency: {
        type: "number",
        default: 3,
      },
      contentMaxLength: {
        type: "number",
        default: 10000,
      },
      useMock: {
        type: "boolean",
        default: true,
      },
    },
  };

  // Plugin lifecycle methods
  async initialize(context: PluginContext): Promise<void> {
    context.logger.info("Initializing web reader plugin");
  }

  async activate(): Promise<void> {
    console.log("Web reader plugin activated");
  }

  async deactivate(): Promise<void> {
    console.log("Web reader plugin deactivated");
  }

  // Process method
  process(input: any, config: any, context: ExecutionContext): Observable<any> {
    const urls: string[] = [];

    // Extract URLs from input
    if (input.results && Array.isArray(input.results)) {
      console.log("input.results", input.results);
      urls.push(...input.results.map((r: SearchResult) => r.url));
    }

    if (input.urls && Array.isArray(input.urls)) {
      urls.push(...input.urls);
    }

    if (urls.length === 0) {
      context.logger.warn("No URLs provided to web reader");
      return of({ contents: [] });
    }

    context.logger.info(`Processing ${urls.length} URLs`);

    const concurrency = config.concurrency || 3;
    const contentMaxLength = config.contentMaxLength || 10000;
    const useMock = config.useMock !== undefined ? config.useMock : true;

    // Process URLs
    return from(urls).pipe(
      // Limit concurrency
      mergeMap((url) => {
        return useMock
          ? this.mockFetchContent(url, contentMaxLength, context)
          : this.fetchContent(url, contentMaxLength, context);
      }, concurrency),

      // Collect results
      toArray(),

      // Format output
      map((contents) => ({ contents })),
    );
  }

  // Mock content fetching for testing
  private mockFetchContent(
    url: string,
    maxLength: number,
    context: ExecutionContext,
  ): Observable<ContentItem> {
    return new Observable((observer) => {
      setTimeout(() => {
        observer.next({
          url,
          title: `Content from ${url}`,
          content:
            `This is mock content for ${url}. It simulates fetched web content for testing purposes.
          
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam auctor, nisl eget 
ultricies tincidunt, nisl nisl aliquam nisl, eget aliquam nisl nisl eget nisl.
          
The quick brown fox jumps over the lazy dog. The quick brown fox jumps over the lazy dog.
The quick brown fox jumps over the lazy dog. The quick brown fox jumps over the lazy dog.`.slice(
              0,
              maxLength,
            ),
        });
        observer.complete();
      }, 700); // Simulate network delay
    });
  }

  // Actual content fetching
  private fetchContent(
    url: string,
    maxLength: number,
    context: ExecutionContext,
  ): Observable<ContentItem> {
    return new Observable((observer) => {
      axios
        .get(url)
        .then((response) => {
          // Extract title
          const titleMatch = /<title>(.*?)<\/title>/i.exec(response.data);
          const title = titleMatch ? titleMatch[1] : url;

          // Simple content extraction (in reality, would use a proper HTML parser)
          let content = response.data
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          // Limit content length
          if (content.length > maxLength) {
            content = content.slice(0, maxLength) + "...";
          }

          observer.next({
            url,
            title,
            content,
          });
          observer.complete();
        })
        .catch((error) => {
          context.logger.error(`Error fetching ${url}:`, error);
          observer.next({
            url,
            title: url,
            content: "",
            error: error.message || "Failed to fetch content",
          });
          observer.complete();
        });
    });
  }
}
