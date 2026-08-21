export type SystemKey = 'FOOD' | 'SAUDE_BELEZA' | 'OFICINA' | 'MODA';

export const SYSTEM_LABEL: Record<SystemKey, string> = {
  FOOD: 'Food',
  SAUDE_BELEZA: 'Estética',
  OFICINA: 'Mecânica',
  MODA: 'Moda',
};

export const SYSTEM_COLOR: Record<SystemKey, string> = {
  FOOD: '#f97316',
  SAUDE_BELEZA: '#a855f7',
  OFICINA: '#3b82f6',
  MODA: '#ef4444',
};

export type TenantStatus = 'ACTIVE' | 'TRIAL' | 'PAST_DUE' | 'BLOCKED';

export const STATUS_LABEL: Record<TenantStatus, string> = {
  ACTIVE: 'Ativa',
  TRIAL: 'Trial',
  PAST_DUE: 'Em atraso',
  BLOCKED: 'Bloqueada',
};

export const STATUS_COLOR: Record<TenantStatus, string> = {
  ACTIVE: '#34d399',
  TRIAL: '#a78bfa',
  PAST_DUE: '#facc15',
  BLOCKED: '#ef4444',
};

/** Forma unificada de uma loja/empresa, não importa de qual dos 4 sistemas veio. */
export interface Tenant {
  system: SystemKey;
  id: string;
  name: string;
  nicho: string;
  status: TenantStatus;
  ownerName: string | null;
  ownerEmail: string | null;
  createdAt: string | null;
  counts: { label: string; value: number }[];
  /** Preço mensal estimado, quando o sistema de origem sabe calcular (hoje só Saúde & Beleza). null = não disponível. */
  monthlyRevenue: number | null;
  canToggleBlock: boolean;
  canResetPassword: boolean;
  /** Objeto original retornado pelo sistema de origem — usado no painel de detalhe. */
  raw: Record<string, unknown>;
}

export interface AggregatedResult {
  tenants: Tenant[];
  errors: { system: SystemKey; message: string }[];
}
