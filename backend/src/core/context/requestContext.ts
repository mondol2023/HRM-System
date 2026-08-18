// src/core/context/requestContext.ts
import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  requestId: string;
  userId?: string;
  role?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Runs `fn` with `context` visible to every async continuation beneath it. */
export const runWithContext = <T>(context: RequestContext, fn: () => T): T =>
  storage.run(context, fn);

export const getContext = (): RequestContext | undefined => storage.getStore();

/**
 * Mutates the *current* context. Used by the auth middleware to attach the
 * caller's identity once the token is verified, so every later log line in the
 * request is attributable without threading the user through call signatures.
 */
export const setContextUser = (userId: string, role: string): void => {
  const store = storage.getStore();
  if (store) {
    store.userId = userId;
    store.role = role;
  }
};
