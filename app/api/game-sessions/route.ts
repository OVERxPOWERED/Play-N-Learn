import { NextRequest, NextResponse } from 'next/server';
import { GameSessionService } from '@/lib/services/GameSessionService';
import { telemetryService } from '@/lib/services/TelemetryService';
import {
  createGameSessionSchema,
  updateGameSessionSchema,
  gameSessionQuerySchema,
  gameSessionIdSchema,
} from '@/utils/inputValidation';
import {
  GameSessionError,
  GameSessionNotFoundError,
  GameSessionValidationError,
  GameSessionStateError,
  GameSessionPermissionError,
} from '@/lib/errors/GameSessionErrors';
import { z } from 'zod';

const gameSessionService = new GameSessionService();

function handleGameSessionError(error: unknown): NextResponse {
  if (error instanceof GameSessionNotFoundError) {
    return NextResponse.json(
      { error: 'Game session not found', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }
  if (error instanceof GameSessionValidationError) {
    return NextResponse.json(
      { error: error.message, code: 'VALIDATION_ERROR', details: error.details },
      { status: 400 }
    );
  }
  if (error instanceof GameSessionStateError) {
    return NextResponse.json(
      { error: error.message, code: 'STATE_ERROR' },
      { status: 409 }
    );
  }
  if (error instanceof GameSessionPermissionError) {
    return NextResponse.json(
      { error: error.message, code: 'PERMISSION_DENIED' },
      { status: 403 }
    );
  }
  if (error instanceof GameSessionError) {
    return NextResponse.json(
      { error: error.message, code: 'GAME_SESSION_ERROR' },
      { status: 500 }
    );
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: 'Invalid request data', code: 'VALIDATION_ERROR', details: error.flatten() },
      { status: 400 }
    );
  }
  console.error('Unexpected error:', error);
  return NextResponse.json(
    { error: 'Internal server error', code: 'INTERNAL_ERROR' },
    { status: 500 }
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  let statusCode = 200;

  try {
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    const validatedQuery = gameSessionQuerySchema.parse(queryParams);

    const result = await gameSessionService.listGameSessions(validatedQuery);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    statusCode = error instanceof z.ZodError ? 400 : 500;
    return handleGameSessionError(error);
  } finally {
    const duration = Date.now() - startTime;
    telemetryService.recordApiCall({
      endpoint: '/api/game-sessions',
      method: 'GET',
      statusCode,
      duration,
    });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  let statusCode = 201;

  try {
    const body = await request.json();
    const validatedData = createGameSessionSchema.parse(body);

    const gameSession = await gameSessionService.createGameSession(validatedData);

    const response = NextResponse.json(gameSession, { status: 201 });
    response.headers.set('Location', `/api/game-sessions/${gameSession.id}`);
    return response;
  } catch (error) {
    statusCode = error instanceof z.ZodError ? 400 : 500;
    return handleGameSessionError(error);
  } finally {
    const duration = Date.now() - startTime;
    telemetryService.recordApiCall({
      endpoint: '/api/game-sessions',
      method: 'POST',
      statusCode,
      duration,
    });
  }
}