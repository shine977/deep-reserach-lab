/**
 * Custom RxJS Operators
 *
 * This file contains custom RxJS operators used in the workflow stream.
 */

import { Observable, of, throwError, timer } from "rxjs";
import {
  map,
  tap,
  mergeMap,
  catchError,
  takeUntil,
  finalize,
  scan,
} from "rxjs/operators";

/**
 * Operator that adds a timeout to an observable
 */
export function withTimeout<T>(ms: number) {
  return (source: Observable<T>): Observable<T> => {
    return source.pipe(
      takeUntil(
        timer(ms).pipe(
          mergeMap(() =>
            throwError(() => new Error(`Operation timed out after ${ms}ms`)),
          ),
        ),
      ),
    );
  };
}

/**
 * Operator that buffers items until complete
 */
export function bufferUntilComplete<T>() {
  return (source: Observable<T>): Observable<T[]> => {
    return source.pipe(
      scan((acc: T[], value: T) => [...acc, value], [] as T[]),
      finalize(() => of([])), // Ensure we emit on completion
    );
  };
}

/**
 * Operator that adds progress tracking
 */
export function withProgress<T>(total: number) {
  let current = 0;

  return (source: Observable<T>): Observable<T & { progress: number }> => {
    return source.pipe(
      tap(() => current++),
      map((value) => ({
        ...(value as any),
        progress: Math.min(100, Math.round((current / total) * 100)),
      })),
    );
  };
}

/**
 * Operator that tracks token usage
 */
export function trackTokens<T>() {
  return (source: Observable<T>): Observable<T> => {
    return source.pipe(
      map((value) => {
        // In a real implementation, we would count tokens
        // For now, just add a placeholder
        return {
          ...(value as any),
          _tokenUsage: {
            input: 0,
            output: 0,
            total: 0,
          },
        };
      }),
    );
  };
}
