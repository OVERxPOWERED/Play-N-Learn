```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, Mock } from 'vitest';
import request from 'supertest';
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { EventEmitter } from 'events';

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
  clearTelemetryEvents: vi.fn(() => mockTelemetryEvents.length = 0),
}));

// Test utilities
let app: ReturnType<typeof next>;
let server: ReturnType<typeof createServer>;
let baseUrl: string;

const createTestApp = async () => {
  const nextApp = next({ dev: false, dir: process.cwd() });
  await nextApp.prepare();
  const handle = nextApp.getRequestHandler();
  
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });
  
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => resolve());
  });
  
  const port = (httpServer.address() as { port: number }).port;
  return { app: nextApp, server: httpServer, url: `http://localhost:${port}` };
};

describe('Game Flow Integration Tests', () => {
  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    server = testApp.server;
    baseUrl = testApp.url;
  });

  afterAll(async () => {
    await server.close();
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockTelemetryEvents.length = 0;
  });

  describe('Player Creation', () => {
    it('should create a new player successfully', async () => {
      const playerData = {
        username: 'testplayer_' + Date.now(),
        displayName: 'Test Player',
        avatarUrl: 'https://example.com/avatar.png',
      };

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

      // Verify telemetry event emitted
      const telemetryEvent = mockTelemetryEvents.find(e => e.event === 'player_created');
      expect(telemetryEvent).toBeDefined();
      expect(telemetryEvent?.data).toMatchObject({
        playerId: response.body.id,
        username: playerData.username,
      });
    });

    it('should reject duplicate username', async () => {
      const username = 'duplicate_user_' + Date.now();
      const playerData = { username, displayName: 'Test' };

      await request(baseUrl).post('/api/players').send(playerData).expect(201);
      const response = await request(baseUrl).post('/api/players').send(playerData).expect(409);

      expect(response.body).toMatchObject({
        error: 'Username already exists',
        code: 'DUPLICATE_USERNAME',
      });
    });

    it('should validate required fields', async () => {
      const response = await request(baseUrl)
        .post('/api/players')
        .send({ displayName: 'No Username' })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: expect.arrayContaining([
          expect.objectContaining({ field: 'username' }),
        ]),
      });
    });

    it('should sanitize and validate username format', async () => {
      const invalidUsernames = [
        'ab', // too short
        'a'.repeat(21), // too long
        'user@name', // invalid chars
        'user name', // spaces
        '', // empty
      ];

      for (const username of invalidUsernames) {
        const response = await request(baseUrl)
          .post('/api/players')
          .send({ username, displayName: 'Test' })
          .expect(400);
        
        expect(response.body.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('Game Session Lifecycle', ()