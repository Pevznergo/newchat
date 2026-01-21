import { createClient } from "redis";

const redis = createClient({
  url: process.env.REDIS_URL,
});

redis.on("error", (err) => console.error("Redis Client Error", err));

if (process.env.REDIS_URL) {
  // Connect immediately (or lazily, but usually global connection is fine in serverless if reused,
  // though typically for Next.js serverless functions you might want to connect inside the handler or use a singleton pattern that avoids too many connections.
  // Actually, for Next.js route handlers, global client reuse is widely practiced.
  redis.connect().catch(console.error);
} else {
  console.warn("REDIS_URL not set");
}

export default redis;
