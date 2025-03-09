// Types for dependency injection system

// Type for class constructor
export type Constructor<T = any> = new (...args: any[]) => T;

// Token for dependency identification
export type Token<T = any> = Constructor<T> | string | symbol;

// Provider registration options
export interface Provider<T = any> {
  provide: Token<T>;
  useClass?: Constructor<T>;
  useValue?: T;
  useFactory?: (...args: any[]) => T;
  inject?: Token[];
  lazy?: boolean; // Flag for lazy resolution (helps with circular dependencies)
}

// Dependency injection options
export interface InjectOptions {
  token?: Token;
  optional?: boolean;
}

// Metadata reader interface
export interface MetadataReader {
  getParamTypes(target: Constructor): any[];
  getInjectOptions(target: Constructor, index: number): InjectOptions;
  getPropertyInjectData(target: Constructor): Map<string | symbol, Token>;
}

// Constants for metadata keys
export const INJECTABLE_METADATA = Symbol("INJECTABLE_METADATA");
export const INJECT_METADATA = Symbol("INJECT_METADATA");
export const OPTIONAL_METADATA = Symbol("OPTIONAL_METADATA");
export const PARAM_TYPES = "design:paramtypes";
