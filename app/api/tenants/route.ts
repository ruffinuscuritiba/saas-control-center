import { NextRequest, NextResponse } from 'next/server';
import { requireMasterAuth } from '@/lib/guard';
import { listAllTenants } from '@/lib/adapters';

export async function GET(req: NextRequest) {
  const denied = requireMasterAuth(req);
  if (denied) return denied;

  const { tenants, errors } = await listAllTenants();
  return NextResponse.json({ tenants, errors });
}
