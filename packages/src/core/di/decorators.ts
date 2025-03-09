import {
  INJECTABLE_METADATA,
  INJECT_METADATA,
  OPTIONAL_METADATA,
  Token,
} from "./types";

/**
 * Decorator to mark a class as injectable
 * @returns Class decorator
 */
export function Injectable() {
  return (target: any) => {
    Reflect.defineMetadata(INJECTABLE_METADATA, true, target);
    return target;
  };
}

/**
 * Decorator to specify a dependency token
 * @param token Token to inject
 * @returns Parameter or property decorator
 */
export function Inject(token?: Token) {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex?: number,
  ) => {
    if (parameterIndex !== undefined) {
      // Parameter decorator
      const existingInjectParams =
        Reflect.getMetadata(INJECT_METADATA, target.constructor) || {};
      existingInjectParams[parameterIndex] = token;
      Reflect.defineMetadata(
        INJECT_METADATA,
        existingInjectParams,
        target.constructor,
      );
    } else if (propertyKey !== undefined) {
      // Property decorator
      Reflect.defineMetadata(INJECT_METADATA, token, target, propertyKey);
    }
  };
}

/**
 * Decorator to mark a dependency as optional
 * @returns Parameter decorator
 */
export function Optional() {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number,
  ) => {
    const optionalParams =
      Reflect.getMetadata(OPTIONAL_METADATA, target.constructor) || {};
    optionalParams[parameterIndex] = true;
    Reflect.defineMetadata(
      OPTIONAL_METADATA,
      optionalParams,
      target.constructor,
    );
  };
}

/**
 * Decorator for lazy injection (helps with circular dependencies)
 * @returns Class decorator
 */
export function Lazy() {
  return (target: any) => {
    // Mark the class as lazy for circular dependency resolution
    target.prototype.__lazy__ = true;
    return target;
  };
}
