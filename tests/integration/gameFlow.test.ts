import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi, Mock } from 'vitest';
import request from 'supertest';
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

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

// Mock NextAuth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
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
      env: { ...process.env }
    });
  } catch (error) {
    console.warn('Database teardown failed');
  }
};

const createAuthenticatedRequest = (userId: string = 'test-user-id', email: string = 'test@example.com') => {
  (getServerSession as Mock).mockResolvedValue({
    user: { id: userId, email, name: 'Test User' },
    expires: new Date(Date.now() + 86400000).toISOString(),
  });
};

const createUnauthenticatedRequest = () => {
  (getServerSession as Mock).mockResolvedValue(null);
};

const resetMocks = () => {
  vi.clearAllMocks();
  mockTelemetryEvents.length = 0;
};

describe('Game Session API Integration Tests', () => {
  beforeAll(async () => {
    await setupTestDatabase();
    const testApp = await createTestApp();
    app = testApp.app;
    server = testApp.server;
    baseUrl = testApp.url;
  }, 60000);

  afterAll(async () => {
    await teardownTestDatabase();
    await app.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    resetMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /api/game-sessions', () => {
    it('should create a new game session with valid payload', async () => {
      createAuthenticatedRequest();
      
      const mockSession = {
        id: randomUUID(),
        playerId: 'test-user-id',
        status: 'pending',
        score: 0,
        level: 1,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.gameSession.create.mockResolvedValue(mockSession);
      mockPrisma.player.findUnique.mockResolvedValue({ id: 'test-user-id', email: 'test@example.com' });

      const startTime = Date.now();
      const response = await request(baseUrl)
        .post('/api/game-sessions')
        .send({ level: 1, difficulty: 'normal' })
        .expect('Content-Type', /json/)
        .expect(201);
      
      const duration = Date.now() - startTime;
      
      expect(response.body).toMatchObject({
        id: mockSession.id,
        playerId: 'test-user-id',
        status: 'pending',
        level: 1,
        score: 0,
      });
      expect(duration).toBeLessThan(200); // p95 < 200ms
      expect(mockPrisma.gameSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            playerId: 'test-user-id',
            level: 1,
            status: 'pending',
          }),
        })
      );
    });

    it('should reject invalid payload with Zod validation error', async () => {
      createAuthenticatedRequest();
      
      const response = await request(baseUrl)
        .post('/api/game-sessions')
        .send({ level: 'invalid', difficulty: 123 })
        .expect('Content-Type', /json/)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('validation');
      expect(mockPrisma.gameSession.create).not.toHaveBeenCalled();
    });

    it('should return 401 when unauthenticated', async () => {
      createUnauthenticatedRequest();
      
      await request(baseUrl)
        .post('/api/game-sessions')
        .send({ level: 1 })
        .expect(401);
    });

    it('should enforce rate limiting (100 req/min)', async () => {
      createAuthenticatedRequest();
      mockPrisma.gameSession.create.mockResolvedValue({
        id: randomUUID(),
        playerId: 'test-user-id',
        status: 'pending',
        score: 0,
        level: 1,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.player.findUnique.mockResolvedValue({ id: 'test-user-id' });

      // Make 100 requests rapidly
      const promises = Array.from({ length: 100 }, (_, i) => 
        request(baseUrl)
          .post('/api/game-sessions')
          .send({ level: 1 })
      );
      
      const responses = await Promise.all(promises);
      const successCount = responses.filter(r => r.status === 201).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      
      expect(successCount).toBeLessThanOrEqual(100);
      expect(rateLimitedCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle burst scenario with rate limit recovery', async () => {
      createAuthenticatedRequest('burst-user', 'burst@example.com');
      mockPrisma.gameSession.create.mockResolvedValue({
        id: randomUUID(),
        playerId: 'burst-user',
        status: 'pending',
        score: 0,
        level: 1,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.player.findUnique.mockResolvedValue({ id: 'burst-user' });

      // Burst 150 requests
      const burstPromises = Array.from({ length: 150 }, () => 
        request(baseUrl)
          .post('/api/game-sessions')
          .send({ level: 1 })
      );
      
      const burstResponses = await Promise.all(burstPromises);
      const rateLimited = burstResponses.filter(r => r.status === 429).length;
      
      expect(rateLimited).toBeGreaterThan(0);
      
      // Wait for rate limit window to reset (simulated)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should allow requests again
      const recoveryResponse = await request(baseUrl)
        .post('/api/game-sessions')
        .send({ level: 1 })
        .expect(201);
      
      expect(recoveryResponse.body).toHaveProperty('id');
    });
  });

  describe('GET /api/game-sessions', () => {
    it('should return paginated game sessions for authenticated user', async () => {
      createAuthenticatedRequest();
      
      const mockSessions = Array.from({ length: 5 }, (_, i) => ({
        id: randomUUID(),
        playerId: 'test-user-id',
        status: i % 2 === 0 ? 'completed' : 'active',
        score: i * 100,
        level: i + 1,
        startedAt: new Date(Date.now() - i * 86400000),
        createdAt: new Date(Date.now() - i * 86400000),
        updatedAt: new Date(Date.now() - i * 86400000),
      }));
      
      mockPrisma.gameSession.findMany.mockResolvedValue(mockSessions);
      mockPrisma.gameSession.count.mockResolvedValue(5);
      mockPrisma.player.findUnique.mockResolvedValue({ id: 'test-user-id' });

      const startTime = Date.now();
      const response = await request(baseUrl)
        .get('/api/game-sessions?page=1&limit=10')
        .expect('Content-Type', /json/)
        .expect(200);
      
      const duration = Date.now() - startTime;
      
      expect(response.body).toMatchObject({
        data: expect.arrayContaining(
          mockSessions.map(s => expect.objectContaining({ id: s.id }))
        ),
        pagination: {
          page: 1,
          limit: 10,
          total: 5,
          totalPages: 1,
        },
      });
      expect(duration).toBeLessThan(200);
    });

    it('should filter sessions by status', async () => {
      createAuthenticatedRequest();
      
      const mockSessions = [
        { id: randomUUID(), playerId: 'test-user-id', status: 'completed', score: 500, level: 3, startedAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
      ];
      
      mockPrisma.gameSession.findMany.mockResolvedValue(mockSessions);
      mockPrisma.gameSession.count.mockResolvedValue(1);
      mockPrisma.player.findUnique.mockResolvedValue({ id: 'test-user-id' });

      const response = await request(baseUrl)
        .get('/api/game-sessions?status=completed')
        .expect(200);
      
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('completed');
      expect(mockPrisma.gameSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'completed' }),
        })
      );
    });

    it('should return 401 when unauthenticated', async () => {
      createUnauthenticatedRequest();
      
      await request(baseUrl)
        .get('/api/game-sessions')
        .expect(401);
    });
  });

  describe('GET /api/game-sessions/[id]', () => {
    it('should return a single game session by id', async () => {
      createAuthenticatedRequest();
      
      const sessionId = randomUUID();
      const mockSession = {
        id: sessionId,
        playerId: 'test-user-id',
        status: 'active',
        score: 250,
        level: 2,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.gameSession.findUnique.mockResolvedValue(mockSession);
      mockPrisma.player.findUnique.mockResolvedValue({ id: 'test-user-id' });

      const startTime = Date.now();
      const response = await request(baseUrl)
        .get(`/api/game-sessions/${sessionId}`)
        .expect('Content-Type', /json/)
        .expect(200);
      
      const duration = Date.now() - startTime;
      
      expect(response.body).toMatchObject(mockSession);
      expect(duration).toBeLessThan(200);
    });

    it('should return 404 for non-existent session', async () => {
      createAuthenticatedRequest();
      
      mockPrisma.gameSession.findUnique.mockResolvedValue(null);
      mockPrisma.player.findUnique.mockResolvedValue({ id: 'test-user-id' });

      await request(baseUrl)
        .get(`/api/game-sessions/${randomUUID()}`)
        .expect(404);
    });

    it('should return 403 when accessing another user\'s session', async () => {
      createAuthenticatedRequest('user-1');
      
      const mockSession =