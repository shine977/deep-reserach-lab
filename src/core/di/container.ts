/**
 * DI Container implementation
 */

import "reflect-metadata";
import {
  Constructor,
  ContainerInterface,
  InjectOptions,
  MetadataReader,
  Provider,
  Scope,
  Token,
} from "./types";
import {
  INJECTABLE_METADATA,
  INJECT_METADATA,
  OPTIONAL_METADATA,
  PARAM_TYPES,
  SCOPE_METADATA,
} from "./decorators";
import { ApplicationLogger } from "@deep-research-lab/shared";

/**
 * Metadata reader for analyzing class dependencies
 */
class DefaultMetadataReader implements MetadataReader {
  getParamTypes(target: Constructor): any[] {
    return Reflect.getMetadata(PARAM_TYPES, target) || [];
  }

  getInjectTokens(target: Constructor): Array<Token | null> {
    return Reflect.getMetadata(INJECT_METADATA, target) || [];
  }

  getInjectOptions(target: any, index: number): InjectOptions {
    const optionalParams = Reflect.getMetadata(OPTIONAL_METADATA, target) || [];
    const injectTokens = Reflect.getMetadata(INJECT_METADATA, target) || [];

    return {
      token: injectTokens[index] || null,
      optional: !!optionalParams[index],
    };
  }
}

/**
 * Main DI container implementation
 */
export class Container implements ContainerInterface {
  logger = new ApplicationLogger();
  private static instance: Container;
  private instances = new Map<Token, any>();
  private providers = new Map<Token, Provider>();
  private metadataReader: MetadataReader = new DefaultMetadataReader();

  /**
   * Get singleton container instance
   */
  public static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  /**
   * Register a provider with the container
   */
  public register<T>(providerOrToken: Token<T> | Provider<T>): void {
    let provider: Provider<T>;

    if (this.isProvider(providerOrToken)) {
      provider = providerOrToken;
    } else {
      provider = {
        provide: providerOrToken,
        useClass: providerOrToken as Constructor<T>,
      };
    }

    // Store the provider configuration
    this.providers.set(provider.provide, provider);

    // For singleton scope, instantiate immediately
    const scope = provider.scope || this.getProviderScope(provider);
    if (scope === Scope.SINGLETON && provider.useClass) {
      this.resolve(provider.useClass);
    }
  }

  /**
   * Get a service from the container
   */
  public get<T>(token: Token<T>): T {
    // Check if we already have an instance
    if (this.instances.has(token)) {
      return this.instances.get(token);
    }

    // Check if we have a provider for this token
    const provider = this.providers.get(token);
    if (!provider) {
      // If we don't have a provider but the token is a constructor,
      // try to resolve it directly
      if (typeof token === "function") {
        return this.resolve(token as Constructor<T>);
      }

      throw new Error(`No provider found for token: ${String(token)}`);
    }

    // Create instance based on provider type
    let instance: T;

    if (provider.useValue !== undefined) {
      // Value provider
      instance = provider.useValue;
    } else if (provider.useFactory) {
      // Factory provider
      const deps = (provider.inject || []).map((depToken) =>
        this.get(depToken),
      );
      instance = provider.useFactory(...deps);
    } else if (provider.useClass) {
      // Class provider
      instance = this.resolve(provider.useClass);
    } else {
      throw new Error(`Invalid provider configuration for: ${String(token)}`);
    }

    // Store instance for singletons
    if (provider.scope !== Scope.TRANSIENT) {
      this.instances.set(token, instance);
    }

    return instance;
  }

  /**
   * Resolve a class by creating a new instance with dependencies
   */
  public resolve<T>(target: Constructor<T>): T {
    // Check if class is injectable
    if (!this.isInjectable(target)) {
      throw new Error(`Class ${target.name} is not marked as @Injectable()`);
    }

    // Get parameter types and inject tokens
    const paramTypes = this.metadataReader.getParamTypes(target);

    // Resolve dependencies
    const dependencies = paramTypes.map((paramType, index) => {
      const options = this.metadataReader.getInjectOptions(target, index);
      const token = options.token || paramType;

      try {
        return this.get(token);
      } catch (error: any) {
        if (options.optional) {
          return undefined;
        }
        this.logger.error(
          `Cannot resolve dependency at index ${index} of ${target.name}: ${error.message}`,
        );
      }
    });

    // Create instance
    const instance = new target(...dependencies);

    // Process property injections
    this.processPropertyInjections(instance, target);

    return instance;
  }

  /**
   * Process property injections for a class instance
   */
  private processPropertyInjections<T>(
    instance: T,
    target: Constructor<T>,
  ): void {
    // Get the prototype to inspect property decorators
    const prototype = Object.getPrototypeOf(instance);

    // Get all property names (including non-enumerable ones)
    const propertyNames = Object.getOwnPropertyNames(prototype).filter(
      (prop) => prop !== "constructor",
    );

    // Process each property
    for (const propertyName of propertyNames) {
      const injectToken = Reflect.getMetadata(
        INJECT_METADATA,
        prototype,
        propertyName,
      );

      // Skip if not decorated with @Inject()
      if (injectToken === undefined) continue;

      try {
        // The token is either the specified token or the property type
        const token =
          injectToken ||
          Reflect.getMetadata("design:type", prototype, propertyName);

        if (token) {
          // Get the dependency and assign it to the property
          const dependency = this.get(token);
          (instance as any)[propertyName] = dependency;
        }
      } catch (error: any) {
        this.logger.error(
          `Failed to inject property '${propertyName}' on ${target.name}: ${error.message}`,
        );
      }
    }
  }

  /**
   * Check if a token is registered
   */
  public has(token: Token): boolean {
    return this.instances.has(token) || this.providers.has(token);
  }

  /**
   * Clear all registrations and instances
   */
  public clear(): void {
    this.instances.clear();
    this.providers.clear();
  }

  /**
   * Check if a value is a provider object
   */
  private isProvider(value: any): value is Provider {
    return value && typeof value === "object" && "provide" in value;
  }

  /**
   * Check if a class is injectable
   */
  private isInjectable(target: Constructor): boolean {
    return Reflect.getMetadata(INJECTABLE_METADATA, target) === true;
  }

  /**
   * Get the scope for a provider
   */
  private getProviderScope(provider: Provider): Scope {
    if (provider.scope) {
      return provider.scope;
    }

    if (provider.useClass) {
      const scope = Reflect.getMetadata(SCOPE_METADATA, provider.useClass);
      if (scope) {
        return scope;
      }
    }

    return Scope.SINGLETON;
  }
}
