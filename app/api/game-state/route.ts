import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { GameStateService } from '@/lib/services/game-state-service';
import { telemetryService } from '@/lib/services/telemetry-service';
import { GameState, GameStateStatus } from '@/lib/types/game-state';

// Zod schemas for request validation
const createGameStateSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID format'),
  initialLevel: z.number().int().min(1).max(100).default(1),
  initialProgress: z.number().min(0).max(1).default(0),
  metadata: z.record(z.unknown()).optional(),
});

const updateGameStateSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID format'),
  progress: z.number().min(0).max(1).optional(),
  level: z.number().int().min(1).max(100).optional(),
  status: z.enum(['active', 'paused', 'completed', 'abandoned']).optional(),
  metadata: z.record(z.unknown()).optional(),
  completedAt: z.string().datetime().optional().nullable(),
});

const getGameStateSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID format'),
});

const deleteGameStateSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID format'),
  reason: z.enum(['completed', 'abandoned']).default('abandoned'),
});

// Standardized response helpers
function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

function errorResponse(code: string, message: string, status: number = 400) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status }
  );
}

// Telemetry helper
function trackApiCall(
  method: string,
  endpoint: string,
  statusCode: number,
  durationMs: number,
  sessionId?: string
) {
  telemetryService.trackEvent('api_call', {
    method,
    endpoint,
    statusCode,
    durationMs,
    sessionId,
  });
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const endpoint = '/api/game-state';

  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    const validation = getGameStateSchema.safeParse({ sessionId });
    if (!validation.success) {
      const duration = Date.now() - startTime;
      trackApiCall('GET', endpoint, 400, duration);
      return errorResponse(
        'VALIDATION_ERROR',
        validation.error.errors.map((e) => e.message).join(', '),
        400
      );
    }

    const gameState = await GameStateService.getGameState(validation.data.sessionId);

    if (!gameState) {
      const duration = Date.now() - startTime;
      trackApiCall('GET', endpoint, 404, duration, validation.data.sessionId);
      return errorResponse('GAME_STATE_NOT_FOUND', 'Game state not found for session', 404);
    }

    const duration = Date.now() - startTime;
    trackApiCall('GET', endpoint, 200, duration, validation.data.sessionId);
    return successResponse(gameState, 200);
  } catch (error) {
    const duration = Date.now() - startTime;
    trackApiCall('GET', endpoint, 500, duration);
    console.error('[GET /api/game-state] Error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch game state', 500);
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const endpoint = '/api/game-state';

  try {
    const body = await request.json();
    const validation = createGameStateSchema.safeParse(body);

    if (!validation.success) {
      const duration = Date.now() - startTime;
      trackApiCall('POST', endpoint, 400, duration);
      return errorResponse(
        'VALIDATION_ERROR',
        validation.error.errors.map((e) => e.message).join(', '),
        400
      );
    }

    const { sessionId, initialLevel, initialProgress, metadata } = validation.data;

    // Check if game state already exists
    const existingState = await GameStateService.getGameState(sessionId);
    if (existingState) {
      const duration = Date.now() - startTime;
      trackApiCall('POST', endpoint, 409, duration, sessionId);
      return errorResponse('GAME_STATE_EXISTS', 'Game state already exists for this session', 409);
    }

    const gameState = await GameStateService.createGameState({
      sessionId,
      level: initialLevel,
      progress: initialProgress,
      status: 'active',
      metadata: metadata ?? {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    trackApiCall('POST', endpoint, 201, duration, sessionId);
    return successResponse(gameState, 201);
  } catch (error) {
    const duration = Date.now() - startTime;
    trackApiCall('POST', endpoint, 500, duration);
    console.error('[POST /api/game-state] Error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to create game state', 500);
  }
}

export async function PATCH(request: NextRequest) {
  const startTime = Date.now();
  const endpoint = '/api/game-state';

  try {
    const body = await request.json();
    const validation = updateGameStateSchema.safeParse(body);

    if (!validation.success) {
      const duration = Date.now() - startTime;
      trackApiCall('PATCH', endpoint, 400, duration);
      return errorResponse(
        'VALIDATION_ERROR',
        validation.error.errors.map((e) => e.message).join(', '),
        400
      );
    }

    const { sessionId, ...updates } = validation.data;

    // Verify game state exists
    const existingState = await GameStateService.getGameState(sessionId);
    if (!existingState) {
      const duration = Date.now() - startTime;
      trackApiCall('PATCH', endpoint, 404, duration, sessionId);
      return errorResponse('GAME_STATE_NOT_FOUND', 'Game state not found for session', 404);
    }

    // Prevent updates to completed/abandoned states unless explicitly transitioning
    if (
      existingState.status === 'completed' ||
      existingState.status === 'abandoned'
    ) {
      const allowedTransitions = ['completed', 'abandoned'];
      if (updates.status && !allowedTransitions.includes(updates.status)) {
        const duration = Date.now() - startTime;
        trackApiCall('PATCH', endpoint, 409, duration, sessionId);
        return errorResponse(
          'INVALID_STATE_TRANSITION',
          `Cannot update game state with status: ${existingState.status}`,
          409
        );
      }
    }

    const updatePayload: Partial<GameState> = {
      ...updates,
      completedAt: updates.completedAt ?? undefined,
      updatedAt: new Date().toISOString(),
    };

    const gameState = await GameStateService.updateGameState(sessionId, updatePayload);

    const duration = Date.now() - startTime;
    trackApiCall('PATCH', endpoint, 200, duration, sessionId);
    return successResponse(gameState, 200);
  } catch (error) {
    const duration = Date.now() - startTime;
    trackApiCall('PATCH', endpoint, 500, duration);
    console.error('[PATCH /api/game-state] Error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to update game state', 500);
  }
}

export async function DELETE(request: NextRequest) {
  const startTime = Date.now();
  const endpoint = '/api/game-state';

  try {
    const body = await request.json();
    const validation = deleteGameStateSchema.safeParse(body);

    if (!validation.success) {
      const duration = Date.now() - startTime;
      trackApiCall('DELETE', endpoint, 400, duration);
      return errorResponse(
        'VALIDATION_ERROR',
        validation.error.errors.map((e) => e.message).join(', '),
        400
      );
    }

    const { sessionId, reason } = validation.data;

    const existingState = await GameStateService.getGameState(sessionId);
    if (!existingState) {
      const duration = Date.now() - startTime;
      trackApiCall('DELETE', endpoint, 404, duration, sessionId);
      return errorResponse('GAME_STATE_NOT_FOUND', 'Game state not found for session', 404);
    }

    const finalStatus: GameStateStatus = reason === 'completed' ? 'completed' : 'abandoned';
    const gameState = await GameStateService.updateGameState(sessionId, {
      status: finalStatus,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    trackApiCall('DELETE', endpoint, 200, duration, sessionId);
    return successResponse(gameState, 200);
  } catch (error) {
    const duration = Date.now() - startTime;
    trackApiCall('DELETE', endpoint, 500, duration);
    console.error('[DELETE /api/game-state] Error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to complete/abandon game state', 500);
  }
}