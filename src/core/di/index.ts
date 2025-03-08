/**
 * DI System public API
 */

export * from "./types";
export * from "./decorators";
export { Container } from "./container";

// Convenience exports
import { Container } from "./container";

// Global container instance for convenience
export const DI = Container.getInstance();
