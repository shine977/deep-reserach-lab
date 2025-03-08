/**
 * Core DI system types
 * Forward compatible with NestJS patterns
 */

export type Constructor<T = any> = new (...args: any[]) => T;
export type Token<T = any> = string | symbol | Constructor<T>;

export interface InjectionToken {
  readonly id: string | symbol;
  readonly description: string;
}

export enum Scope {
  SINGLETON = "singleton",
  REQUEST = "request",
  TRANSIENT = "transient",
}

export interface ProviderOptions {
  scope?: Scope;
  token?: Token;
}

export interface Provider<T = any> {
  provide: Token<T>;
  useClass?: Constructor<T>;
  useValue?: T;
  useFactory?: (...args: any[]) => T;
  inject?: Token[];
  scope?: Scope;
}

export interface InjectOptions {
  token?: Token;
  optional?: boolean;
}

export interface ContainerInterface {
  get<T>(token: Token<T>): T;
  register<T>(provider: Token<T> | Provider<T>): void;
  resolve<T>(target: Constructor<T>): T;
  has(token: Token): boolean;
  clear(): void;
}

export interface MetadataReader {
  getParamTypes(target: Constructor): any[];
  getInjectTokens(target: Constructor): Array<Token | null>;
  getInjectOptions(target: any, index: number): InjectOptions;
}
