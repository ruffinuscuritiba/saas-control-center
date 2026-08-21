import { NextRequest, NextResponse } from 'next/server';
import { requireMasterAuth } from '@/lib/guard';
import { resetPassword } from '@/lib/adapters';
import type { SystemKey } from '@/lib/types';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ system: string; id: string }> },
) {
  const denied = requireMasterAuth(req);
  if (denied) return denied;

  const { system, id } = await params;
  const { newPassword } = await req.json().catch(() => ({}));
  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json({ message: 'Senha precisa ter ao menos 8 caracteres.' }, { status: 400 });
  }

  try {
    const result = await resetPassword(system as SystemKey, id, newPassword);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ message: (e as Error).message }, { status: 502 });
  }
}
