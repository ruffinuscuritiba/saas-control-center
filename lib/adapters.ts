import type { SystemKey, Tenant, TenantStatus } from './types';

interface SystemConfig {
  baseUrl: string;
  email: string;
  password: string;
}

function getConfig(system: SystemKey): SystemConfig {
  const prefix = {
    FOOD: 'FOOD',
    SAUDE_BELEZA: 'SBE',
    OFICINA: 'OFICINA',
    MODA: 'MODA',
  }[system];

  const baseUrl = process.env[`${prefix}_API_URL`];
  const email = process.env[`${prefix}_SA_EMAIL`];
  const password = process.env[`${prefix}_SA_PASSWORD`];
  if (!baseUrl || !email || !password) {
    throw new Error(`Config ausente para o sistema ${system} (env ${prefix}_API_URL/${prefix}_SA_EMAIL/${prefix}_SA_PASSWORD).`);
  }
  return { baseUrl, email, password };
}

// ─── Cache de token em memória (evita logar de novo a cada request) ────────

const tokenCache = new Map<SystemKey, { token: string; expiresAt: number }>();

async function getToken(system: SystemKey): Promise<string> {
  const cached = tokenCache.get(system);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const cfg = getConfig(system);
  const { loginPath, loginBody } = LOGIN_SPEC[system](cfg);

  const res = await fetch(`${cfg.baseUrl}${loginPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(loginBody),
  });
  if (!res.ok) {
    throw new Error(`Login falhou em ${system} (status ${res.status}).`);
  }
  const data = await res.json();
  const token = data.accessToken as string;
  if (!token) throw new Error(`Login em ${system} não retornou accessToken.`);

  // 8h de validade nos 4 sistemas — cacheia por 7h50 pra nunca usar expirado.
  tokenCache.set(system, { token, expiresAt: Date.now() + 7.83 * 60 * 60 * 1000 });
  return token;
}

const LOGIN_SPEC: Record<SystemKey, (cfg: SystemConfig) => { loginPath: string; loginBody: Record<string, string> }> = {
  FOOD: (cfg) => ({ loginPath: '/super-admin/auth/login', loginBody: { email: cfg.email, password: cfg.password } }),
  SAUDE_BELEZA: (cfg) => ({ loginPath: '/super-admin/login', loginBody: { email: cfg.email, password: cfg.password } }),
  OFICINA: (cfg) => ({ loginPath: '/auth/super-admin-login', loginBody: { email: cfg.email, senha: cfg.password } }),
  MODA: (cfg) => ({ loginPath: '/super-admin/login', loginBody: { email: cfg.email, password: cfg.password } }),
};

async function apiCall(system: SystemKey, path: string, init?: RequestInit) {
  const cfg = getConfig(system);
  const token = await getToken(system);
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${system} ${init?.method ?? 'GET'} ${path} -> ${res.status}: ${body.slice(0, 200)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function toIso(d: unknown): string | null {
  if (!d) return null;
  try { return new Date(d as string).toISOString(); } catch { return null; }
}

function b64url(obj: unknown): string {
  return encodeURIComponent(Buffer.from(JSON.stringify(obj)).toString('base64'));
}

function frontendUrl(key: 'FOOD' | 'SBE' | 'OFICINA' | 'MODA'): string {
  const url = process.env[`${key}_FRONTEND_URL`];
  if (!url) throw new Error(`${key}_FRONTEND_URL não configurada.`);
  return url;
}

// ─── FOOD ───────────────────────────────────────────────────────────────────

// Contas de vitrine do FoodSaaS (demo-basic@foodsaas.demo, demo-pro@..., os
// ~14 nichos de demo criados pro /demo público) — mesmo domínio usado pelo
// próprio FoodSaaS (DEMO_EMAILS) pra excluir de métricas reais. Aqui contam
// como "loja de mentira" pro dono do SaaS, não devem entrar em MRR/contagem/
// tabela do painel unificado.
const FOOD_DEMO_DOMAIN = '@foodsaas.demo';

async function listFood(): Promise<Tenant[]> {
  const data = await apiCall('FOOD', '/super-admin/companies');
  return (data as any[])
    .filter((c) => !String(c.email ?? '').toLowerCase().endsWith(FOOD_DEMO_DOMAIN))
    .map((c) => {
    let status: TenantStatus = 'ACTIVE';
    if (c.isBlocked) status = 'BLOCKED';
    else if (c.subscriptionStatus === 'PENDING_PAYMENT' || c.subscriptionStatus === 'TRIAL') status = 'TRIAL';
    else if (c.subscriptionStatus === 'PAST_DUE') status = 'PAST_DUE';

    return {
      system: 'FOOD' as const,
      id: c.id,
      name: c.name,
      nicho: 'Food',
      status,
      ownerName: null,
      ownerEmail: c.email ?? null,
      createdAt: null,
      counts: [
        { label: 'usuários', value: c._count?.users ?? 0 },
        { label: 'pedidos', value: c._count?.orders ?? 0 },
      ],
      monthlyRevenue: null,
      canToggleBlock: true,
      canResetPassword: true,
      canImpersonate: true,
      raw: c,
    };
  });
}

async function toggleBlockFood(id: string): Promise<void> {
  await apiCall('FOOD', `/super-admin/companies/${id}/block`, { method: 'PATCH' });
}

async function resetPasswordFood(id: string, newPassword: string): Promise<{ email: string }> {
  return apiCall('FOOD', `/super-admin/companies/${id}/reset-owner-password`, {
    method: 'PATCH',
    body: JSON.stringify({ newPassword }),
  });
}

async function impersonateFood(id: string): Promise<{ url: string }> {
  const data = await apiCall('FOOD', `/super-admin/companies/${id}/impersonate`, { method: 'POST' });
  const url = `${frontendUrl('FOOD')}/impersonate?token=${encodeURIComponent(data.accessToken)}&user=${b64url(data.user)}&companyName=${encodeURIComponent(data.companyName ?? '')}`;
  return { url };
}

// ─── SAÚDE & BELEZA ─────────────────────────────────────────────────────────

const SBE_STATUS_MAP: Record<string, TenantStatus> = {
  TRIAL: 'TRIAL', ACTIVE: 'ACTIVE', PAST_DUE: 'PAST_DUE', SUSPENDED: 'BLOCKED', CANCELLED: 'BLOCKED',
};

const SBE_SEGMENT_LABEL: Record<string, string> = {
  CLINICA_ESTETICA: 'Clínica de Estética', MANICURE: 'Manicure', SALAO_BELEZA: 'Salão de Beleza',
  CABELEIREIRO: 'Cabeleireiro(a)', CILIOS: 'Extensão de Cílios', BARBEARIA: 'Barbearia', OUTRO: 'Outro',
};

async function listSaudeBeleza(): Promise<Tenant[]> {
  const data = await apiCall('SAUDE_BELEZA', '/super-admin/networks');
  return (data as any[]).map((n) => ({
    system: 'SAUDE_BELEZA' as const,
    id: n.id,
    name: n.name,
    nicho: SBE_SEGMENT_LABEL[n.businessSegment] ?? n.businessSegment ?? 'Estética',
    status: SBE_STATUS_MAP[n.status] ?? 'ACTIVE',
    ownerName: n.owner?.name ?? null,
    ownerEmail: n.owner?.email ?? null,
    createdAt: toIso(n.createdAt),
    counts: [
      { label: 'unidades', value: n.clinicsCount ?? 0 },
      { label: 'pacientes', value: n.patientsCount ?? 0 },
    ],
    monthlyRevenue: n.modules
      ? 97.99 + n.modules.filter((m: any) => m.active).reduce((s: number, m: any) => s + (MODULE_PRICE[m.slug as string] ?? 0), 0)
      : null,
    canToggleBlock: true,
    canResetPassword: true,
    canImpersonate: true,
    raw: n,
  }));
}

const MODULE_PRICE: Record<string, number> = {
  whatsapp: 49.9, pacotes: 19.9, conta_digital: 39.9, marketing: 24.9, multi_unidade: 59.9,
};

async function toggleBlockSaudeBeleza(id: string, currentlyBlocked: boolean): Promise<void> {
  await apiCall('SAUDE_BELEZA', `/super-admin/networks/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: currentlyBlocked ? 'ACTIVE' : 'SUSPENDED' }),
  });
}

