import { NextRequest, NextResponse } from 'next/server';
import { requireMasterAuth } from '@/lib/guard';
import { impersonate } from '@/lib/adapters';
import type { SystemKey } from '@/lib/types';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ system: string; id: string }> },
) {
  const denied = requireMasterAuth(req);
  if (denied) return denied;

  const { system, id } = await params;
  try {
    const result = await impersonate(system as SystemKey, id);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ message: (e as Error).message }, { status: 502 });
  }
}
