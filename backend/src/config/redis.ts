// src/config/redis.ts
import Redis, { type RedisOptions } from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

/**
 * Connections are separated by role rather than shared, because they need
 * genuinely different failure behaviour:
 *
 *  - `cache` / `limiter`: no offline queue. If Redis is down we want the
 *    command to reject in microseconds so the caller can fail open. Buffering
 *    commands would turn a Redis blip into an out-of-memory event at load.
 *  - `queue`: BullMQ requires `maxRetriesPerRequest: null` and uses blocking
 *    reads, which would stall any client that shared the socket.
 */
export type RedisRole = "cache" | "limiter" | "queue";

const clients = new Map<RedisRole, Redis>();

const baseOptions = (): RedisOptions => {
  const options: RedisOptions = {
    host: env.redis.host,
    port: env.redis.port,
    db: env.redis.db,
    lazyConnect: true,
    connectTimeout: 5000,
    keepAlive: 30_000,
    // Batches commands issued in the same event-loop tick into one round trip.
    // At a few hundred RPS this is the single biggest Redis latency win.
    enableAutoPipelining: true,
    retryStrategy: (times) => Math.min(times * 100, 3000),
  };
  if (env.redis.password) options.password = env.redis.password;
  if (env.redis.tls) options.tls = {};
  return options;
};

const roleOptions = (role: RedisRole): RedisOptions => {
  const options = baseOptions();

  if (role === "queue") {
    // BullMQ manages its own key namespace and requires unlimited retries.
    options.maxRetriesPerRequest = null;
    options.enableReadyCheck = false;
    return options;
  }

  options.maxRetriesPerRequest = 2;
  options.enableOfflineQueue = false;
  options.keyPrefix = `${env.redis.keyPrefix}:`;
  return options;
};

const createClient = (role: RedisRole): Redis => {
  const client = env.redis.url
    ? new Redis(env.redis.url, roleOptions(role))
    : new Redis(roleOptions(role));

  client.on("connect", () => logger.info(`Redis[${role}] connected`));
  client.on("error", (err: Error) => logger.error(`Redis[${role}] error`, { error: err.message }));
  client.on("reconnecting", () => logger.warn(`Redis[${role}] reconnecting`));
  client.on("end", () => logger.warn(`Redis[${role}] connection closed`));

  return client;
};

export const getRedis = (role: RedisRole = "cache"): Redis => {
  let client = clients.get(role);
  if (!client) {
    client = createClient(role);
    clients.set(role, client);
  }
  return client;
};

/** Opens the connections this process actually needs. */
export const connectRedis = async (roles: RedisRole[] = ["cache", "limiter"]): Promise<void> => {
  await Promise.all(
    roles.map(async (role) => {
      const client = getRedis(role);
      if (client.status === "end" || client.status === "wait") await client.connect();
    })
  );
};

export const pingRedis = async (role: RedisRole = "cache"): Promise<boolean> => {
  try {
    return (await getRedis(role).ping()) === "PONG";
  } catch {
    return false;
  }
};

export const closeRedis = async (): Promise<void> => {
  await Promise.all(
    [...clients.values()].map((client) =>
      client.quit().catch(() => {
        client.disconnect();
      })
    )
  );
  clients.clear();
};
