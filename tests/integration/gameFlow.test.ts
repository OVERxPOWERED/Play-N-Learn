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
    execSync(`dropdb ${testDbUrl.split('/').pop()}`, { 
      stdio: 'ignore',
      env: { ...process.env, DATABASE_URL: testDbUrl }
    });
  } catch (error) {
    console.warn('Database cleanup failed');
  }
};

// Helper to create authenticated request
const createAuthRequest = (token?: string) => {
  const req = request(baseUrl);
  if (token) {
    req.set('Authorization', `Bearer ${token}`);
  }
  return req;
};

// Valid state transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  CREATED: ['ACTIVE', 'ABANDONED'],
  ACTIVE: ['PAUSED', 'COMPLETED', 'ABANDONED'],
  PAUSED: ['ACTIVE', 'ABANDONED'],
  COMPLETED: [],
  ABANDONED: [],
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
    await mockPrisma.$disconnect();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockTelemetryEvents.length = 0;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /api/game-sessions', () => {
    it('creates a new game session with valid payload', async () => {
      const sessionId = randomUUID();
      const playerId = randomUUID();
      
      mockPrisma.gameSession.create.mockResolvedValue({
        id: sessionId,
        playerId,
        state: 'CREATED',
        score: 0,
        level: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await createAuthRequest('valid-token')
        .post('/api/game-sessions')
        .send({ playerId, level: 1 })
        .expect(201);

      expect(response.body).toMatchObject({
        id: sessionId,
        playerId,
        state: 'CREATED',
        score: 0,
        level: 1,
      });
      expect(response.body.createdAt).toBeDefined();
      expect(mockPrisma.gameSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ playerId, level: 1 }),
        })
      );
    });

    it('rejects empty payload with 400', async () => {
      const response = await createAuthRequest('valid-token')
        .post('/api/game-sessions')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toContainEqual(
        expect.objectContaining({ field: 'playerId' })
      );
    });

    it('rejects malformed UUID with 400', async () => {
      const response = await createAuthRequest('valid-token')
        .post('/api/game-sessions')
        .send({ playerId: 'not-a-uuid', level: 1 })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toContainEqual(
        expect.objectContaining({ field: 'playerId' })
      );
    });

    it('returns 401 for unauthorized access', async () => {
      const response = await request(baseUrl)
        .post('/api/game-sessions')
        .send({ playerId: randomUUID(), level: 1 })
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });

    it('returns 429 when rate limit exceeded', async () => {
      // Simulate rate limiting by making many requests
      const promises = Array(101).fill(null).map(() => 
        createAuthRequest('valid-token')
          .post('/api/game-sessions')
          .send({ playerId: randomUUID(), level: 1 })
      );

      const responses = await Promise.all(promises);
      const rateLimited = responses.some(r => r.status === 429);
      expect(rateLimited).toBe(true);
    });
  });

  describe('GET /api/game-sessions', () => {
    it('returns list of game sessions for player', async () => {
      const playerId = randomUUID();
      const sessions = [
        { id: randomUUID(), playerId, state: 'COMPLETED', score: 100, level: 1, createdAt: new Date(), updatedAt: new Date() },
        { id: randomUUID(), playerId, state: 'ACTIVE', score: 50, level: 2, createdAt: new Date(), updatedAt: new Date() },
      ];

      mockPrisma.gameSession.findMany.mockResolvedValue(sessions);

      const response = await createAuthRequest('valid-token')
        .get(`/api/game-sessions?playerId=${playerId}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject(sessions[0]);
      expect(mockPrisma.gameSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { playerId },
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('returns empty array when no sessions exist', async () => {
      mockPrisma.gameSession.findMany.mockResolvedValue([]);

      const response = await createAuthRequest('valid-token')
        .get(`/api/game-sessions?playerId=${randomUUID()}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('returns 400 when playerId is missing', async () => {
      const response = await createAuthRequest('valid-token')
        .get('/api/game-sessions')
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('returns 401 for unauthorized access', async () => {
      const response = await request(baseUrl)
        .get(`/api/game-sessions?playerId=${randomUUID()}`)
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });
  });

  describe('PATCH /api/game-sessions/:id', () => {
    const sessionId = randomUUID();
    const playerId = randomUUID();

    beforeEach(() => {
      mockPrisma.gameSession.findUnique.mockResolvedValue({
        id: sessionId,
        playerId,
        state: 'CREATED',
        score: 0,
        level: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('updates state with valid transition CREATED -> ACTIVE', async () => {
      mockPrisma.gameSession.update.mockResolvedValue({
        id: sessionId,
        playerId,
        state: 'ACTIVE',
        score: 0,
        level: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await createAuthRequest('valid-token')
        .patch(`/api/game-sessions/${sessionId}`)
        .send({ state: 'ACTIVE' })
        .expect(200);

      expect(response.body.state).toBe('ACTIVE');
      expect(mockPrisma.gameSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: sessionId },
          data: { state: 'ACTIVE' },
        })
      );
    });

    it('updates state with valid transition ACTIVE -> PAUSED', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue({
        id: sessionId,
        playerId,
        state: 'ACTIVE',
        score: 100,
        level: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockPrisma.gameSession.update.mockResolvedValue({
        id: sessionId,
        playerId,
        state: 'PAUSED',
        score: 100,
        level: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await createAuthRequest('valid-token')
        .patch(`/api/game-sessions/${sessionId}`)
        .send({ state: 'PAUSED' })
        .expect(200);

      expect(response.body.state).toBe('PAUSED');
    });

    it('updates state with valid transition PAUSED -> ACTIVE', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue({
        id: sessionId,
        playerId,
        state: 'PAUSED',
        score: 100,
        level: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockPrisma.gameSession.update.mockResolvedValue({
        id: sessionId,
        playerId,
        state: 'ACTIVE',
        score: 100,
        level: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await createAuthRequest('valid-token')
        .patch(`/api/game-sessions/${sessionId}`)
        .send({ state: 'ACTIVE' })
        .expect(200);

      expect(response.body.state).toBe('ACTIVE');
    });

    it('updates state with valid transition ACTIVE -> COMPLETED', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue({
        id: sessionId,
        playerId,
        state: 'ACTIVE',
        score: 500,
        level: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockPrisma.gameSession.update.mockResolvedValue({
        id: sessionId,
        playerId,
        state: 'COMPLETED',
        score: 500,
        level: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await createAuthRequest('valid-token')
        .patch(`/api/game-sessions/${sessionId}`)
        .send({ state: 'COMPLETED', score: 500 })
        .expect(200);

      expect(response.body.state).toBe('COMPLETED');
      expect(response.body.score).toBe(500);
    });

    it('updates state with valid transition ACTIVE -> ABANDONED', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue({
        id: sessionId,
        playerId,
        state: 'ACTIVE',
        score: 100,
        level: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockPrisma.gameSession.update.mockResolvedValue({
        id: sessionId,
        playerId,
        state: 'ABANDONED',
        score: 100,
        level: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await createAuthRequest('valid-token')
        .patch(`/api/game-sessions/${sessionId}`)
        .send({ state: 'ABANDONED' })
        .expect(200);

      expect(response.body.state).toBe('ABANDONED');
    });

    it('rejects invalid transition CREATED -> COMPLETED with 400', async () => {
      const response = await createAuthRequest('valid-token')
        .patch(`/api/game-sessions/${sessionId}`)
        .send({ state: 'COMPLETED' })
        .expect(400);

      expect(response.body.error).toBe('Invalid state transition');
      expect(response.body.details).toContain('CREATED -> COMPLETED');
    });

    it('rejects invalid transition COMPLETED -> ACTIVE with 400', async () => {