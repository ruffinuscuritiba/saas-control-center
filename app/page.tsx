'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Crown, LayoutDashboard, Users, CreditCard, Blocks, LifeBuoy, ScrollText,
  Search, Loader2, Ban, Play, KeyRound, ExternalLink, X, AlertTriangle,
  Wrench, Shirt, UtensilsCrossed, Sparkles, Briefcase,
} from 'lucide-react';
import {
  SYSTEM_LABEL, SYSTEM_COLOR, STATUS_LABEL, STATUS_COLOR,
  type Tenant, type SystemKey,
} from '@/lib/types';

const TOKEN_KEY = 'scc_token';
const SYSTEMS: SystemKey[] = ['FOOD', 'SAUDE_BELEZA', 'OFICINA', 'MODA'];

type ViewKey = 'dashboard' | 'clientes' | 'modulos';

const NAV: { key: ViewKey; label: string; icon: typeof LayoutDashboard; enabled: boolean }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, enabled: true },
  { key: 'clientes', label: 'Gestão de Clientes (Tenants)', icon: Users, enabled: true },
  { key: 'modulos', label: 'Configuração de Módulos', icon: Blocks, enabled: true },
];

const DISABLED_NAV = [
  { key: 'planos', label: 'Planos & Cobrança', icon: CreditCard },
  { key: 'suporte', label: 'Suporte', icon: LifeBuoy },
  { key: 'logs', label: 'Logs do Sistema', icon: ScrollText },
];

// ─── Módulos por nicho ───────────────────────────────────────────────────
// 4 nichos ligados a sistema real (adapters.ts já autentica e agrega tenants
// deles); "Serviços/Consultoria" ainda não tem sistema por trás — fica
// marcado como "Em breve", não é fingido como se já existisse.
interface NicheModule {
  key: SystemKey | 'SERVICOS';
  label: string;
  color: string;
  icon: typeof Wrench;
  features: string[];
  live: boolean;
}

