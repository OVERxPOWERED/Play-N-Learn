import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PlayerService } from '@/utils/playerService';
import { Player } from '@/src/domain';

const createPlayerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name must be 50 characters or less'),
  email: z.string().email('Invalid email format'),
  avatarUrl: z.string().url('Invalid URL format').optional().nullable(),
});

const playerService = new PlayerService();

function createSuccessResponse<T>(data: T, status: number = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

function createErrorResponse(error: string, status: number = 500) {
  return NextResponse.json({ success: false, error }, { status });
}

export async function GET() {
  try {
    const players = await playerService.getAllPlayers();
    return createSuccessResponse(players);
  } catch (error) {
    console.error('Error fetching players:', error);
    return createErrorResponse('Failed to fetch players', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const validationResult = createPlayerSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join('; ');
      return createErrorResponse(errorMessage, 400);
    }

    const { name, email, avatarUrl } = validationResult.data;
    
    const newPlayer = await playerService.createPlayer({
      name,
      email,
      avatarUrl: avatarUrl ?? undefined,
    });

    return createSuccessResponse(newPlayer, 201);
  } catch (error) {
    console.error('Error creating player:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        return createErrorResponse('A player with this email already exists', 409);
      }
      if (error.message.includes('not found')) {
        return createErrorResponse(error.message, 404);
      }
    }
    
    return createErrorResponse('Failed to create player', 500);
  }
}