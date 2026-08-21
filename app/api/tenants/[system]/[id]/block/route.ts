import { NextRequest, NextResponse } from 'next/server';
import { requireMasterAuth } from '@/lib/guard';
import { toggleBlock } from '@/lib/adapters';
import type { SystemKey } from '@/lib/types';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ system: string; id: string }> },
) {
  const denied = requireMasterAuth(req);
  if (denied) return denied;

  const { system, id } = await params;
  const { currentlyBlocked } = await req.json().catch(() => ({ currentlyBlocked: false }));

  try {
    await toggleBlock(system as SystemKey, id, !!currentlyBlocked);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ message: (e as Error).message }, { status: 502 });
  }
}
