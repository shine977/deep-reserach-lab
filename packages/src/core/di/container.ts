import {
  Constructor,
  InjectOptions,
  MetadataReader,
  Provider,
  Token,
  INJECTABLE_METADATA,
  INJECT_METADATA,
  OPTIONAL_METADATA,
  PARAM_TYPES,
} from "./types";

/**
 * Default implementation of MetadataReader
 * Responsible for reading metadata from classes
 */
class DefaultMetadataReader implements MetadataReader {
  /**
   * Get parameter types from constructor
   * @param target Target class
   * @returns Array of parameter types
   */
  getParamTypes(target: Constructor): any[] {
    return Reflect.getMetadata(PARAM_TYPES, target) || [];
  }

  /**
   * Get injection options for a specific parameter
   * @param target Target class
   * @param index Parameter index
   * @returns Injection options
   */
  getInjectOptions(target: Constructor, index: number): InjectOptions {
    const tokens = Reflect.getMetadata(INJECT_METADATA, target) || {};
    const optionals = Reflect.getMetadata(OPTIONAL_METADATA, target) || {};

    return {
      token: tokens[index],
      optional: optionals[index] === true,
    };
  }

  /**
   * Get property injection data
   * @param target Target class
   * @returns Map of property name to token
   */
  getPropertyInjectData(target: Constructor): Map<string | symbol, Token> {
    const prototype = target.prototype;
    const propertyMap = new Map<string | symbol, Token>();

    // Get all property names (including non-enumerable ones)
    const propertyNames = Object.getOwnPropertyNames(prototype).filter(
      (prop) => prop !== "constructor",
    );

    for (const prop of propertyNames) {
      const token = Reflect.getMetadata(INJECT_METADATA, prototype, prop);
      if (token !== undefined) {
        propertyMap.set(prop, token);
      }
    }

    return propertyMap;
  }
}

/**
 * DI Container implementation with circular dependency resolution
 */
export class Container {
  private providers = new Map<Token, Provider>();
  private instances = new Map<Token, any>();
  private resolving = new Set<Token>(); // Track tokens being resolved to detect circular deps
  private metadataReader: MetadataReader = new DefaultMetadataReader();
  private lazyProxies = new WeakMap<object, boolean>(); // Track which objects are lazy proxies
  private debug = false;

  /**
   * Enable debug logging
   */
  enableDebug() {
    this.debug = true;
  }

  /**
   * Log debug message if debug is enabled
   * @param message Message to log
   * @param data Optional data to log
   */
  private log(message: string, data?: any) {
    if (this.debug) {
      console.log(`[DI] ${message}`, data || "");
    }
  }

  /**
   * Register a provider in the container
   * @param provider Provider to register
   */
  register<T>(providerOrToken: Provider<T> | Constructor<T>): void {
    // Convert class to provider if needed
    const provider: Provider<T> = (providerOrToken as Provider<T>).provide
      ? (providerOrToken as Provider<T>)
      : {
          provide: providerOrToken as Constructor<T>,
          useClass: providerOrToken as Constructor<T>,
        };

    this.providers.set(provider.provide, provider);
    this.log(`Registered provider for token:`, provider.provide);
  }

  /**
   * Check if a provider is registered
   * @param token Token to check
   * @returns True if provider is registered
   */
  has(token: Token): boolean {
    return this.providers.has(token);
  }

  /**
   * Get an instance from the container
   * @param token Token to resolve
   * @returns Resolved instance
   */
  get<T>(token: Token<T>): T {
    this.log(`Resolving token:`, token);

    // Return cached instance if available
    if (this.instances.has(token)) {
      this.log(`Using cached instance for:`, token);
      return this.instances.get(token);
    }

    // Check if provider exists
    const provider = this.providers.get(token);
    if (!provider) {
      // Handle auto-registration for injectable classes
      if (
        typeof token === "function" &&
        Reflect.getMetadata(INJECTABLE_METADATA, token)
      ) {
        this.log(`Auto-registering injectable class:`, token);
        this.register(token as Constructor<T>);
        return this.get(token);
      }

      throw new Error(
        `No provider registered for ${this.tokenToString(token)}`,
      );
    }

    // Create the instance
    const instance = this.createInstance(provider);
    return instance;
  }