const NICHE_MODULES: NicheModule[] = [
  {
    key: 'OFICINA', label: 'Mecânica', color: '#3b82f6', icon: Wrench, live: true,
    features: ['Ordem de Serviço', 'Checklist de Entrada', 'Peças', 'Histórico Veicular'],
  },
  {
    key: 'MODA', label: 'Loja de Roupas', color: '#ef4444', icon: Shirt, live: true,
    features: ['Controle de Grade (Cor/Tamanho)', 'PDV', 'Estoque de Roupas', 'Vendedores'],
  },
  {
    key: 'FOOD', label: 'Food Service', color: '#f97316', icon: UtensilsCrossed, live: true,
    features: ['KDS', 'Comandas/Mesas', 'Pedidos', 'Sabor/Complementos'],
  },
  {
    key: 'SAUDE_BELEZA', label: 'Clínica de Estética', color: '#a855f7', icon: Sparkles, live: true,
    features: ['Agenda', 'Anamnese', 'Sessões/Pacotes', 'Profissionais'],
  },
  {
    key: 'SERVICOS', label: 'Serviços / Consultoria', color: '#22c55e', icon: Briefcase, live: false,
    features: ['Gestão de Projetos', 'Horas', 'Relatórios', 'Contratos'],
  },
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
  const [view, setView] = useState<ViewKey>('dashboard');
  const [moduleDetail, setModuleDetail] = useState<NicheModule | null>(null);

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

  // MRR real — soma direto de Tenant.monthlyRevenue (null quando o sistema de
  // origem ainda não calcula receita por tenant, ver lib/types.ts). Nunca um
  // número fabricado: se ninguém tem monthlyRevenue, o total fica 0 mesmo.
  const mrr = useMemo(() => {
    const bySystem = SYSTEMS.map((s) => ({
      system: s,
      value: tenants.filter((t) => t.system === s).reduce((sum, t) => sum + (t.monthlyRevenue ?? 0), 0),
    }));
    return { total: bySystem.reduce((sum, s) => sum + s.value, 0), bySystem };
  }, [tenants]);

  // Alerta de faturamento = loja realmente em atraso (PAST_DUE), não estimativa.
  const billingAlerts = useMemo(() => tenants.filter((t) => t.status === 'PAST_DUE'), [tenants]);

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
            <button key={item.key} onClick={() => setView(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                view === item.key
                  ? 'bg-violet-600/15 text-violet-300'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}>
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </button>
          ))}
          <div className="pt-2 mt-2 border-t border-white/5 space-y-1">
            {DISABLED_NAV.map((item) => (
              <button key={item.key} disabled
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left text-gray-500 cursor-not-allowed">
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">em breve</span>
              </button>
            ))}
          </div>
        </nav>
        <div className="p-3 border-t border-white/10">
          <button onClick={handleLogout} className="w-full text-sm text-gray-400 hover:text-white transition-colors py-2">
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar — os 3 itens de nav (Dashboard/Clientes/Módulos) renderizam a
            MESMA página unificada (tabela + 5 nichos + sidebar), só o item
            ativo na sidebar muda; não existe mais uma página separada "só
            módulos" desalinhada do restante — modelo de referência do
            usuário mostra tudo numa tela só. */}
        <div className="flex items-center gap-4 px-8 py-5 border-b border-white/10">
          <h1 className="text-lg font-bold">Dashboard</h1>
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

          <div className="flex flex-col xl:flex-row gap-6 items-start">
            {/* ── Conteúdo Principal (Esquerda/Centro) ─────────────────────── */}
            <div className="flex-1 min-w-0 w-full">
              {systemFilter && (
                <button onClick={() => setSystemFilter(null)}
                  className="mb-4 text-xs font-medium px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 transition-colors"
                  style={{ background: `${SYSTEM_COLOR[systemFilter]}22`, color: SYSTEM_COLOR[systemFilter] }}>
                  Filtrando por {SYSTEM_LABEL[systemFilter]} <X className="w-3 h-3" />
                </button>
              )}

              {/* Table */}
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
                </div>
              ) : (
                <div className="rounded-2xl overflow-hidden border border-white/10 mb-8" style={{ background: 'var(--surface)' }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-gray-400">
                        <th className="px-5 py-3 font-medium">Empresa</th>
                        <th className="px-5 py-3 font-medium">Nicho</th>
                        <th className="px-5 py-3 font-medium">Status</th>
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
                        <tr><td colSpan={4} className="px-5 py-10 text-center text-gray-500">Nenhuma loja encontrada.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Linha de 5 nichos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                {NICHE_MODULES.map((m, idx) => {
                  const statusCounts = (['ACTIVE', 'TRIAL', 'PAST_DUE', 'BLOCKED'] as const).map(
                    (st) => tenants.filter((t) => t.system === m.key && t.status === st).length,
                  );
                  const maxCount = Math.max(1, ...statusCounts);
                  return (
                    <div key={m.key} className="rounded-2xl overflow-hidden border flex flex-col"
                      style={{ borderColor: `${m.color}55`, background: '#0e1015' }}>
                      <div className="px-4 py-3" style={{ background: m.color }}>
                        <p className="text-white font-black text-xs uppercase tracking-tight leading-snug">
                          {idx + 1}. {m.label}
                        </p>
                      </div>
                      <div className="px-3 pt-3">
                        <button
                          onClick={() => m.live && setModuleDetail(m)}
                          disabled={!m.live}
                          className="w-full py-2 rounded-xl text-xs font-bold bg-white text-gray-900 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {m.live ? 'Configurar Módulo' : 'Em breve'}
                        </button>
                      </div>
                      <ul className="px-4 py-3 space-y-2 flex-1">
                        {m.features.map((f) => (
                          <li key={f} className="text-[11px] text-gray-400 flex items-start gap-2 leading-snug">
                            <span className="w-1 h-1 rounded-full shrink-0 mt-1.5" style={{ background: m.color }} />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mx-4 mb-3 rounded-lg p-2 flex items-end gap-1 h-12"
                        style={{ background: `${m.color}14` }}
                        title={m.key === 'SERVICOS' ? 'Sem sistema próprio ainda' : `Ativas ${statusCounts[0]} · Trial ${statusCounts[1]} · Atraso ${statusCounts[2]} · Bloqueadas ${statusCounts[3]}`}>
                        {statusCounts.map((v, i) => (
                          <div key={i} className="flex-1 rounded-sm transition-all"
                            style={{ height: `${Math.max(14, (v / maxCount) * 100)}%`, background: v > 0 ? m.color : 'rgba(255,255,255,0.08)' }} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Sidebar Direita (Visão Geral do SaaS) ────────────────────── */}
            <aside className="w-full xl:w-72 shrink-0 space-y-4">
              <div className="rounded-2xl p-4 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <p className="text-xs text-gray-400 mb-1">MRR (receita mensal recorrente)</p>
                <p className="text-2xl font-bold text-emerald-400">R$ {fmtBRL(mrr.total)}</p>
                <p className="text-[10px] text-gray-500 mt-1">
                  Estimado — hoje só {SYSTEM_LABEL.SAUDE_BELEZA} calcula receita real por tenant.
                </p>
              </div>

              <div className="rounded-2xl p-4 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <p className="text-xs text-gray-400 mb-1">Total de Clientes</p>
                <p className="text-2xl font-bold mb-2">{kpis.total}</p>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{kpis.active} ativas</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-violet-400" />{kpis.trial} trial</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />{kpis.blocked} bloq.</span>
                </div>
              </div>

              <div className="rounded-2xl p-4 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <p className="text-xs text-gray-400 mb-3">Receita por Nicho</p>
                {mrr.total > 0 ? (
                  <div className="flex items-center gap-4">
                    <DonutChart segments={mrr.bySystem.map((s) => ({ color: SYSTEM_COLOR[s.system], value: s.value }))} />
                    <ul className="space-y-1.5 text-[11px]">
                      {mrr.bySystem.filter((s) => s.value > 0).map((s) => (
                        <li key={s.system} className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: SYSTEM_COLOR[s.system] }} />
                          <span className="text-gray-400">{SYSTEM_LABEL[s.system]}</span>
                          <span className="font-semibold ml-auto">R$ {fmtBRL(s.value)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-500 italic">Sem receita computável ainda.</p>
                )}
              </div>

              <div className="rounded-2xl p-4 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <p className="text-xs text-gray-400 mb-1">Alertas de Faturamento</p>
                {billingAlerts.length > 0 ? (
                  <>
                    <p className="text-2xl font-bold text-amber-400 mb-2">{billingAlerts.length}</p>
                    <ul className="space-y-1 text-[11px] text-gray-400">
                      {billingAlerts.slice(0, 4).map((t) => (
                        <li key={`${t.system}-${t.id}`} className="truncate">
                          <span className="font-medium text-amber-300">{t.name}</span> — {SYSTEM_LABEL[t.system]}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-[11px] text-gray-500 italic">Nenhuma loja em atraso.</p>
                )}
              </div>

              <div className="rounded-2xl p-4 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <p className="text-xs text-gray-400 mb-1">Análise de Churn</p>
                <p className="text-[11px] text-gray-500 italic">
                  Sem dados históricos suficientes ainda — precisa de snapshots ao longo do tempo pra calcular de verdade.
                </p>
              </div>
            </aside>
          </div>
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
              {detail.canImpersonate && (
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

      {/* Module detail modal */}
      {moduleDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setModuleDetail(null)}>
          <div className="w-full max-w-sm rounded-2xl p-6 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${moduleDetail.color}22` }}>
                  <moduleDetail.icon className="w-4.5 h-4.5" style={{ color: moduleDetail.color }} />
                </div>
                <h2 className="font-bold">{moduleDetail.label}</h2>
              </div>
              <button onClick={() => setModuleDetail(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Recursos deste nicho — gerenciados dentro do próprio sistema{moduleDetail.key !== 'SERVICOS' ? ` (${SYSTEM_LABEL[moduleDetail.key as SystemKey]})` : ''}.
              Feature flags globais cross-sistema ainda não existem aqui — este painel hoje é informativo.
            </p>
            <ul className="space-y-2 mb-5">
              {moduleDetail.features.map((f) => (
                <li key={f} className="text-sm flex items-center gap-2.5 px-3 py-2 rounded-lg" style={{ background: `${moduleDetail.color}0d` }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: moduleDetail.color }} />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => { setModuleDetail(null); setView('clientes'); setSystemFilter(moduleDetail.key as SystemKey); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
              style={{ background: moduleDetail.color }}
            >
              Ver tenants deste nicho
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Donut simples via stroke-dasharray — sem lib de gráfico, só SVG cru. */
function DonutChart({ segments, size = 88, strokeWidth = 13 }: { segments: { color: string; value: number }[]; size?: number; strokeWidth?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offsetAcc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
      {total > 0 && segments.filter((s) => s.value > 0).map((s) => {
        const dash = (s.value / total) * circumference;
        const el = (
          <circle key={s.color} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={s.color} strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offsetAcc}
            transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        );
        offsetAcc += dash;
        return el;
      })}
    </svg>
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
