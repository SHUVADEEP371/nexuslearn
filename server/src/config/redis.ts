import Redis, { RedisOptions } from 'ioredis';

function createRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) return null;

  let parsedUrl: URL;
  try { parsedUrl = new URL(redisUrl); }
  catch { throw new Error('REDIS_URL must be a valid redis:// or rediss:// URL'); }
  if (parsedUrl.protocol !== 'redis:' && parsedUrl.protocol !== 'rediss:') {
    throw new Error('REDIS_URL protocol must be redis:// or rediss://');
  }

  const options: RedisOptions = {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    commandTimeout: 2_000,
    retryStrategy: (attempt) => Math.min(attempt * 250, 3_000),
  };
  const client = new Redis(redisUrl, options);
  client.on('error', (error: Error) => console.error('Redis connection error', error.name));
  return client;
}

/** ioredis parses `rediss://` and negotiates TLS automatically. */
export const redisClient = createRedisClient();
