import { NextRequest, NextResponse } from 'next/server';
import { extractBearer, verifyMasterToken } from './auth';

/** Retorna null se autorizado, ou a Response de erro pra devolver direto. */
export function requireMasterAuth(req: NextRequest): NextResponse | null {
  const token = extractBearer(req.headers.get('authorization'));
  if (!token || !verifyMasterToken(token)) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: 401 });
  }
  return null;
}
