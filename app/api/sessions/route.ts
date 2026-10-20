import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { GameSessionService } from '@/lib/services/GameSessionService';
import { Logger } from '@/lib/telemetry/Logger';
import { ErrorTracker } from '@/lib/telemetry/ErrorTracker';
import { 
  CreateGameSessionSchema, 
  UpdateGameSessionSchema,
  GameSessionResponseSchema,
  GameSessionListResponseSchema,
  GameSessionIdParamsSchema 
} from '@/lib/domain';

// Initialize services
const gameSessionService = new GameSessionService();
const logger = new Logger({ service: 'api-sessions' });
const errorTracker = new ErrorTracker({ service: 'api-sessions' });

// Request ID middleware
function withRequestId(handler: (req: NextRequest, requestId: string) => Promise<NextResponse>) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const requestId = req.headers.get('x-request-id') || uuidv4();
    const startTime = Date.now();
    
    logger.info('API request started', { 
      requestId, 
      method: req.method, 
      url: req.url 
    });

    try {
      const response = await handler(req, requestId);
      
      const duration = Date.now() - startTime;
      logger.info('API request completed', { 
        requestId, 
        status: response.status, 
        duration 
      });
      
      response.headers.set('x-request-id', requestId);
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      errorTracker.capture(error as Error, { 
        requestId, 
        method: req.method, 
        url: req.url,
        duration 
      });
      
      logger.error('API request failed', { 
        requestId, 
        error: (error as Error).message,
        duration 
      });
      
      return NextResponse.json(
        { error: 'Internal server error', requestId },
        { status: 500, headers: { 'x-request-id': requestId } }
      );
    }
  };
}

// GET /api/sessions - List player sessions
export const GET = withRequestId(async (req: NextRequest, requestId: string) => {
  try {
    const { searchParams } = new URL(req.url);
    const playerId = searchParams.get('playerId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!playerId) {
      return NextResponse.json(
        { error: 'playerId query parameter is required', requestId },
        { status: 400 }
      );
    }

    const sessions = await gameSessionService.listPlayerSessions(playerId, {
      status: status as any,
      limit,
      offset
    });

    const validatedResponse = GameSessionListResponseSchema.parse({
      sessions,
      total: sessions.length,
      limit,
      offset
    });

    return NextResponse.json(validatedResponse, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors, requestId },
        { status: 400 }
      );
    }
    throw error;
  }
});

// POST /api/sessions - Create session
export const POST = withRequestId(async (req: NextRequest, requestId: string) => {
  try {
    const body = await req.json();
    
    const validatedInput = CreateGameSessionSchema.parse({
      ...body,
      requestId
    });

    const session = await gameSessionService.createSession(validatedInput);
    
    const validatedResponse = GameSessionResponseSchema.parse(session);

    logger.info('Game session created', { 
      requestId, 
      sessionId: session.id,
      playerId: session.playerId 
    });

    return NextResponse.json(validatedResponse, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors, requestId },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: error.message, requestId },
        { status: 404 }
      );
    }
    throw error;
  }
});