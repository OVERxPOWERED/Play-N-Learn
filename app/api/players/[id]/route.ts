import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PlayerService } from '@/lib/services/player-service';
import { Player } from '@/lib/types/player';

const playerService = new PlayerService();

const uuidSchema = z.string().uuid('Invalid player ID format');

const updatePlayerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  avatarUrl: z.string().url().optional().nullable(),
  stats: z.record(z.unknown()).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const validation = uuidSchema.safeParse(id);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid player ID', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const player = await playerService.getPlayer(id);

    if (!player) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(player);
  } catch (error) {
    console.error('Error fetching player:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idValidation = uuidSchema.safeParse(id);

    if (!idValidation.success) {
      return NextResponse.json(
        { error: 'Invalid player ID', details: idValidation.error.flatten() },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = updatePlayerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const existingPlayer = await playerService.getPlayer(id);
    if (!existingPlayer) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      );
    }

    const updatedPlayer = await playerService.updatePlayer(id, validation.data);

    return NextResponse.json(updatedPlayer);
  } catch (error) {
    console.error('Error updating player:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const validation = uuidSchema.safeParse(id);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid player ID', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const existingPlayer = await playerService.getPlayer(id);
    if (!existingPlayer) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      );
    }

    await playerService.deletePlayer(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting player:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}