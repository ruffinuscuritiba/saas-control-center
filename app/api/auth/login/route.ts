import { NextRequest, NextResponse } from 'next/server';
import { verifyMasterLogin, signMasterToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ message: 'Informe e-mail e senha.' }, { status: 400 });
  }

  let valid: boolean;
  try {
    valid = verifyMasterLogin(email, password);
  } catch {
    return NextResponse.json({ message: 'Painel não configurado no servidor.' }, { status: 503 });
  }

  if (!valid) {
    return NextResponse.json({ message: 'Credenciais inválidas.' }, { status: 401 });
  }

  const accessToken = signMasterToken(email);
  return NextResponse.json({ accessToken });
}