  /**
   * Create an instance from a provider
   * @param provider Provider to create instance from
   * @returns Created instance
   */
  private createInstance<T>(provider: Provider<T>): T {
    const token = provider.provide;

    // Check for circular dependency
    if (this.resolving.has(token)) {
      // Handle circular dependency
      if (provider.lazy !== false) {
        // Default to lazy resolution for circular deps
        this.log(
          `Circular dependency detected for ${this.tokenToString(token)}, creating lazy proxy`,
        );
        return this.createLazyProxy(token);
      }
      throw new Error(
        `Circular dependency detected for ${this.tokenToString(token)}`,
      );
    }

    // Mark as being resolved
    this.resolving.add(token);

    try {
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
      } else {
        // Class provider
        const targetClass = provider.useClass || (token as Constructor<T>);
        instance = this.createClassInstance(targetClass);
      }

      // Cache the instance
      this.instances.set(token, instance);
      this.log(`Cached instance for:`, token);

      return instance;
    } finally {
      // Mark as resolved
      this.resolving.delete(token);
    }
  }

  /**
   * Create a lazy proxy for circular dependency resolution
   * @param token Token to create proxy for
   * @returns Proxy object
   */
  private createLazyProxy<T>(token: Token<T>): T {
    // Create proxy target - empty object
    const target = Object.create(null);

    // Create the proxy
    const proxy = new Proxy(target, {
      get: (target, prop) => {
        // Resolve the real instance when accessed
        const realInstance = this.instances.get(token);
        if (realInstance) {
          return realInstance[prop];
        }

        // If not yet resolved, try again (may happen during initialization)
        return (this.get(token) as Record<string | symbol, any>)[prop];
      },
      set: (target, prop, value) => {
        // Set property on the real instance
        const realInstance = this.instances.get(token);
        if (realInstance) {
          realInstance[prop] = value;
        } else {
          // If not yet resolved, create the instance
          (this.get(token) as Record<string | symbol, any>)[prop] = value;
        }
        return true;
      },
    });

    // Mark as a proxy
    this.lazyProxies.set(proxy, true);

    // Cache temporary proxy
    this.instances.set(token, proxy);
    this.log(`Created lazy proxy for:`, token);

    return proxy as T;
  }

  /**
   * Create an instance of a class with dependency injection
   * @param target Class to instantiate
   * @returns Created instance
   */
  private createClassInstance<T>(target: Constructor<T>): T {
    this.log(`Creating instance of:`, target.name);

    // Get parameter types and inject tokens
    const paramTypes = this.metadataReader.getParamTypes(target);
    this.log(`Parameter types for ${target.name}:`, paramTypes);

    // Resolve dependencies
    const dependencies = paramTypes.map((paramType, index) => {
      const options = this.metadataReader.getInjectOptions(target, index);
      const token = options.token || paramType;

      try {
        return token ? this.get(token) : undefined;
      } catch (error: any) {
        if (options.optional) {
          return undefined;
        }
        throw new Error(
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
   * Process property injections for an instance
   * @param instance Instance to process
   * @param target Class of the instance
   */
  private processPropertyInjections<T>(
    instance: T,
    target: Constructor<T>,
  ): void {
    const propertyMap = this.metadataReader.getPropertyInjectData(target);

    for (const [prop, token] of propertyMap.entries()) {
      try {
        (instance as Record<string | symbol, any>)[prop] = this.get(token);
      } catch (error: any) {
        throw new Error(
          `Failed to inject property '${String(prop)}' on ${target.name}: ${error.message}`,
        );
      }
    }
  }

  /**
   * Convert a token to a string for error messages
   * @param token Token to convert
   * @returns String representation of token
   */
  private tokenToString(token: Token): string {
    if (typeof token === "function") {
      return token.name;
    }
    return String(token);
  }

  /**
   * Clear all instances but keep providers
   */
  clearInstances(): void {
    this.instances.clear();
    this.log("Cleared all instances");
  }

  /**
   * Reset the container (clear all providers and instances)
   */
  reset(): void {
    this.providers.clear();
    this.instances.clear();
    this.log("Reset container");
  }
}