async function resetPasswordSaudeBeleza(id: string, newPassword: string): Promise<{ email: string }> {
  return apiCall('SAUDE_BELEZA', `/super-admin/networks/${id}/reset-owner-password`, {
    method: 'PATCH',
    body: JSON.stringify({ newPassword }),
  });
}

async function impersonateSaudeBeleza(id: string): Promise<{ url: string }> {
  const data = await apiCall('SAUDE_BELEZA', `/super-admin/networks/${id}/impersonate`, { method: 'POST' });
  const url = `${frontendUrl('SBE')}/impersonate?token=${encodeURIComponent(data.accessToken)}&user=${b64url(data.user)}`;
  return { url };
}

// ─── OFICINA ────────────────────────────────────────────────────────────────

const OFICINA_SEGMENT_LABEL: Record<string, string> = {
  auto_eletrica: 'Auto-Elétrica', mecanica: 'Oficina Mecânica', integrado: 'Integrado',
};

async function listOficina(): Promise<Tenant[]> {
  const data = await apiCall('OFICINA', '/super-admin/lojas');
  const lojas = (data as any).lojas ?? data;
  return (lojas as any[]).map((l) => ({
    system: 'OFICINA' as const,
    id: l.id,
    name: l.nome,
    nicho: OFICINA_SEGMENT_LABEL[l.segmento] ?? l.segmento ?? 'Mecânica',
    status: l.ativo ? 'ACTIVE' : 'BLOCKED',
    ownerName: null,
    ownerEmail: null,
    createdAt: toIso(l.configuradoEm),
    counts: [
      { label: 'clientes', value: l.totalClientes ?? 0 },
      { label: 'agendamentos', value: l.totalAgendamentos ?? 0 },
    ],
    monthlyRevenue: null,
    canToggleBlock: true,
    canResetPassword: true,
    canImpersonate: true,
    raw: l,
  }));
}

