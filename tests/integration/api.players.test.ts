```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getPlayers, POST as createPlayer } from '@/app/api/players/route';
import { GET as getPlayer, PATCH as updatePlayer, DELETE as deletePlayer } from '@/app/api/players/[id]/route';
import { PlayerService } from '@/lib/services/player.service';
import { authMiddleware } from '@/lib/auth/middleware';

// Mock dependencies
vi.mock('@/lib/services/player.service');
vi.mock('@/lib/auth/middleware');

const mockPlayerService = vi.mocked(PlayerService);
const mockAuthMiddleware = vi.mocked(authMiddleware);

// Test utilities
const createMockRequest = (method: string, url: string, body?: unknown) => {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
};

const createMockParams = (id: string) => Promise.resolve({ id });

describe('Player API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthMiddleware.mockResolvedValue({ user: { id: 'user-1', email: 'test@example.com' } });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/players', () => {
    it('returns empty list when no players exist', async () => {
      mockPlayerService.getAllPlayers.mockResolvedValue([]);

      const request = createMockRequest('GET', 'http://localhost/api/players');
      const response = await getPlayers(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ players: [], total: 0 });
      expect(mockPlayerService.getAllPlayers).toHaveBeenCalledWith({});
    });

    it('returns populated list with pagination', async () => {
      const mockPlayers = [
        { id: '1', name: 'Player One', email: 'one@example.com', createdAt: new Date(), updatedAt: new Date() },
        { id: '2', name: 'Player Two', email: 'two@example.com', createdAt: new Date(), updatedAt: new Date() },
      ];
      mockPlayerService.getAllPlayers.mockResolvedValue({ players: mockPlayers, total: 2 });

      const request = createMockRequest('GET', 'http://localhost/api/players?page=1&limit=10');
      const response = await getPlayers(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.players).toHaveLength(2);
      expect(data.total).toBe(2);
      expect(mockPlayerService.getAllPlayers).toHaveBeenCalledWith({ page: 1, limit: 10 });
    });

    it('returns 401 when auth fails', async () => {
      mockAuthMiddleware.mockResolvedValue(null);

      const request = createMockRequest('GET', 'http://localhost/api/players');
      const response = await getPlayers(request);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/players', () => {
    it('creates player with valid data', async () => {
      const newPlayer = { id: '3', name: 'New Player', email: 'new@example.com', createdAt: new Date(), updatedAt: new Date() };
      mockPlayerService.createPlayer.mockResolvedValue(newPlayer);

      const request = createMockRequest('POST', 'http://localhost/api/players', {
        name: 'New Player',
        email: 'new@example.com',
      });
      const response = await createPlayer(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.player).toEqual(newPlayer);
      expect(mockPlayerService.createPlayer).toHaveBeenCalledWith({
        name: 'New Player',
        email: 'new@example.com',
      });
    });

    it('returns 400 when name is missing', async () => {
      const request = createMockRequest('POST', 'http://localhost/api/players', {
        email: 'test@example.com',
      });
      const response = await createPlayer(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('name');
    });

    it('returns 400 when email is invalid', async () => {
      const request = createMockRequest('POST', 'http://localhost/api/players', {
        name: 'Test Player',
        email: 'invalid-email',
      });
      const response = await createPlayer(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('email');
    });

    it('returns 409 when email already exists', async () => {
      mockPlayerService.createPlayer.mockRejectedValue(new Error('Email already exists'));

      const request = createMockRequest('POST', 'http://localhost/api/players', {
        name: 'Test Player',
        email: 'existing@example.com',
      });
      const response = await createPlayer(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain('already exists');
    });

    it('returns 401 when auth fails', async () => {
      mockAuthMiddleware.mockResolvedValue(null);

      const request = createMockRequest('POST', 'http://localhost/api/players', {
        name: 'Test Player',
        email: 'test@example.com',
      });
      const response = await createPlayer(request);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/players/[id]', () => {
    it('returns player when found', async () => {
      const mockPlayer = { id: '1', name: 'Player One', email: 'one@example.com', createdAt: new Date(), updatedAt: new Date() };
      mockPlayerService.getPlayerById.mockResolvedValue(mockPlayer);

      const request = createMockRequest('GET', 'http://localhost/api/players/1');
      const response = await getPlayer(request, { params: createMockParams('1') });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.player).toEqual(mockPlayer);
      expect(mockPlayerService.getPlayerById).toHaveBeenCalledWith('1');
    });

    it('returns 404 when player not found', async () => {
      mockPlayerService.getPlayerById.mockResolvedValue(null);

      const request = createMockRequest('GET', 'http://localhost/api/players/999');
      const response = await getPlayer(request, { params: createMockParams('999') });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });

    it('returns 401 when auth fails', async () => {
      mockAuthMiddleware.mockResolvedValue(null);

      const request = createMockRequest('GET', 'http://localhost/api/players/1');
      const response = await getPlayer(request, { params: create