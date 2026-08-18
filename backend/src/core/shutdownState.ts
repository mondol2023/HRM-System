// src/core/shutdownState.ts
// Flips the readiness probe to 503 before connections start draining, so a
// load balancer stops routing new traffic before the server actually stops.
let shuttingDown = false;

export const isShuttingDown = (): boolean => shuttingDown;
export const markShuttingDown = (): void => {
  shuttingDown = true;
};
