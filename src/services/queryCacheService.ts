import Redis from 'ioredis';
import { telemetryService } from '@/services/telemetryService';

export interface GameSession {
  id: string;
  playerId: string;
  status: 'waiting' | 'active' | 'completed' | 'abandoned';
  currentWave: number;
  score: number;
  startedAt: Date;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Player {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlayerStats {
  playerId: string;
  totalGames: number;
  totalWins: number;
  totalScore: number;
  highestWave: number;
  averageScore: number;
  winRate: number;
  lastPlayedAt: Date;
}

export interface LeaderboardEntry {
  playerId: string;
  username: string;
  score: number;
  rank: number;
}

export interface SessionFilters {
  status?: GameSession['status'];
  playerId?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'score' | 'currentWave';
  sortOrder?: 'asc' | 'desc';
}

export type QueryKey = readonly unknown[];

export const CACHE_KEYS = {
  GAME_SESSIONS: (playerId?: string) => 
    playerId ? ['gameSessions', 'player', playerId] : ['gameSessions', 'all'],
  GAME_SESSION: (sessionId: string) => ['gameSession', sessionId],
  PLAYER_STATS: (playerId: string) => ['playerStats', playerId],
  LEADERBOARD: (limit?: number) => ['leaderboard', limit ?? 100],
} as const;

export const CACHE_TTL = {
  GAME_SESSIONS: 5 * 60 * 1000,
  GAME_SESSION: 5 * 60 * 1000,
  PLAYER_STATS: 10 * 60 * 1000,
  LEADERBOARD: 5 * 60 * 1000,
} as const;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  stale: boolean;
}

class QueryCacheService {
  private redis: Redis;
  private memoryCache: Map<string, CacheEntry<unknown>> = new Map();
  private readonly DEFAULT_SESSION_TTL = 60;
  private readonly DEFAULT_LIST_TTL = 30;
  private readonly KEY_PREFIX = 'game:';
  private static instance: QueryCacheService | null = null;

  private constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    this.redis.on('error', (err) => {
      telemetryService.emit('cache.error', { error: err.message });
    });

    this.redis.on('connect', () => {
      telemetryService.emit('cache.connected');
    });

    this.startCleanupInterval();
  }