async function toggleBlockOficina(id: string): Promise<void> {
  await apiCall('OFICINA', `/super-admin/lojas/${id}/toggle-ativo`, { method: 'POST' });
}

async function resetPasswordOficina(id: string, newPassword: string): Promise<{ email: string }> {
  return apiCall('OFICINA', `/super-admin/lojas/${id}/reset-admin-password`, {
    method: 'POST',
    body: JSON.stringify({ novaSenha: newPassword }),
  });
}

async function impersonateOficina(id: string): Promise<{ url: string }> {
  const data = await apiCall('OFICINA', `/super-admin/lojas/${id}/impersonate`, { method: 'POST' });
  // O hand-off é uma rota do próprio backend Express (painel server-renderizado,
  // não um frontend Next.js separado) — por isso usa a origem da API, não um
  // "OFICINA_FRONTEND_URL" à parte.
  const cfg = getConfig('OFICINA');
  const origin = new URL(cfg.baseUrl).origin;
  return { url: `${origin}/admin/impersonate?token=${encodeURIComponent(data.accessToken)}` };
}

// ─── MODA ───────────────────────────────────────────────────────────────────

async function listModa(): Promise<Tenant[]> {
  const data = await apiCall('MODA', '/super-admin/companies');
  return (data as any[]).map((c) => ({
    system: 'MODA' as const,
    id: c.id,
    name: c.name,
    nicho: 'Moda',
    status: c.isBlocked ? 'BLOCKED' : (c.subscriptionStatus === 'TRIAL' ? 'TRIAL' : 'ACTIVE'),
    ownerName: c.owner?.name ?? null,
    ownerEmail: c.owner?.email ?? null,
    createdAt: toIso(c.createdAt),
    counts: [
      { label: 'produtos', value: c.productsCount ?? 0 },
      { label: 'pedidos', value: c.ordersCount ?? 0 },
    ],
    monthlyRevenue: null,
    canToggleBlock: true,
    canResetPassword: true,
    canImpersonate: true,
    raw: c,
  }));
}

