import { RedisStore, RedisReply } from 'rate-limit-redis';
import { redisClient } from '../config/redis';

export { redisClient } from '../config/redis';
const localWindows = new Map<string, number[]>();
const sharedStores = new Set<RedisStore>();

function reloadScripts(store: RedisStore): void {
  store.incrementScriptSha = store.loadIncrementScript().catch(() => Promise.resolve(''));
  store.getScriptSha = store.loadGetScript().catch(() => Promise.resolve(''));
}

redisClient?.on('ready', () => {
  for (const store of sharedStores) reloadScripts(store);
});

export function createSharedRateLimitStore(prefix: string, resetExpiryOnChange = false): RedisStore | undefined {
  if (!redisClient) return undefined;
  const client = redisClient;
  const store = new RedisStore({
    prefix,
    resetExpiryOnChange,
    sendCommand: (...args: string[]) => {
      if (client.status !== 'ready') return Promise.reject(new Error('Redis is temporarily unavailable'));
      return client.call(args[0], ...args.slice(1)) as Promise<RedisReply>;
    },
  });
  // Redis may be unavailable during startup; handle constructor-time script-loading rejections.
  store.incrementScriptSha = store.incrementScriptSha.catch(() => Promise.resolve(''));
  store.getScriptSha = store.getScriptSha.catch(() => Promise.resolve(''));
  sharedStores.add(store);
  return store;
}

export async function allowSocketAIRequest(userId: string, maximum = 8, windowMs = 60_000): Promise<boolean> {
  const now = Date.now();
  if (redisClient?.status === 'ready') {
    try {
      const key = `nexuslearn:socket-ai:${userId}`;
      const count = await redisClient.incr(key);
      await redisClient.expire(key, Math.ceil(windowMs / 1000));
      return count <= maximum;
    } catch { /* Use process-local fallback while Redis is unavailable. */ }
  }
  const current = (localWindows.get(userId) || []).filter((timestamp) => now - timestamp < windowMs);
  if (current.length >= maximum) { localWindows.set(userId, current); return false; }
  current.push(now);
  localWindows.set(userId, current);
  if (localWindows.size > 5000) {
    for (const [key, timestamps] of localWindows) if (timestamps.every((timestamp) => now - timestamp >= windowMs)) localWindows.delete(key);
  }
  return true;
}
