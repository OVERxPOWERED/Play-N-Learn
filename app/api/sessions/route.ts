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
  endedAt: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
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
        { error: 'Player already has an active session for this module', sessionId: existingActiveSession.id },
        { status: 409 }
      );
    }

    const session = await playerService.startSession(playerId, moduleId);

    if (status !== SessionStatus.ACTIVE) {
      await playerService.updateSession(session.id, { status });
    }

    const updatedSession = await playerService.getSession(session.id);
    if (!updatedSession) {
      return NextResponse.json(
        { error: 'Failed to retrieve created session' },
        { status: 500 }
      );
    }

    return NextResponse.json(enrichSession(updatedSession), { status: 201 });
  } catch (error) {
    console.error('POST /api/sessions error:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validationResult = updateSessionSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const updateData = validationResult.data;

    const existingSession = await playerService.getSession(sessionId);
    if (!existingSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (existingSession.status === SessionStatus.COMPLETED || existingSession.status === SessionStatus.ABANDONED) {
      return NextResponse.json(
        { error: 'Cannot update a completed or abandoned session' },
        { status: 400 }
      );
    }

    const updatedSession = await playerService.updateSession(sessionId, updateData);

    return NextResponse.json(enrichSession(updatedSession));
  } catch (error) {
    console.error('PATCH /api/sessions error:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const existingSession = await playerService.getSession(sessionId);
    if (!existingSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (existingSession.status === SessionStatus.ACTIVE) {
      return NextResponse.json(
        { error: 'Cannot delete an active session. Abandon it first.' },
        { status: 400 }
      );
    }

    await playerService.deleteSession(sessionId);

    return NextResponse.json({ success: true, message: 'Session deleted' });
  } catch (error) {
    console.error('DELETE /api/s