async function toggleBlockModa(id: string, currentlyBlocked: boolean): Promise<void> {
  await apiCall('MODA', `/super-admin/companies/${id}/block`, {
    method: 'PATCH',
    body: JSON.stringify({ isBlocked: !currentlyBlocked }),
  });
}

async function resetPasswordModa(id: string, newPassword: string): Promise<{ email: string }> {
  return apiCall('MODA', `/super-admin/companies/${id}/reset-owner-password`, {
    method: 'PATCH',
    body: JSON.stringify({ newPassword }),
  });
}

async function impersonateModa(id: string): Promise<{ url: string }> {
  const data = await apiCall('MODA', `/super-admin/companies/${id}/impersonate`, { method: 'POST' });
  const url = `${frontendUrl('MODA')}/impersonate?token=${encodeURIComponent(data.accessToken)}&user=${b64url(data.user)}&company=${b64url(data.company)}`;
  return { url };
}

// ─── API pública do módulo ──────────────────────────────────────────────────

export async function listAllTenants() {
  const systems: SystemKey[] = ['FOOD', 'SAUDE_BELEZA', 'OFICINA', 'MODA'];
  const listers: Record<SystemKey, () => Promise<Tenant[]>> = {
    FOOD: listFood, SAUDE_BELEZA: listSaudeBeleza, OFICINA: listOficina, MODA: listModa,
  };

  const results = await Promise.allSettled(systems.map((s) => listers[s]()));
  const tenants: Tenant[] = [];
  const errors: { system: SystemKey; message: string }[] = [];

  results.forEach((r, i) => {
    if (r.status === 'fulfilled') tenants.push(...r.value);
    else errors.push({ system: systems[i], message: (r.reason as Error).message });
  });

  return { tenants, errors };
}

export async function toggleBlock(system: SystemKey, id: string, currentlyBlocked: boolean): Promise<void> {
  if (system === 'FOOD') return toggleBlockFood(id);
  if (system === 'SAUDE_BELEZA') return toggleBlockSaudeBeleza(id, currentlyBlocked);
  if (system === 'OFICINA') return toggleBlockOficina(id);
  if (system === 'MODA') return toggleBlockModa(id, currentlyBlocked);
}

export async function resetPassword(system: SystemKey, id: string, newPassword: string): Promise<{ email: string }> {
  if (system === 'FOOD') return resetPasswordFood(id, newPassword);
  if (system === 'SAUDE_BELEZA') return resetPasswordSaudeBeleza(id, newPassword);
  if (system === 'OFICINA') return resetPasswordOficina(id, newPassword);
  if (system === 'MODA') return resetPasswordModa(id, newPassword);
  throw new Error(`Reset de senha não suportado para ${system} ainda.`);
}

export async function impersonate(system: SystemKey, id: string): Promise<{ url: string }> {
  if (system === 'FOOD') return impersonateFood(id);
  if (system === 'SAUDE_BELEZA') return impersonateSaudeBeleza(id);
  if (system === 'OFICINA') return impersonateOficina(id);
  if (system === 'MODA') return impersonateModa(id);
  throw new Error(`Impersonação não suportada para ${system} ainda.`);
}
