import { Redis } from "@upstash/redis";

function createRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set");
  }
  return new Redis({ url, token });
}

const globalForRedis = globalThis as unknown as { redis: Redis };

export const redis = globalForRedis.redis ?? createRedis();

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;
