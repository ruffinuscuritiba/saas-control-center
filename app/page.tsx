'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Crown, LayoutDashboard, Users, CreditCard, Blocks, LifeBuoy, ScrollText,
  Search, Loader2, Ban, Play, KeyRound, ExternalLink, X, AlertTriangle,
} from 'lucide-react';
import {
  SYSTEM_LABEL, SYSTEM_COLOR, STATUS_LABEL, STATUS_COLOR,
  type Tenant, type SystemKey,
} from '@/lib/types';

const TOKEN_KEY = 'scc_token';
const SYSTEMS: SystemKey[] = ['FOOD', 'SAUDE_BELEZA', 'OFICINA', 'MODA'];

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, enabled: true },
  { key: 'clientes', label: 'Gestão de Clientes', icon: Users, enabled: true },
  { key: 'planos', label: 'Planos & Cobrança', icon: CreditCard, enabled: false },
  { key: 'modulos', label: 'Configuração de Módulos', icon: Blocks, enabled: false },
  { key: 'suporte', label: 'Suporte', icon: LifeBuoy, enabled: false },
  { key: 'logs', label: 'Logs do Sistema', icon: ScrollText, enabled: false },
];

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}
function fmtBRL(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

export default function DashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [errors, setErrors] = useState<{ system: SystemKey; message: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [systemFilter, setSystemFilter] = useState<SystemKey | null>(null);

  const [detail, setDetail] = useState<Tenant | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetDone, setResetDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setToken(localStorage.getItem(TOKEN_KEY));
    setChecked(true);
  }, []);

  const load = useCallback(async (tok: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/tenants', { headers: { Authorization: `Bearer ${tok}` } });
      if (res.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        return;
      }
      const data = await res.json();
      setTenants(data.tenants ?? []);
      setErrors(data.errors ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) load(token);
  }, [token, load]);

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }

  const filtered = useMemo(() => {
    return tenants.filter((t) => {
      if (systemFilter && t.system !== systemFilter) return false;
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return t.name.toLowerCase().includes(q) || t.nicho.toLowerCase().includes(q) || (t.ownerEmail ?? '').toLowerCase().includes(q);
    });
  }, [tenants, search, systemFilter]);

  const kpis = useMemo(() => ({
    total: tenants.length,
    active: tenants.filter((t) => t.status === 'ACTIVE').length,
    trial: tenants.filter((t) => t.status === 'TRIAL').length,
    blocked: tenants.filter((t) => t.status === 'BLOCKED' || t.status === 'PAST_DUE').length,
  }), [tenants]);

  const perSystem = useMemo(() => {
    return SYSTEMS.map((s) => ({ system: s, count: tenants.filter((t) => t.system === s).length }));
  }, [tenants]);

  async function handleToggleBlock(t: Tenant) {
    if (!token) return;
    const nextLabel = t.status === 'BLOCKED' ? 'reativar' : 'bloquear';
    if (!confirm(`Confirma ${nextLabel} o acesso de "${t.name}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tenants/${t.system}/${t.id}/block`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentlyBlocked: t.status === 'BLOCKED' }),
      });
      if (!res.ok) throw new Error();
      await load(token);
    } catch {
      alert('Não foi possível atualizar o status.');
    } finally {
      setBusy(false);
    }
  }

  function openDetail(t: Tenant) {
    setDetail(t);
    setResetPassword('');
    setResetError('');
    setResetDone(null);
  }

  async function handleResetPassword() {
    if (!token || !detail) return;
    setBusy(true);
    setResetError('');
    try {
      const res = await fetch(`/api/tenants/${detail.system}/${detail.id}/reset-password`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: resetPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResetError(data.message ?? 'Erro ao redefinir a senha.');
        return;
      }
      setResetDone(data.email);
    } finally {
      setBusy(false);
    }
  }

  async function handleImpersonate(t: Tenant) {
    if (!token) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tenants/${t.system}/${t.id}/impersonate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message ?? 'Não foi possível impersonar.');
        return;
      }
      if (data.url) window.open(data.url, '_blank');
      else alert('Sessão gerada, mas sem URL de redirecionamento configurada.');
    } finally {
      setBusy(false);
    }
  }

  // ── Login gate ──────────────────────────────────────────────────────────

  if (!checked) return null;
  if (!token) {
    if (typeof window !== 'undefined') window.location.href = '/login';
    return null;
  }

  return (
    <div className="min-h-screen flex bg-[#0b0d12] text-white">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-white/10 flex flex-col bg-[#0e1015]">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/10">
          <Crown className="w-5 h-5 text-violet-400" />
          <span className="font-bold text-sm">Painel Super Admin</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => (
            <button key={item.key} disabled={!item.enabled}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                item.key === 'dashboard' || item.key === 'clientes'
                  ? 'bg-violet-600/15 text-violet-300'
                  : 'text-gray-500 cursor-not-allowed'
              }`}>
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
              {!item.enabled && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">em breve</span>}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <button onClick={handleLogout} className="w-full text-sm text-gray-400 hover:text-white transition-colors py-2">
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <div className="flex items-center gap-4 px-8 py-5 border-b border-white/10">
          <h1 className="text-lg font-bold">Visão Geral do SaaS</h1>
          <div className="flex-1 flex items-center gap-2 max-w-md px-3 py-2 rounded-xl bg-white/5 border border-white/10">
            <Search className="w-4 h-4 text-gray-500 shrink-0" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar empresa, nicho ou e-mail do dono..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-500" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          {errors.length > 0 && (
            <div className="mb-6 rounded-xl p-4 bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-200">
                {errors.map((e) => (
                  <p key={e.system}>
                    <b>{SYSTEM_LABEL[e.system]}</b> não respondeu: {e.message}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* KPI cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <KpiCard label="Total de Lojas" value={kpis.total} />
            <KpiCard label="Ativas" value={kpis.active} color="#34d399" />
            <KpiCard label="Em Trial" value={kpis.trial} color="#a78bfa" />
            <KpiCard label="Bloqueadas / Em Atraso" value={kpis.blocked} color="#ef4444" />
          </div>

          {/* Niche cards */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {perSystem.map(({ system, count }) => (
              <button key={system} onClick={() => setSystemFilter(systemFilter === system ? null : system)}
                className="rounded-2xl p-4 text-left transition-all border"
                style={{
                  background: systemFilter === system ? `${SYSTEM_COLOR[system]}15` : 'var(--surface)',
                  borderColor: systemFilter === system ? SYSTEM_COLOR[system] : 'var(--border)',
                }}>
                <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: SYSTEM_COLOR[system] }}>
                  {SYSTEM_LABEL[system]}
                </p>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-gray-500">loja{count === 1 ? '' : 's'}</p>
              </button>
            ))}
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden border border-white/10" style={{ background: 'var(--surface)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-gray-400">
                    <th className="px-5 py-3 font-medium">Empresa</th>
                    <th className="px-5 py-3 font-medium">Nicho</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Dono</th>
                    <th className="px-5 py-3 font-medium">Cadastro</th>
                    <th className="px-5 py-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.map((t) => (
                    <tr key={`${t.system}-${t.id}`} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-medium">{t.name}</p>
                        {t.monthlyRevenue !== null && (
                          <p className="text-xs text-gray-500">R$ {fmtBRL(t.monthlyRevenue)}/mês</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: `${SYSTEM_COLOR[t.system]}22`, color: SYSTEM_COLOR[t.system] }}>
                          {t.nicho}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: `${STATUS_COLOR[t.status]}22`, color: STATUS_COLOR[t.status] }}>
                          {STATUS_LABEL[t.status]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-400">{t.ownerEmail ?? '—'}</td>
                      <td className="px-5 py-3.5 text-gray-400">{fmtDate(t.createdAt)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => openDetail(t)} title="Configurar / detalhes"
                            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                            <Blocks className="w-3.5 h-3.5" />
                          </button>
                          {t.canToggleBlock && (
                            <button onClick={() => handleToggleBlock(t)} title={t.status === 'BLOCKED' ? 'Reativar' : 'Bloquear'}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                              {t.status === 'BLOCKED' ? <Play className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-500">Nenhuma loja encontrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detail drawer */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60" onClick={() => setDetail(null)}>
          <div className="w-full max-w-md h-full overflow-y-auto p-6 border-l border-white/10" style={{ background: 'var(--surface)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: SYSTEM_COLOR[detail.system] }}>
                {SYSTEM_LABEL[detail.system]}
              </span>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <h2 className="text-lg font-bold mb-4">{detail.name}</h2>

            <div className="space-y-1.5 mb-6 text-sm">
              <DetailRow label="Nicho" value={detail.nicho} />
              <DetailRow label="Status" value={STATUS_LABEL[detail.status]} />
              <DetailRow label="Dono" value={detail.ownerName ?? '—'} />
              <DetailRow label="E-mail do dono" value={detail.ownerEmail ?? '—'} />
              <DetailRow label="Cadastro" value={fmtDate(detail.createdAt)} />
              {detail.counts.map((c) => (
                <DetailRow key={c.label} label={c.label} value={String(c.value)} />
              ))}
              {detail.monthlyRevenue !== null && (
                <DetailRow label="Receita mensal estimada" value={`R$ ${fmtBRL(detail.monthlyRevenue)}`} />
              )}
            </div>

            <div className="space-y-3">
              {detail.system === 'FOOD' && (
                <button onClick={() => handleImpersonate(detail)} disabled={busy}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-white/10 hover:bg-white/15 transition-colors">
                  <ExternalLink className="w-4 h-4" /> Acessar Painel (impersonar)
                </button>
              )}

              {detail.canResetPassword ? (
                resetDone ? (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm">
                    <p className="text-emerald-300 font-medium">Senha redefinida!</p>
                    <p className="text-xs text-gray-300 mt-1">Login: <span className="font-mono">{resetDone}</span></p>
                  </div>
                ) : (
                  <div className="rounded-xl p-4 bg-white/5 border border-white/10">
                    <p className="text-xs text-gray-400 mb-2 flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" /> Redefinir senha do dono</p>
                    <input type="text" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)}
                      placeholder="Nova senha (mín. 8 caracteres)"
                      className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 outline-none placeholder:text-gray-500 mb-2" />
                    {resetError && <p className="text-red-400 text-xs mb-2">{resetError}</p>}
                    <button onClick={handleResetPassword} disabled={busy || resetPassword.length < 8}
                      className="w-full py-2 rounded-lg text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 transition-colors disabled:opacity-40">
                      Redefinir
                    </button>
                  </div>
                )
              ) : (
                <p className="text-xs text-gray-500 italic">Reset de senha ainda não disponível pra este sistema.</p>
              )}

              {detail.canToggleBlock && (
                <button onClick={() => { handleToggleBlock(detail); setDetail(null); }} disabled={busy}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    detail.status === 'BLOCKED'
                      ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                  }`}>
                  {detail.status === 'BLOCKED' ? <><Play className="w-4 h-4" /> Reativar</> : <><Ban className="w-4 h-4" /> Bloquear</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-2xl p-4 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold" style={color ? { color } : undefined}>{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-right truncate max-w-[60%]">{value}</span>
    </div>
  );
}
