// src/constants/cacheKeys.ts
//
// Every cache key in the app is built here so that key shape is auditable in one
// place. Keys are grouped into *namespaces*; a namespace is invalidated by
// bumping its version counter (see cacheService), never by scanning keys.

export const CacheNamespace = {
  EMPLOYEE: "emp",
  EMPLOYEE_STATS: "emp:stats",
  USER: "user",
  AI: "ai",
} as const;

export type CacheNamespaceName = (typeof CacheNamespace)[keyof typeof CacheNamespace];

/** Refresh-token and auth keys are not caches — they are state, so no version. */
export const authKeys = {
  refreshToken: (jti: string): string => `auth:rt:${jti}`,
  userTokenSet: (userId: string): string => `auth:rt:user:${userId}`,
  /** Bumped on logout-all / password change to invalidate outstanding access tokens. */
  tokenEpoch: (userId: string): string => `auth:epoch:${userId}`,
};

export const lockKeys = {
  singleFlight: (key: string): string => `lock:${key}`,
};
