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

export interface SessionFilters {
  status?: GameSession['status'];
  playerId?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'score' | 'currentWave';
  sortOrder?: 'asc' | 'desc';
}

class QueryCacheService {
  private redis: Redis;
  private readonly DEFAULT_SESSION_TTL = 60;
  private readonly DEFAULT_LIST_TTL = 30;
  private readonly KEY_PREFIX = 'game:';

  constructor() {
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
    let deletedCount = 0;
    
    try {
      const stream = this.redis.scanStream({
        match: `${this.KEY_PREFIX}${pattern}`,
        count: 100,
      });

      for await (const keys of stream) {
        if (keys.length > 0) {
          const result = await this.redis.del(...keys);
          deletedCount += result;
        }
      }

      const latency = Date.now() - startTime;
      telemetryService.emit('cache.deleteByPattern', { pattern, deletedCount, latency });
      return deletedCount;
    } catch (error) {
      telemetryService.emit('cache.error', { 
        pattern, 
        operation: 'deleteByPattern', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return 0;
    }
  }

  async getSession(sessionId: string): Promise<GameSession | null> {
    return this.get<GameSession>(this.getSessionKey(sessionId));
  }

  async setSession(session: GameSession): Promise<boolean> {
    return this.set(this.getSessionKey(session.id), session, this.DEFAULT_SESSION_TTL);
  }

  async invalidateSession(sessionId: string): Promise<boolean> {
    const sessionKey = this.getSessionKey(sessionId);
    const deleted = await this.delete(sessionKey);
    
    if (deleted) {
      telemetryService.emit('cache.invalidate', { type: 'session', id: sessionId });
    }
    return deleted;
  }

  async getPlayerSessions(playerId: string): Promise<GameSession[] | null> {
    return this.get<GameSession[]>(this.getPlayerSessionsKey(playerId));
  }

  async setPlayerSessions(playerId: string, sessions: GameSession[]): Promise<boolean> {
    return this.set(this.getPlayerSessionsKey(playerId), sessions, this.DEFAULT_LIST_TTL);
  }

  async invalidatePlayerSessions(playerId: string): Promise<boolean> {
    const playerKey = this.getPlayerSessionsKey(playerId);
    const deleted = await this.delete(playerKey);
    
    if (deleted) {
      telemetryService.emit('cache.invalidate', { type: 'playerSessions', playerId });
    }
    return deleted;
  }

  async getSessionsList(filters: SessionFilters): Promise<GameSession[] | null> {
    return this.get<GameSession[]>(this.getSessionsListKey(filters));
  }

  async setSessionsList(filters: SessionFilters, sessions: GameSession[]): Promise<boolean> {
    return this.set(this.getSessionsListKey(filters), sessions, this.DEFAULT_LIST_TTL);
  }

  async invalidateSessionsList(filters?: SessionFilters): Promise<number> {
    if (filters) {
      return this.delete(this.getSessionsListKey(filters)) ? 1 : 0;
    }
    return this.deleteByPattern('sessions:list:*');
  }

  async invalidateAllSessionCaches(sessionId: string, playerId: string): Promise<void> {
    await Promise.all([
      this.invalidateSession(sessionId),
      this.invalidatePlayerSessions(playerId),
      this.invalidateSessionsList(),
    ]);
    
    telemetryService.emit('cache.invalidateAll', { sessionId, playerId });
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency: number }> {
    const startTime = Date.now();
    
    try {
      await this.connect();
      await this.redis.ping();
      const latency = Date.now() - startTime;
      return { status: 'healthy', latency };
    } catch {
      const latency = Date.now() - startTime;
      return { status: 'unhealthy', latency };
    }
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
    telemetryService.emit('cache.disconnected');
  }
}

export const queryCacheService = new QueryCacheService();