import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Session, SessionStatus } from '@/src/domain';
import { PlayerService } from '@/src/services/player-service';

const playerService = new PlayerService();

const createSessionSchema = z.object({
  playerId: z.string().uuid('Invalid player ID format'),
  moduleId: z.string().min(1, 'Module ID is required'),
  status: z.nativeEnum(SessionStatus).default(SessionStatus.ACTIVE),
});

const updateSessionSchema = z.object({
  status: z.nativeEnum(SessionStatus).optional(),
  progress: z.number().min(0).max(100).optional(),
  score: z.number().min(0).optional(),
  endedAt: z.string().datetime().optional().transform((val) => (val ? new Date(val) : undefined)),
});

const querySchema = z.object({
  playerId: z.string().uuid('Invalid player ID format'),
  status: z.nativeEnum(SessionStatus).optional(),
  moduleId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

function computeDuration(session: Session): number {
  const endTime = session.endedAt || new Date();
  return Math.floor((endTime.getTime() - session.startedAt.getTime()) / 1000);
}

function enrichSession(session: Session) {
  return {
    ...session,
    duration: computeDuration(session),
    isActive: session.status === SessionStatus.ACTIVE,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryResult = querySchema.safeParse(Object.fromEntries(searchParams));

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const { playerId, status, moduleId, limit, offset } = queryResult.data;

    const sessions = await playerService.getSessions(playerId, {
      status,
      moduleId,
      limit,
      offset,
    });

    const enrichedSessions = sessions.map(enrichSession);

    return NextResponse.json({
      sessions: enrichedSessions,
      pagination: { limit, offset, total: enrichedSessions.length },
    });
  } catch (error) {
    console.error('GET /api/sessions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = createSessionSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { playerId, moduleId, status } = validationResult.data;

    const existingActiveSession = await playerService.getActiveSession(playerId, moduleId);
    if (existingActiveSession) {
      return NextResponse.json(
        { error: 'Player already has an active session for this module' },
        { status: 409 }
      );
    }

    const session = await playerService.createSession({ playerId, moduleId, status });
    return NextResponse.json(enrichSession(session), { status: 201 });
  } catch (error) {
    console.error('POST /api/sessions error:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}