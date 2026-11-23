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

export const REACT_QUERY_CONFIG = {
  staleTime: 30 * 1000,
  gcTime: 5 * 60 * 1000,
  retry: 2,
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
} as const;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  stale: boolean;
}

type QueryFunction<T> = () => Promise<T>;

interface ReactQueryOptions<T> {
  queryKey: QueryKey;
  queryFn: QueryFunction<T>;
  staleTime?: number;
  gcTime?: number;
  retry?: number;
  enabled?: boolean;
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
      .join(',');
    return `${this.KEY_PREFIX}sessions:list:${filterString || 'all'}`;
  }

  async getGameSession(sessionId: string): Promise<GameSession | null> {
    const key = this.getSessionKey(sessionId);
    const cached = this.memoryCache.get(key);
    if (cached && !cached.stale) {
      return cached.data as GameSession;
    }

    try {
      const data = await this.redis.get(key);
      if (data) {
        const session = JSON.parse(data) as GameSession;
        this.memoryCache.set(key, { data: session, timestamp: Date.now(), stale: false });
        return session;
      }
    } catch (error) {
      telemetryService.emit('cache.get.error', { key, error: (error as Error).message });
    }
    return null;
  }

  async setGameSession(session: GameSession): Promise<void> {
    const key = this.getSessionKey(session.id);
    const ttl = CACHE_TTL.GAME_SESSION;
    try {
      await this.redis.setex(key, Math.floor(ttl / 1000), JSON.stringify(session));
      this.memoryCache.set(key, { data: session, timestamp: Date.now(), stale: false });
      await this.invalidatePlayerSessions(session.playerId);
    } catch (error) {
      telemetryService.emit('cache.set.error', { key, error: (error as Error).message });
    }
  }

  async getPlayerSessions(playerId: string, filters: SessionFilters = {}): Promise<GameSession[]> {
    const key = this.getPlayerSessionsKey(playerId);
    const cached = this.memoryCache.get(key);
    if (cached && !cached.stale) {
      return cached.data as GameSession[];
    }

    try {
      const data = await this.redis.get(key);
      if (data) {
        const sessions = JSON.parse(data) as GameSession[];
        this.memoryCache.set(key, { data: sessions, timestamp: Date.now(), stale: false });
        return sessions;
      }
    } catch (error) {
      telemetryService.emit('cache.get.error', { key, error: (error as Error).message });
    }
    return [];
  }

  async setPlayerSessions(playerId: string, sessions: GameSession[]): Promise<void> {
    const key = this.getPlayerSessionsKey(playerId);
    const ttl = CACHE_TTL.GAME_SESSIONS;
    try {
      await this.redis.setex(key, Math.floor(ttl / 1000), JSON.stringify(sessions));
      this.memoryCache.set(key, { data: sessions, timestamp: Date.now(), stale: false });
    } catch (error) {
      telemetryService.emit('cache.set.error', { key, error: (error as Error).message });
    }
  }

  async invalidatePlayerSessions(playerId: string): Promise<void> {
    const key = this.getPlayerSessionsKey(playerId);
    const entry = this.memoryCache.get(key);
    if (entry) {
      this.memoryCache.set(key, { ...entry, stale: true });
    }
    try {
      await this.redis.del(key);
    } catch (error) {
      telemetryService.emit('cache.invalidate.error', { key, error: (error as Error).message });
    }
  }

  async invalidateGameSession(sessionId: string): Promise<void> {
    const key = this.getSessionKey(sessionId);
    const entry = this.memoryCache.get(key);
    if (entry) {
      this.memoryCache.set(key, { ...entry, stale: true });
    }
    try {
      await this.redis.del(key);
    } catch (error) {
      telemetryService.emit('cache.invalidate.error', { key, error: (error as Error).message });
    }
  }

  async getPlayerStats(playerId: string): Promise<PlayerStats | null> {
    const key = `${this.KEY_PREFIX}stats:${playerId}`;
    const cached = this.memoryCache.get(key);
    if (cached && !cached.stale) {
      return cached.data as PlayerStats;
    }

    try {
      const data = await this.redis.get(key);
      if (data) {
        const stats = JSON.parse(data) as PlayerStats;
        this.memoryCache.set(key, { data: stats, timestamp: Date.now(), stale: false });
        return stats;
      }
    } catch (error) {
      telemetryService.emit('cache.get.error', { key, error: (error as Error).message });
    }
    return null;
  }

  async setPlayerStats(stats: PlayerStats): Promise<void> {
    const key = `${this.KEY_PREFIX}stats:${stats.playerId}`;
    const ttl = CACHE_TTL.PLAYER_STATS;
    try {
      await this.redis.setex(key, Math.floor(ttl / 1000), JSON.stringify(stats));
      this.memoryCache.set(key, { data: stats, timestamp: Date.now(), stale: false });
    } catch (error) {
      telemetryService.emit('cache.set.error', { key, error: (error as Error).message });
    }
  }

  async getLeaderboard(limit: number = 100): Promise<LeaderboardEntry[]> {
    const key = `${this.KEY_PREFIX}leaderboard:${limit}`;
    const cached = this.memoryCache.get(key);
    if (cached && !cached.stale) {
      return cached.data as LeaderboardEntry[];
    }

    try {
      const data = await this.redis.get(key);
      if (data) {
        const leaderboard = JSON.parse(data) as LeaderboardEntry[];
        this.memoryCache.set(key, { data: leaderboard, timestamp: Date.now(), stale: false });
        return leaderboard;
      }
    } catch (error) {
      telemetryService.emit('cache.get.error', { key, error: (error as Error).message });
    }
    return [];
  }

  async setLeaderboard(entries: LeaderboardEntry[], limit: number = 100): Promise<void> {
    const key = `${this.KEY_PREFIX}leaderboard:${limit}`;
    const ttl = CACHE_TTL.LEADERBOARD;
    try {
      await this.redis.setex(key, Math.floor(ttl / 1000), JSON.stringify(entries));
      this.memoryCache.set(key, { data: entries, timestamp: Date.now(), stale: false });
    } catch (error) {
      telemetryService.emit('cache.set.error', { key, error: (error as Error).message });
    }
  }

  async invalidateAll(): Promise<void> {
    this.memoryCache.clear();
    try {
      const keys = await this.redis.keys(`${this.KEY_PREFIX}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      telemetryService.emit('cache.invalidateAll.error', { error: (error as Error).message });
    }
  }

  getMemoryCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.memoryCache.size,
      keys: Array.from(this.memoryCache.keys()),
    };
  }

  createQueryOptions<T>(queryKey: QueryKey, queryFn: QueryFunction<T>, options: Partial<ReactQueryOptions<T>> = {}): ReactQueryOptions<T> {
    return {
      queryKey,
      queryFn,
      staleTime: REACT_QUERY_CONFIG.staleTime,
      gcTime: REACT_QUERY_CONFIG.gcTime,
      retry: REACT_QUERY_CONFIG.retry,
      ...options,
    };
  }

  createGameSessionsQueryOptions(playerId?: string, filters: SessionFilters = {}): ReactQueryOptions<GameSession[]> {
    return this.createQueryOptions<GameSession[]>(
      CACHE_KEYS.GAME_SESSIONS(playerId),
      async () => {
        const response = await fetch('/api/game-sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId, ...filters }),
        });
        if (!response.ok) throw new Error