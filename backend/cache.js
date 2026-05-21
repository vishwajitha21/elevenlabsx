import NodeCache from 'node-cache';

// ─── General SWR cache (30s default TTL) ────────────────────────────────────
const generalCache = new NodeCache({ stdTTL: 30, checkperiod: 10 });

/**
 * Stale-While-Revalidate cache wrapper.
 * - Cache hit, TTL > 5s  → return immediately
 * - Cache hit, TTL ≤ 5s  → return immediately + trigger background refresh
 * - Cache miss            → await fetcher, store result, return
 */
export async function swr(key, fetcher, ttl = 30) {
  const ttlRemaining = generalCache.getTtl(key);
  const cached = generalCache.get(key);

  if (cached !== undefined) {
    const remaining = ttlRemaining ? (ttlRemaining - Date.now()) / 1000 : 0;
    if (remaining <= 5) {
      // Stale — return immediately and refresh in background
      setImmediate(async () => {
        try {
          const fresh = await fetcher();
          generalCache.set(key, fresh, ttl);
        } catch (_) { /* background refresh failure — cached value still served */ }
      });
    }
    return cached;
  }

  const result = await fetcher();
  generalCache.set(key, result, ttl);
  return result;
}

/** Delete all cache keys that start with a given prefix. */
export function cacheDelPrefix(prefix) {
  const keys = generalCache.keys().filter(k => k.startsWith(prefix));
  generalCache.del(keys);
}

/** Delete a single cache key. */
export function cacheDel(key) {
  generalCache.del(key);
}

/** Set a cache key directly. */
export function cacheSet(key, value, ttl = 30) {
  generalCache.set(key, value, ttl);
}

// ─── AI Cache (5 min TTL) ────────────────────────────────────────────────────
const aiCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

export function aiCacheGet(key) {
  return aiCache.get(key);
}

export function aiCacheSet(key, value) {
  aiCache.set(key, value);
}

// ─── Keep-Alive (prevents Render free tier cold starts) ──────────────────────
// This is a SELF-ping fallback. Primary keep-alive should be UptimeRobot
// pointing at: https://your-service.onrender.com/ping  (every 5 minutes)
export function startKeepAlive(port) {
  if (process.env.NODE_ENV !== 'production') return;

  // RENDER_EXTERNAL_URL is injected automatically by Render (e.g. https://your-service.onrender.com)
  const baseUrl = process.env.RENDER_EXTERNAL_URL
    ? process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '')
    : `http://localhost:${port}`;

  setInterval(async () => {
    try {
      const res = await fetch(`${baseUrl}/ping`);
      console.log(`[keep-alive] self-ping ${res.status} → ${baseUrl}/ping`);
    } catch (err) {
      console.warn('[keep-alive] self-ping failed:', err.message);
    }
  }, 14 * 60 * 1000); // every 14 minutes — UptimeRobot covers the 5 min window

  console.log(`[keep-alive] started — self-pinging ${baseUrl}/ping every 14 min`);
  console.log(`[keep-alive] UptimeRobot should monitor: ${baseUrl}/ping every 5 min`);
}
