import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi, Mock } from 'vitest';
import request from 'supertest';
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

// Mock OGL and GSAP for jsdom environment
vi.mock('ogl', () => ({
  Renderer: vi.fn().mockImplementation(() => ({
    gl: {
      canvas: document.createElement('canvas'),
      clearColor: vi.fn(),
      clear: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      viewport: vi.fn(),
    },
    render: vi.fn(),
    setSize: vi.fn(),
  })),
  Camera: vi.fn(),
  Transform: vi.fn().mockImplementation(() => ({
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    add: vi.fn(),
    remove: vi.fn(),
  })),
  Mesh: vi.fn(),
  Geometry: vi.fn(),
  Program: vi.fn(),
  Texture: vi.fn(),
  Vec3: vi.fn(),
  Vec2: vi.fn(),
  Mat4: vi.fn(),
  Quat: vi.fn(),
  Polyline: vi.fn(),
  Flowmap: vi.fn(),
}));

vi.mock('gsap', () => ({
  gsap: {
    to: vi.fn((target, vars) => ({
      play: vi.fn(),
      pause: vi.fn(),
      kill: vi.fn(),
      progress: vi.fn(),
      ...vars,
    })),
    from: vi.fn(),
    fromTo: vi.fn(),
    timeline: vi.fn(() => ({
      to: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      play: vi.fn(),
      pause: vi.fn(),
      kill: vi.fn(),
    })),
    set: vi.fn(),
    killTweensOf: vi.fn(),
  },
  ScrollTrigger: {
    create: vi.fn(),
    refresh: vi.fn(),
  },
}));

vi.mock('@gsap/react', () => ({
  useGSAP: vi.fn((callback) => callback()),
}));

// Mock telemetry module
const mockTelemetryEvents: Array<{ event: string; data: unknown; timestamp: number }> = [];
vi.mock('@/lib/telemetry', () => ({
  emitTelemetry: vi.fn((event: string, data: unknown) => {
    mockTelemetryEvents.push({ event, data, timestamp: Date.now() });
  }),
  getTelemetryEvents: vi.fn(() => [...mockTelemetryEvents]),
  clearTelemetryEvents: vi.fn(() => { mockTelemetryEvents.length = 0; }),
}));

// Mock Prisma Client
const mockPrisma = {
  player: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  gameSession: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  score: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    aggregate: vi.fn(),
  },
  telemetryEvent: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(mockPrisma)),
  $disconnect: vi.fn(),
};

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

// Test utilities
let app: ReturnType<typeof next>;
let server: ReturnType<typeof createServer>;
let baseUrl: string;
let testDbUrl: string;

const createTestApp = async () => {
  const nextApp = next({ dev: false, dir: process.cwd() });
  await nextApp.prepare();
  const handle = nextApp.getRequestHandler();
  
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });
  
  await new Promise<void>((resolve, reject) => {
    httpServer.listen(0, () => resolve());
    httpServer.on('error', reject);
  });
  
  const port = (httpServer.address() as { port: number }).port;
  return { app: nextApp, server: httpServer, url: `http://localhost:${port}` };
};

const setupTestDatabase = async () => {
  testDbUrl = `postgresql://test:test@localhost:5432/game_test_${randomUUID().slice(0, 8)}`;
  process.env.DATABASE_URL = testDbUrl;
  
  try {
    execSync('npx prisma migrate deploy', { 
      stdio: 'ignore',
      env: { ...process.env, DATABASE_URL: testDbUrl }
    });
  } catch (error) {
    console.warn('Migration failed, using mock Prisma');
  }
};

const teardownTestDatabase = async () => {
  try {
    execSync(`dropdb ${testDbUrl.split('/').pop()}`, { stdio: 'ignore' });
  } catch {
    // Ignore cleanup errors
  }
};

