import { NextRequest, NextResponse } from 'next/server';
import { PlayerService } from '@/services/playerService';
import { telemetry } from '@/utils/telemetry';
import { validatePlayerCreate, validatePaginationParams } from '@/utils/validation';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId: string;
    timestamp: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

function createResponse<T>(
  success: boolean,
  data?: T,
  error?: ApiResponse<T>['error'],
  meta?: ApiResponse<T>['meta']
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success,
      data,
      error,
      meta: {
        ...meta,
        timestamp: new Date().toISOString(),
      },
    },
    { status: success ? (data ? 200 : 201) : (error?.code === 'VALIDATION_ERROR' ? 400 : 500) }
  );
}

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';
    const search = searchParams.get('search') || undefined;

    const validation = validatePaginationParams({ page, limit, sortBy, sortOrder });
    if (!validation.valid) {
      telemetry.recordApiError('players.list', 'VALIDATION_ERROR', Date.now() - startTime);
      return createResponse(false, undefined, {
        code: 'VALIDATION_ERROR',
        message: 'Invalid pagination parameters',
        details: validation.errors,
      }, { requestId });
    }

    const playerService = PlayerService.getInstance();
    const result = await playerService.listPlayers({
      page: validation.data!.page,
      limit: validation.data!.limit,
      sortBy: validation.data!.sortBy,
      sortOrder: validation.data!.sortOrder,
      search,
    });

    telemetry.recordApiRequest('players.list', 200, Date.now() - startTime);

    return createResponse(true, result.players, undefined, {
      requestId,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    telemetry.recordApiError('players.list', 'INTERNAL_ERROR', duration);
    
    console.error('[API] GET /api/players error:', { requestId, error });
    
    return createResponse(false, undefined, {
      code: 'INTERNAL_ERROR',
      message: 'Failed to retrieve players',
    }, { requestId });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      telemetry.recordApiError('players.create', 'INVALID_JSON', Date.now() - startTime);
      return createResponse(false, undefined, {
        code: 'INVALID_JSON',
        message: 'Request body must be valid JSON',
      }, { requestId });
    }

    const validation = validatePlayerCreate(body);
    if (!validation.valid) {
      telemetry.recordApiError('players.create', 'VALIDATION_ERROR', Date.now() - startTime);
      return createResponse(false, undefined, {
        code: 'VALIDATION_ERROR',
        message: 'Invalid player data',
        details: validation.errors,
      }, { requestId });
    }

    const playerService = PlayerService.getInstance();
    const player = await playerService.createPlayer(validation.data!);

    telemetry.recordApiRequest('players.create', 201, Date.now() - startTime);

    return createResponse(true, player, undefined, { requestId });
  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (error instanceof Error && error.message.includes('duplicate')) {
      telemetry.recordApiError('players.create', 'CONFLICT', duration);
      return createResponse(false, undefined, {
        code: 'CONFLICT',
        message: 'Player with this identifier already exists',
      }, { requestId });
    }

    telemetry.recordApiError('players.create', 'INTERNAL_ERROR', duration);
    console.error('[API] POST /api/players error:', { requestId, error });

    return createResponse(false, undefined, {
      code: 'INTERNAL_ERROR',
      message: 'Failed to create player',
    }, { requestId });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';