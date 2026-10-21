```typescript
import { EventEmitter } from 'events';
import { GameState, GameStatePatch, PlayerState, GamePhase } from '@/types/game';
import { GameStateService } from './gameStateService';
import { TelemetryService } from './telemetryService';
import { v4 as uuidv4 } from 'uuid';

interface SSEConnection {
  id: string;
  sessionId: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
  lastHeartbeat: number;
  reconnectCount: number;
}

interface RedisAdapter {
  publish(channel: string, message: string): Promise<void>;
  subscribe(channel: string, callback: (message: string) => void): Promise<void>;
  unsubscribe(channel: string): Promise<void>;
}

class InMemoryRedisAdapter implements RedisAdapter {
  private channels: Map<string, Set<(message: string) => void>> = new Map();

  async publish(channel: string, message: string): Promise<void> {
    const subscribers = this.channels.get(channel);
    if (subscribers) {
      subscribers.forEach(callback => callback(message));
    }
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel)!.add(callback);
  }

  async unsubscribe(channel: string): Promise<void> {
    this.channels.delete(channel);
  }
}

export class GameStateSyncService extends GameStateService {
  private static instance: GameStateSyncService;
  private connections: Map<string, SSEConnection> = new Map();
  private sessionSubscriptions: Map<string, Set<string>> = new Map();
  private eventEmitter: EventEmitter;
  private redisAdapter: RedisAdapter;
  private telemetry: TelemetryService;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 30000;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY = 1000;

  private constructor() {
    super();
    this.eventEmitter = new EventEmitter();
    this.eventEmitter.setMaxListeners(1000);
    this.redisAdapter = new InMemoryRedisAdapter();
    this.telemetry = TelemetryService.getInstance();
    this.startHeartbeat();
    this.setupRedisListeners();
  }

  static getInstance(): GameStateSyncService {
    if (!GameStateSyncService.instance) {
      GameStateSyncService.instance = new GameStateSyncService();
    }
    return GameStateSyncService.instance;
  }

  setRedisAdapter(adapter: RedisAdapter): void {
    this.redisAdapter = adapter;
    this.setupRedisListeners();
  }

  private setupRedisListeners(): void {
    this.redisAdapter.subscribe('game-state-sync', this.handleRedisMessage.bind(this));
  }

  private async handleRedisMessage(message: string): Promise<void> {
    try {
      const { sessionId, patch, sourceInstanceId } = JSON.parse(message);
      if (sourceInstanceId !== this.getInstanceId()) {
        await this.applyPatchLocally(sessionId, patch);
      }
    } catch (error) {
      this.telemetry.recordError('redis_message_parse_error', { error: String(error) });
    }
  }

  private getInstanceId(): string {
    return process.env.INSTANCE_ID || `instance-${process.pid}`;
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeats();
      this.cleanupStaleConnections();
    }, this.HEARTBEAT_INTERVAL);
  }

  private sendHeartbeats(): void {
    const now = Date.now();
    const encoder = new TextEncoder();
    
    this.connections.forEach((connection, connectionId) => {
      try {
        const heartbeat = encoder.encode(`:heartbeat\n\n`);
        connection.controller.enqueue(heartbeat);
        connection.lastHeartbeat = now;
      } catch (error) {
        this.removeConnection(connectionId);
      }
    });
  }

  private cleanupStaleConnections(): void {
    const now = Date.now();
    const staleThreshold = this.HEARTBEAT_INTERVAL * 3;

    this.connections.forEach((connection, connectionId) => {
      if (now - connection.lastHeartbeat > staleThreshold) {
        this.removeConnection(connectionId);
      }
    });
  }

  createSSEStream(sessionId: string): ReadableStream<Uint8Array> {
    const connectionId = uuidv4();
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        const connection: SSEConnection = {
          id: connectionId,
          sessionId,
          controller,
          lastHeartbeat: Date.now(),
          reconnectCount: 0,
        };

        this.connections.set(connectionId, connection);
        this.addSessionSubscription(sessionId, connectionId);

        const initMessage = encoder.encode(`data: ${JSON.stringify({ type: 'connected', connectionId })}\n\n`);
        controller.enqueue(initMessage);

        this.sendCurrentState(sessionId, controller);
      },
      cancel: () => {
        this.removeConnection(connectionId);
      },
    });

    return stream;
  }

  private async sendCurrentState(sessionId: string, controller: ReadableStreamDefaultController<Uint8Array>): Promise<void> {
    const startTime = performance.now();
    try {
      const state = await this.getGameState(sessionId);
      if (state) {
        const encoder = new TextEncoder();
        const message = encoder.encode(`data: ${JSON.stringify({ type: 'state', payload: state })}\n\n`);
        controller.enqueue(message);
      }
    } finally {
      const latency = performance.now() - startTime;
      this.telemetry.recordMetric('sse_initial_state_latency_ms', latency);
    }
  }

  private addSessionSubscription(sessionId: string, connectionId: string): void {
    if (!this.sessionSubscriptions.has(sessionId)) {
      this.sessionSubscriptions.set(sessionId, new Set());
    }
    this.sessionSubscriptions.get(sessionId)!.add(connectionId);
  }

  private removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      const sessionConnections = this.sessionSubscriptions.get(connection.sessionId);
      if (sessionConnections) {
        sessionConnections.delete(connectionId);
        if (sessionConnections.size === 0) {
          this.sessionSubscriptions.delete(connection.sessionId);
        }
      }
      this.connections.delete(connectionId);
      try {
        connection.controller.close();
      } catch {
        // Controller already closed
      }
    }
  }

  subscribe(sessionId: string, callback: (state: GameState) => void): () => void {
    const subscriptionId = uuidv4();
    
    const handler = (event: { sessionId: string; state: GameState }) => {
      if (event.sessionId === sessionId) {
        callback(event.state);
      }
    };

    this.eventEmitter.on('stateUpdate', handler);

    return () => {
      this.eventEmitter.off('stateUpdate', handler);
    };
  }

  async broadcast(sessionId: string, patch: GameStatePatch): Promise<void> {
    const startTime = performance.now();
    const instanceId = this.getInstanceId();

    try {
      await this.applyPatchLocally(sessionId, patch);

      const updatedState = await this.getGameState(sessionId);
      if (updatedState) {
        this.eventEmitter.emit('stateUpdate', { sessionId, state: updatedState });
        await this.sendToSessionConnections(sessionId, { type: 'patch', payload: patch });
        await this.publishToRedis(sessionId, patch, instanceId);
      }
    } finally {
      const latency = performance.now() - startTime;
      this.telemetry.recordMetric('