describe('Game Flow Integration Tests', () => {
  beforeAll(async () => {
    await setupTestDatabase();
    const testApp = await createTestApp();
    app = testApp.app;
    server = testApp.server;
    baseUrl = testApp.url;
  }, 60000);

  afterAll(async () => {
    await server.close();
    await app.close();
    await teardownTestDatabase();
  }, 30000);

  beforeEach(() => {
    vi.clearAllMocks();
    mockTelemetryEvents.length = 0;
    
    // Reset Prisma mocks with default implementations
    mockPrisma.player.create.mockReset();
    mockPrisma.player.findUnique.mockReset();
    mockPrisma.player.findMany.mockReset();
    mockPrisma.player.update.mockReset();
    
    mockPrisma.gameSession.create.mockReset();
    mockPrisma.gameSession.findUnique.mockReset();
    mockPrisma.gameSession.findMany.mockReset();
    mockPrisma.gameSession.findFirst.mockReset();
    mockPrisma.gameSession.update.mockReset();
    mockPrisma.gameSession.updateMany.mockReset();
    
    mockPrisma.score.create.mockReset();
    mockPrisma.score.findUnique.mockReset();
    mockPrisma.score.findMany.mockReset();
    mockPrisma.score.findFirst.mockReset();
    mockPrisma.score.update.mockReset();
    mockPrisma.score.aggregate.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Player Creation', () => {
    it('should create a new player successfully', async () => {
      const playerData = {
        username: 'testplayer_' + Date.now(),
        displayName: 'Test Player',
        avatarUrl: 'https://example.com/avatar.png',
      };

      const createdPlayer = {
        id: randomUUID(),
        ...playerData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stats: {
          gamesPlayed: 0,
          gamesWon: 0,
          totalScore: 0,
          highestScore: 0,
        },
      };

      mockPrisma.player.create.mockResolvedValue(createdPlayer);

      const response = await request(baseUrl)
        .post('/api/players')
        .send(playerData)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        username: playerData.username,
        displayName: playerData.displayName,
        avatarUrl: playerData.avatarUrl,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        stats: {
          gamesPlayed: 0,
          gamesWon: 0,
          totalScore: 0,
          highestScore: 0,
        },
      });

      expect(mockPrisma.player.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          username: playerData.username,
          displayName: playerData.displayName,
          avatarUrl: playerData.avatarUrl,
        }),
      });

      // Verify telemetry event emitted
      const { emitTelemetry } = await import('@/lib/telemetry');
      expect(emitTelemetry).toHaveBeenCalledWith('player_created', expect.objectContaining({
        playerId: expect.any(String),
        username: playerData.username,
      }));
    });

    it('should reject duplicate username with 409', async () => {
      const playerData = {
        username: 'duplicate_user',
        displayName: 'Test Player',
      };

      mockPrisma.player.create.mockRejectedValue({
        code: 'P2002',
        meta: { target: ['username'] },
      });

      const response = await request(baseUrl)
        .post('/api/players')
        .send(playerData)
        .expect('Content-Type', /json/)
        .expect(409);

      expect(response.body).toMatchObject({
        error: 'Username already exists',
        code: 'DUPLICATE_USERNAME',
      });
    });

    it('should validate required fields', async () => {
      const response = await request(baseUrl)
        .post('/api/players')
        .send({ displayName: 'No Username' })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.stringContaining('username'),
        code: 'VALIDATION_ERROR',
      });
    });
  });

  describe('Complete Session Flow', () => {
    let playerId: string;
    let sessionId: string;

    beforeEach(() => {
      playerId = randomUUID();
      sessionId = randomUUID();
    });

    it('should complete full game session lifecycle: create -> start -> progress -> complete', async () => {
      // Step 1: Create player
      const player = {
        id: playerId,
        username: 'flow_test_' + Date.now(),
        displayName: 'Flow Test Player',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stats: { gamesPlayed: 0, gamesWon: 0, totalScore: 0, highestScore: 0 },
      };
      mockPrisma.player.findUnique.mockResolvedValue(player);

      // Step 2: Create session
      const newSession = {
        id: sessionId,
        playerId,
        status: 'CREATED',
        level: 1,
        score: 0,
        startedAt: null,
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockPrisma.gameSession.create.mockResolvedValue(newSession);

      const createResponse = await request(baseUrl)
        .post('/api/sessions')
        .send({ playerId, level: 1 })
        .expect('Content-Type', /json/)
        .expect(201);

      expect(createResponse.body).toMatchObject({
        id: sessionId,
        playerId,
        status: 'CREATED',
        level: 1,
        score: 0,
      });

      // Verify session_created telemetry
      const { emitTelemetry, getTelemetryEvents } = await import('@/lib/telemetry');
      expect(emitTelemetry).toHaveBeenCalledWith('session_created', expect.objectContaining({
        sessionId,
        playerId,
        level: 1,
      }));

      // Step 3: Start session
      const startedSession = { ...newSession, status: 'IN_PROGRESS', startedAt: new Date().toISOString() };
      mockPrisma.gameSession.update.mockResolvedValue(startedSession);

      const startResponse = await request(baseUrl)
        .patch(`/api/sessions/${sessionId}/start`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(startResponse.body).toMatchObject({
        id: sessionId,
        status: 'IN_PROGRESS',
        startedAt: expect.any(String),
      });

      expect(emitTelemetry).toHaveBeenCalledWith('session_started', expect.objectContaining({
        sessionId,
        playerId,
      }));

      // Step 4: Progress session (multiple updates)
      const progressData = { score: 1500, level: 2, moves: 25 };
      const progressedSession = { ...startedSession, ...progressData, updatedAt: new Date().toISOString() };
      mockPrisma.gameSession.update.mockResolvedValue(progressedSession);

      const progressResponse = await request(baseUrl)
        .patch(`/api/sessions/${sessionId}/progress`)
        .send(progressData)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(progressResponse.body).toMatchObject({
        id: sessionId,
        score: 1500,
        level: 2,
      });

      expect(emitTelemetry).toHaveBeenCalledWith('session_progress', expect.objectContaining({
        sessionId,
        playerId,
        score: 1500,
        level: 2,
        moves: 25,
      }));

      // Step 5: Complete session
      const completedSession = { 
        ...progressedSession, 
        status: 'COMPLETED', 
        completedAt: new Date().toISOString(),
        finalScore: 1500,
      };
      mockPrisma.gameSession.update.mockResolvedValue(completedSession);
      mockPrisma.player.update.mockResolvedValue({
        ...player,
        stats: { gamesPlayed: 1, gamesWon: 1, totalScore: 1500, highestScore: 1500 },
      });
      mockPrisma.score.create.mockResolvedValue({
        id: randomUUID(),
        playerId,
        sessionId,
        value: 1500,
        level: 2,
        createdAt: new Date().toISOString(),
      });

      const completeResponse = await request(baseUrl)
        .patch(`/api/sessions/${sessionId}/complete`)
        .send({ finalScore: 1500 })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(completeResponse.body).toMatchObject({
        id: sessionId,
        status: 'COMPLETED',
        finalScore: 1500,
        completedAt: expect.any(String),
      });

      // Verify completion telemetry
      expect(emitTelemetry).toHaveBeenCalledWith('session_completed', expect.objectContaining({
        sessionId,
        playerId,
        finalScore: 1500,
        duration: expect.any(Number),
      }));

      // Verify score persistence
      expect(mockPrisma.score.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          playerId,
          sessionId,
          value: 1500,
          level: 2,
        }),
      });

      // Verify player stats updated
      expect(mockPrisma.player.update).toHaveBeenCalledWith({
        where: { id: playerId },
        data: expect.objectContaining({
          stats: expect.objectContaining({
            gamesPlayed: 1,
            gamesWon: 1,
            totalScore: 1500,
            highestScore: 1500,
          }),
        }),
      });
    });

    it('should handle session abandonment', async () => {
      const abandonedSession = {
        id: sessionId,
        playerId,
        status: 'IN_PROGRESS',
        level: 1,
        score: 500,
        startedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      mockPrisma.gameSession.findUnique.mockResolvedValue(abandonedSession);
      mockPrisma.gameSession.update.mockResolvedValue({
        ...abandonedSession,
        status: 'ABANDONED',
        completedAt: new Date().toISOString(),
      });

      const response = await request(baseUrl)
        .patch(`/api/sessions/${sessionId}/abandon`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toMatchObject({
        id: sessionId,
        status: 'ABANDONED',
      });

      const { emitTelemetry } = await import('@/lib/telemetry');
      expect(emitTelemetry).toHaveBeenCalledWith('session_abandoned', expect.objectContaining({
        sessionId,
        playerId,
        score: 500,
      }));
    });
  });

  describe('Concurrent Session Handling', () => {
    it('should prevent multiple active sessions for same player', async () => {
      const playerId = randomUUID();
      const existingSessionId =