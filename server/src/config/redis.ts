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
    family: 4,
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 3,
    commandTimeout: 2_000,
    retryStrategy: (attempt) => attempt > 5 ? null : Math.min(attempt * 250, 3_000),
    ...(parsedUrl.protocol === 'rediss:' ? {
      tls: {
        servername: parsedUrl.hostname,
        // Keep certificate verification enabled to prevent TLS interception.
        rejectUnauthorized: true,
      },
    } : {}),
  };
  const client = new Redis(redisUrl, options);
  client.on('error', (error: Error) => console.error('Redis connection error', error.name));
  return client;
}

/** Use IPv4 explicitly; configure TLS SNI for managed Redis hosts. */
export const redisClient = createRedisClient();
