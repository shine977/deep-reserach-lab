/**
 * Dependency Injection decorators
 * Compatible with NestJS decorators patterns
 */

import "reflect-metadata";
import {
  Constructor,
  InjectOptions,
  ProviderOptions,
  Scope,
  Token,
} from "./types";

// Symbol keys for metadata
export const INJECTABLE_METADATA = Symbol("DI:injectable");
export const INJECT_METADATA = Symbol("DI:inject");
export const OPTIONAL_METADATA = Symbol("DI:optional");
export const SCOPE_METADATA = Symbol("DI:scope");
export const SELF_METADATA = Symbol("DI:self");
export const PARAM_TYPES = "design:paramtypes";

/**
 * Class decorator that marks a class as available to be injected
 * @param options Injectable options
 */
export function Injectable(options: ProviderOptions = {}): ClassDecorator {
  return (target: any) => {
    Reflect.defineMetadata(INJECTABLE_METADATA, true, target);

    if (options.scope) {
      Reflect.defineMetadata(SCOPE_METADATA, options.scope, target);
    }

    if (options.token) {
      Reflect.defineMetadata("customToken", options.token, target);
    }

    return target;
  };
}

/**
 * Parameter decorator that marks a parameter to be injected with the specified token
 * @param token Token to inject (optional for property injection)
 */
export function Inject(token?: Token): ParameterDecorator & PropertyDecorator {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex?: number,
  ) => {
    if (parameterIndex !== undefined) {
      // Parameter decorator
      const existingInjectParams =
        Reflect.getMetadata(INJECT_METADATA, target, propertyKey!) || [];
      existingInjectParams[parameterIndex] = token;
      Reflect.defineMetadata(
        INJECT_METADATA,
        existingInjectParams,
        target,
        propertyKey!,
      );
    } else {
      // Property decorator
      Reflect.defineMetadata(INJECT_METADATA, token, target, propertyKey!);
    }
  };
}

/**
 * Parameter decorator that marks a parameter as optional
 */
export function Optional(): ParameterDecorator {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number,
  ) => {
    const optionalParams =
      Reflect.getMetadata(OPTIONAL_METADATA, target, propertyKey!) || [];
    optionalParams[parameterIndex] = true;
    Reflect.defineMetadata(
      OPTIONAL_METADATA,
      optionalParams,
      target,
      propertyKey!,
    );
  };
}

/**
 * Create an injection token
 * @param name Token name for debugging
 */
export function createToken<T = any>(name: string): Token<T> {
  const symbol = Symbol(name);
  Object.defineProperty(symbol, "toString", {
    value: () => `InjectionToken[${name}]`,
    writable: false,
  });
  return symbol;
}

/**
 * Factory decorator - defines a factory provider
 */
export function Factory(): ClassDecorator {
  return (target: any) => {
    Reflect.defineMetadata("factory", true, target);
    return target;
  };
}
