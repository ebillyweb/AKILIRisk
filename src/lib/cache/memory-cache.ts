import "server-only";

/**
 * Simple in-memory cache implementation with TTL support.
 * This can be easily swapped for Redis in production.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  lastAccessed: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private maxSize = 1000; // Maximum number of entries
  private maxMemoryMB = 100; // Maximum memory usage estimate

  constructor() {
    // Only create interval if one doesn't exist
    if (!this.cleanupInterval) {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, 5 * 60 * 1000);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Update last accessed time for LRU
    entry.lastAccessed = Date.now();

    return entry.value;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const now = Date.now();
    const expiresAt = now + (ttlSeconds * 1000);

    // Check cache size limits before adding
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, { value, expiresAt, lastAccessed: now });
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      console.log(`Cache evicted LRU entry: ${oldestKey}`);
    }
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  // For testing/monitoring
  size(): number {
    return this.cache.size;
  }

  // Cleanup on process exit
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

// Singleton instance
const memoryCache = new MemoryCache();

// Graceful shutdown
process.on('SIGTERM', () => memoryCache.destroy());
process.on('SIGINT', () => memoryCache.destroy());

export { memoryCache as cache };