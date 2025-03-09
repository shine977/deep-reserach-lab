import "reflect-metadata";
import { Container } from "./container";
import { Injectable, Inject, Optional, Lazy } from "./decorators";
import { Constructor, Provider, Token } from "./types";

// Create a global DI container
const DI = new Container();

// Export public API
export { DI, Injectable, Inject, Optional, Lazy, Constructor, Provider, Token };
