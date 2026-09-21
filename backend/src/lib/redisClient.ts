import { createClient } from "redis";

type RedisClient = ReturnType<typeof createClient>;

let redis: RedisClient | null = null;

const redisUrl = process.env.REDIS_URL;
if (redisUrl) {
  redis = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (attempts) => Math.min(attempts * 200, 10_000),
      connectTimeout: 10_000,
    },
  });

  redis.on("error", (err: Error) => {
    // Suppress noisy reconnect errors after first connect attempt
    if (process.env.NODE_ENV !== "production" || err.message.includes("ECONNREFUSED")) {
      console.error("[Redis] error:", err.message);
    }
  });

  redis
    .connect()
    .then(() => console.log("[Redis] connected — shared cache + rate-limit active"))
    .catch((err: Error) => {
      console.warn("[Redis] failed to connect (in-memory fallback active):", err.message);
      redis = null;
    });
}

export { redis };