  static getInstance(): QueryCacheService {
    if (!QueryCacheService.instance) {
      QueryCacheService.instance = new QueryCacheService();
    }
    return QueryCacheService.instance;
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.memoryCache.entries()) {
        const ttl = this.getTTLForKey(key);
        if (now - entry.timestamp > ttl) {
          this.memoryCache.delete(key);
        }
      }
    }, 60 * 1000);
  }

  private getTTLForKey(key: string): number {
    if (key.includes('playerStats')) return CACHE_TTL.PLAYER_STATS;
    if (key.includes('gameSession')) return CACHE_TTL.GAME_SESSION;
    if (key.includes('leaderboard')) return CACHE_TTL.LEADERBOARD;
    return CACHE_TTL.GAME_SESSIONS;
  }

  private serializeKey(key: QueryKey): string {
    return JSON.stringify(key);
  }

  async connect(): Promise<void> {
    if (this.redis.status === 'wait') {
      await this.redis.connect();
    }
  }

  private getSessionKey(sessionId: string): string {
    return `${this.KEY_PREFIX}session:${sessionId}`;
  }

  private getPlayerSessionsKey(playerId: string): string {
    return `${this.KEY_PREFIX}sessions:player:${playerId}`;
  }

  private getSessionsListKey(filters: SessionFilters): string {
    const filterString = Object.entries(filters)
      .filter(([, value]) => value !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join('|');
    return `${this.KEY_PREFIX}sessions:list:${filterString || 'all'}`;
  }

  async get<T>(key: string): Promise<T | null> {
    await this.connect();
    const startTime = Date.now();
    
    try {
      const data = await this.redis.get(key);
      const latency = Date.now() - startTime;
      
      if (data) {
        telemetryService.emit('cache.hit', { key, latency });
        return JSON.parse(data) as T;
      }
      
      telemetryService.emit('cache.miss', { key, latency });
      return null;
    } catch (error) {
      telemetryService.emit('cache.error', { 
        key, 
        operation: 'get', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<boolean> {
    await this.connect();
    const startTime = Date.now();
    
    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttlSeconds, serialized);
      const latency = Date.now() - startTime;
      
      telemetryService.emit('cache.set', { key, ttl: ttlSeconds, latency });
      return true;
    } catch (error) {
      telemetryService.emit('cache.error', { 
        key, 
        operation: 'set', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    await this.connect();
    const startTime = Date.now();
    
    try {
      const result = await this.redis.del(key);
      const latency = Date.now() - startTime;
      
      telemetryService.emit('cache.delete', { key, deleted: result > 0, latency });
      return result > 0;
    } catch (error) {
      telemetryService.emit('cache.error', { 
        key, 
        operation: 'delete', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  async deleteByPattern(pattern: string): Promise<number> {
    await this.connect();
    const startTime = Date.now();
    
    try {
      let cursor = '0';
      let totalDeleted = 0;
      
      do {
        const [newCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = newCursor;
        
        if (keys.length > 0) {
          const deleted = await this.redis.del(...keys);
          totalDeleted += deleted;
        }
      } while (cursor !== '0');
      
      const latency = Date.now() - startTime;
      telemetryService.emit('cache.deletePattern', { pattern, deleted: totalDeleted, latency });
      return totalDeleted;
    } catch (error) {
      telemetryService.emit('cache.error', { 
        pattern, 
        operation: 'deleteByPattern', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return 0;
    }
  }

  getQueryCache<T>(queryKey: QueryKey): T | undefined {
    const key = this.serializeKey(queryKey);
    const entry = this.memoryCache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) return undefined;
    
    const ttl = this.getTTLForKey(key);
    if (Date.now() - entry.timestamp > ttl) {
      this.memoryCache.delete(key);
      return undefined;
    }
    
    return entry.data;
  }

  setQueryCache<T>(queryKey: QueryKey, data: T): void {
    const key = this.serializeKey(queryKey);
    this.memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      stale: false,
    });
  }

  invalidateQueryCache(queryKey: QueryKey): void {
    const key = this.serializeKey(queryKey);
    this.memoryCache.delete(key);
  }

  invalidateQueryCacheByPrefix(prefix: QueryKey): void {
    const prefixKey = this.serializeKey(prefix);
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(prefixKey.slice(0, -1))) {
        this.memoryCache.delete(key);
      }
    }
  }

  async prefetchGameSessions(playerId: string): Promise<GameSession[]> {
    const queryKey = CACHE_KEYS.GAME_SESSIONS(playerId);
    const cached = this.getQueryCache<GameSession[]>(queryKey);
    
    if (cached) {
      return cached;
    }

    const redisKey = this.getPlayerSessionsKey(playerId);
    const data = await this.get<GameSession[]>(redisKey);
    
    if (data) {
      this.setQueryCache(queryKey, data);
      return data;
    }

    return [];
  }

  async invalidateGameSessions(playerId: string): Promise<void> {
    const queryKey = CACHE_KEYS.GAME_SESSIONS(playerId);
    this.invalidateQueryCache(queryKey);
    
    const redisKey = this.getPlayerSessionsKey(playerId);
    await this.delete(redisKey);
    
    await this.deleteByPattern(`${this.KEY_PREFIX}sessions:list:*`);
  }

  async getCachedGameSession(sessionId: string): Promise<GameSession | null> {
    const queryKey = CACHE_KEYS.GAME_SESSION(sessionId);
    const cached = this.getQueryCache<GameSession>(queryKey);
    
    if (cached) {
      return cached;
    }

    const redisKey = this.getSessionKey(sessionId);
    const data = await this.get<GameSession>(redisKey);
    
    if (data) {
      this.setQueryCache(queryKey, data);
      return data;
    }

    return null;
  }

  async setGameSession(session: GameSession): Promise<boolean> {
    const queryKey = CACHE_KEYS.GAME_SESSION(session.id);
    this.setQueryCache(queryKey, session);
    
    const redisKey = this.getSessionKey(session.id);
    const ttlSeconds = Math.floor(CACHE_TTL.GAME_SESSION / 1000);
    return this.set(redisKey, session, ttlSeconds);
  }

  async getPlayerStats(playerId: string): Promise<PlayerStats | null> {
    const queryKey = CACHE_KEYS.PLAYER_STATS(playerId);
    const cached = this.getQueryCache<PlayerStats>(queryKey);
    
    if (cached) {
      return cached;
    }

    const redisKey = `${this.KEY_PREFIX}stats:player:${playerId}`;
    const data = await this.get<PlayerStats>(redisKey);
    
    if (data) {
      this.setQueryCache(queryKey, data);
      return data;
    }

    return null;
  }

  async setPlayerStats(stats: PlayerStats): Promise<boolean> {
    const queryKey = CACHE_KEYS.PLAYER_STATS(stats.playerId);
    this.setQueryCache(queryKey, stats);
    
    const redisKey = `${this.KEY_PREFIX}stats:player:${stats.playerId}`;
    const ttlSeconds = Math.floor(CACHE_TTL.PLAYER_STATS / 1000);
    return this.set(redisKey, stats, ttlSeconds);
  }

  async invalidatePlayerStats(playerId: string): Promise<void> {
    const queryKey = CACHE_KEYS.PLAYER_STATS(playerId);
    this.invalidateQueryCache(queryKey);
    
    const redisKey = `${this.KEY_PREFIX}stats:player:${playerId}`;
    await this.delete(redisKey);
  }

  async getLeaderboard(limit: number = 100): Promise<LeaderboardEntry[]> {
    const queryKey = CACHE_KEYS.LEADERBOARD(limit);
    const cached = this.getQueryCache<LeaderboardEntry[]>(queryKey);
    
    if (cached) {
      return cached;
    }

    const redisKey = `${this.KEY_PREFIX}leaderboard:${limit}`;
    const data = await this.get<LeaderboardEntry[]>(redisKey);
    
    if (data) {
      this.setQueryCache(queryKey, data);
      return data;
    }

    return [];
  }

  async setLeaderboard(entries: LeaderboardEntry[], limit: number = 100): Promise<boolean> {
    const queryKey = CACHE_KEYS.LEADERBOARD(limit);
    this.setQueryCache(queryKey, entries);
    
    const redisKey = `${this.KEY_PREFIX}leaderboard:${limit}`;
    const ttlSeconds = Math.floor(CACHE_TTL.LEADERBOARD / 1000);
    return this.set(redisKey, entries, ttlSeconds);
  }

  async invalidateLeaderboard(): Promise<void> {
    this.invalidateQueryCacheByPrefix(['leaderboard']);
    await this.deleteByPattern(`${this.KEY_PREFIX}leaderboard:*`);
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'down'; latency: number }> {
    const startTime = Date.now();
    
    try {
      await this.connect();
      await this.redis.ping();
      const latency = Date.now() - startTime;
      
      return { 
        status: latency < 100 ? 'healthy' : 'degraded', 
        latency 
      };
    } catch {
      return { status: 'down', latency: Date.now() - startTime };
    }
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
    this.memoryCache.clear();
  }
}

export const queryCacheService = QueryCacheService.getInstance();
export default queryCacheService;