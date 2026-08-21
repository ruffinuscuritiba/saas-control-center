import jwt from 'jsonwebtoken';
import { createHash, timingSafeEqual } from 'crypto';

function getSecret(): string {
  const secret = process.env.MASTER_JWT_SECRET;
  if (!secret) throw new Error('MASTER_JWT_SECRET não configurado.');
  return secret;
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function verifyMasterLogin(email: string, password: string): boolean {
  const masterEmail = process.env.MASTER_ADMIN_EMAIL;
  const masterPassword = process.env.MASTER_ADMIN_PASSWORD;
  if (!masterEmail || !masterPassword) {
    throw new Error('MASTER_ADMIN_EMAIL/PASSWORD não configurados.');
  }
  return safeEqual(email, masterEmail) && safeEqual(password, masterPassword);
}

export function signMasterToken(email: string): string {
  return jwt.sign({ email, role: 'MASTER' }, getSecret(), { expiresIn: '8h' });
}

export function verifyMasterToken(token: string): boolean {
  try {
    const payload = jwt.verify(token, getSecret()) as { role?: string };
    return payload.role === 'MASTER';
  } catch {
    return false;
  }
}

export function extractBearer(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim() || null;
}
