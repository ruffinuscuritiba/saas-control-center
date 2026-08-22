'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Crown, LayoutDashboard, Users, CreditCard, Blocks, LifeBuoy, ScrollText,
  Search, Loader2, Ban, Play, KeyRound, ExternalLink, X, AlertTriangle,
  Wrench, Shirt, UtensilsCrossed, Sparkles, Briefcase, Rocket, Copy, MessageCircle,
  ChevronDown, Menu, Plus, Bell, UserCircle2,
  UserPlus, LayoutTemplate, DollarSign, Eye, Sprout, PlayCircle, Bot, Store,
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

const FOODSAAS_ADMIN_URL = 'https://food-system-sas-erp-frontend.vercel.app/super-admin';

// Atalhos reais pro painel próprio do FoodSaaS — SCC não replica essas
// ferramentas (Leads, Construtor de layout, Preços, Visitas, seed de demo,
// etc.), só abre a página real onde elas já existem, numa aba nova. Exige
// estar logado no /super-admin/login do FoodSaaS pra funcionar (sessão
// separada da do SCC) — mesmo padrão já usado na Central de Demonstrações.
const FOODSAAS_SHORTCUTS: { label: string; href: string; icon: typeof Users; title?: string }[] = [
  {
    label: 'Dashboard FoodSaaS', href: `${FOODSAAS_ADMIN_URL}/dashboard`, icon: LayoutDashboard,
    title: 'Abre o dashboard do FoodSaaS — "Ver demos", "Ver arquivadas" e "+ Novo restaurante" ficam lá (não são páginas separadas, são controles dessa mesma tela)',
  },
  { label: 'Clientes', href: `${FOODSAAS_ADMIN_URL}/clientes`, icon: Users },
  { label: 'Leads', href: `${FOODSAAS_ADMIN_URL}/leads`, icon: UserPlus },
  { label: 'Módulos', href: `${FOODSAAS_ADMIN_URL}/modulos`, icon: Blocks },
  { label: 'Construtor', href: `${FOODSAAS_ADMIN_URL}/construtor`, icon: LayoutTemplate },
  { label: 'Preços', href: `${FOODSAAS_ADMIN_URL}/pricing`, icon: DollarSign },
  { label: 'Visitas', href: `${FOODSAAS_ADMIN_URL}/visitas`, icon: Eye },
  // Estes 4 são botões DENTRO do dashboard do FoodSaaS (não têm rota
  // própria) — abrem o dashboard, o clique real acontece lá.
  { label: 'Seed Demo', href: `${FOODSAAS_ADMIN_URL}/dashboard`, icon: Sprout },
  { label: 'Init Demos', href: `${FOODSAAS_ADMIN_URL}/dashboard`, icon: PlayCircle },
  { label: 'Configurar IA', href: `${FOODSAAS_ADMIN_URL}/dashboard`, icon: Bot },
  { label: 'Minha Loja', href: `${FOODSAAS_ADMIN_URL}/dashboard`, icon: Store },
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
  chartType: 'line' | 'bar';
}

const NICHE_MODULES: NicheModule[] = [
  {
    key: 'OFICINA', label: 'Mecânica', color: '#0084ff', icon: Wrench, live: true, chartType: 'line',
    features: ['Ordem de Serviço', 'Checklist de Entrada', 'Peças', 'Histórico Veicular'],
  },
  {
    key: 'MODA', label: 'Loja de Roupas', color: '#ff2d55', icon: Shirt, live: true, chartType: 'bar',
    features: ['Controle de Grade (Cor/Tamanho)', 'PDV', 'Estoque de Roupas', 'Vendedores'],
  },
  {
    key: 'FOOD', label: 'Food Service', color: '#ff8800', icon: UtensilsCrossed, live: true, chartType: 'line',
    features: ['KDS', 'Comandas/Mesas', 'Pedidos', 'Sabor/Complementos'],
  },
  {
    key: 'SAUDE_BELEZA', label: 'Clínica de Estética', color: '#a230ff', icon: Sparkles, live: true, chartType: 'bar',
    features: ['Agenda', 'Anamnese', 'Sessões/Pacotes', 'Profissionais'],
  },
  {
    // "Em breve" de propósito — não existe sistema real de Serviços/
    // Consultoria hoje (SYSTEMS só tem FOOD/SAUDE_BELEZA/OFICINA/MODA).
    // Marcar live:true aqui abriria um módulo que nunca vai ter tenant.
    key: 'SERVICOS', label: 'Serviços / Consultoria', color: '#00c853', icon: Briefcase, live: false, chartType: 'bar',
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

/** Ícone pequeno da empresa na tabela — mesmo ícone/cor do módulo do nicho
 * dela, pra dar a mesma "cara" da referência sem inventar nenhum dado novo. */
function systemIcon(system: SystemKey) {
  const m = NICHE_MODULES.find((n) => n.key === system);
  return m ?? NICHE_MODULES[2]; // fallback Food, nunca deveria faltar
}

export default function DashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [view, setView] = useState<ViewKey>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [alertHighlight, setAlertHighlight] = useState(false);
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

  function openModule(m: NicheModule) {
    if (m.live) setModuleDetail(m);
  }

  function openBillingAlerts() {
    setView('dashboard');
    setTimeout(() => {
      const el = document.getElementById('billing-alerts-card');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setAlertHighlight(true);
      setTimeout(() => setAlertHighlight(false), 1600);
    }, 50);
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
      <aside className={`shrink-0 border-r border-white/10 flex flex-col bg-[#0e1015] overflow-hidden transition-all duration-200 ${sidebarOpen ? 'w-64' : 'w-0 border-r-0'}`}>
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/10 w-64">
          <Crown className="w-5 h-5 text-violet-400" />
          <span className="font-bold text-sm">Painel Super Admin</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 w-64">
          {NAV.map((item) => (
            <div key={item.key}>
              <button onClick={() => setView(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                  view === item.key
                    ? 'bg-violet-600/15 text-violet-300'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}>
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {item.key !== 'dashboard' && (
                  <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${view === item.key ? 'rotate-180' : ''}`} />
                )}
              </button>
              {/* Lista dos 5 nichos logo abaixo de "Configuração de
                  Módulos" — clicar filtra a tabela por esse nicho de
                  verdade (systemFilter real, não decorativo). */}
              {item.key === 'modulos' && (
                <div className="mt-1.5 pl-2 space-y-1.5">
                  {NICHE_MODULES.map((m) => {
                    const active = systemFilter === m.key;
                    return (
                      <button key={m.key}
                        onClick={() => { if (m.live) { setSystemFilter(m.key as SystemKey); setView('dashboard'); } }}
                        disabled={!m.live}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left border disabled:cursor-not-allowed"
                        style={m.live
                          ? { background: active ? m.color : `${m.color}22`, borderColor: `${m.color}66`, color: active ? '#fff' : m.color }
                          : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)' }}>
                        <span className="truncate flex-1">{m.label}</span>
                        {!m.live && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 shrink-0">em breve</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
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

          {/* Atalhos reais pro painel próprio do FoodSaaS — abrem em aba
              nova, exigem sessão do /super-admin/login do FoodSaaS. */}
          <div className="pt-3 mt-3 border-t border-white/5">
            <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">FoodSaaS</p>
            <div className="space-y-1">
              {FOODSAAS_SHORTCUTS.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                  title={s.title ?? `Abrir "${s.label}" no painel do FoodSaaS (aba nova)`}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.35),0_4px_10px_rgba(0,0,0,0.45)]">
                  <s.icon className="w-4 h-4 shrink-0" />
                  <span className="truncate flex-1 text-left">{s.label}</span>
                </a>
              ))}
            </div>
          </div>
        </nav>
        <div className="p-3 border-t border-white/10 w-64">
          <button onClick={handleLogout} className="w-full text-sm text-gray-400 hover:text-white transition-colors py-2">
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar — cada item de nav leva a um conteúdo genuinamente diferente:
            Dashboard (visão completa), Clientes (só a tabela, mais espaço) e
            Módulos (só os 5 cards de nicho). */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
          <button onClick={() => setSidebarOpen((v) => !v)} title="Mostrar/ocultar menu"
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors shrink-0">
            <Menu className="w-4.5 h-4.5" />
          </button>
          <h1 className="text-lg font-bold flex-1">
            {view === 'modulos' ? 'Configuração de Módulos' : view === 'clientes' ? 'Gestão de Clientes (Tenants)' : 'Dashboard'}
          </h1>
          <button onClick={openBillingAlerts}
            title={billingAlerts.length > 0 ? `${billingAlerts.length} loja(s) em atraso — clique para ver` : 'Nenhum alerta de faturamento'}
            className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors shrink-0">
            <Bell className="w-4.5 h-4.5" />
            {billingAlerts.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-[#0b0d12]" />
            )}
          </button>
          <div className="relative shrink-0">
            <button onClick={() => setAvatarMenuOpen((v) => !v)} title="Conta">
              <UserCircle2 className="w-8 h-8 text-gray-500 hover:text-gray-300 transition-colors" />
            </button>
            {avatarMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setAvatarMenuOpen(false)} />
                <div className="absolute right-0 top-10 z-20 w-40 rounded-xl border border-white/10 py-1.5 shadow-xl" style={{ background: 'var(--surface)' }}>
                  <button onClick={handleLogout}
                    className="w-full text-left px-3.5 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                    Sair da conta
                  </button>
                </div>
              </>
            )}
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

          {systemFilter && view !== 'modulos' && (
            <button onClick={() => setSystemFilter(null)}
              className="mb-4 text-xs font-medium px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 transition-colors"
              style={{ background: `${SYSTEM_COLOR[systemFilter]}22`, color: SYSTEM_COLOR[systemFilter] }}>
              Filtrando por {SYSTEM_LABEL[systemFilter]} <X className="w-3 h-3" />
            </button>
          )}

          {view === 'dashboard' && (
            <>
              <div className="mb-6"><DemoCentralCard /></div>
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start mb-6">
                {/* ── Conteúdo Principal (Esquerda/Centro) ─────────────────── */}
                <div className="xl:col-span-3 min-w-0 w-full">
                  <TenantsTable tenants={filtered} loading={loading} search={search} setSearch={setSearch} onOpenDetail={openDetail} onToggleBlock={handleToggleBlock} />
                </div>

                {/* ── Sidebar Direita (Visão Geral do SaaS) ────────────────── */}
                <aside className="w-full space-y-4">
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

                  <div id="billing-alerts-card" className={`rounded-2xl p-4 border transition-all duration-500 ${alertHighlight ? 'ring-2 ring-amber-400' : ''}`}
                    style={{ background: 'var(--surface)', borderColor: alertHighlight ? '#fbbf24' : 'var(--border)' }}>
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
              <NicheGrid tenants={tenants} onConfigure={openModule} />
            </>
          )}

          {view === 'clientes' && (
            <TenantsTable tenants={filtered} loading={loading} search={search} setSearch={setSearch} onOpenDetail={openDetail} onToggleBlock={handleToggleBlock} />
          )}

          {view === 'modulos' && (
            <>
              <p className="text-sm text-gray-400 mb-6 max-w-2xl">
                Cada card representa um nicho da plataforma. Os 4 com sistema próprio já
                agregam tenants reais no Dashboard; Serviços/Consultoria ainda não tem um
                sistema por trás — aparece aqui como próximo passo, não como módulo ativo.
              </p>
              <NicheGrid tenants={tenants} onConfigure={openModule} />
            </>
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

const FOODSAAS_DEMO_URL = 'https://food-system-sas-erp-frontend.vercel.app/demo';

/** Compartilhamento rápido da demo do FoodSaaS — hoje é o único dos 4 sistemas
 * com uma página pública de demonstração pronta pra enviar a lead/cliente; por
 * isso o rótulo deixa explícito "FoodSaaS" em vez de fingir que é genérico
 * pros 4 produtos. */
function DemoCentralCard() {
  const [copied, setCopied] = useState(false);
  const waUrl = `https://wa.me/?text=${encodeURIComponent(`Conheça o FoodSaaS ERP: ${FOODSAAS_DEMO_URL}`)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(FOODSAAS_DEMO_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponível — botão simplesmente não confirma, sem crash */
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/60 to-violet-900/30 p-5 mb-6 shadow-[0_0_0_1px_rgba(139,92,246,0.08),0_8px_32px_-8px_rgba(139,92,246,0.3)]">
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full blur-3xl" style={{ background: 'rgba(139,92,246,0.15)' }} aria-hidden />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 ring-1 ring-violet-500/30">
            <Rocket className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <p className="font-black text-white">🚀 Central de Demonstrações — FoodSaaS</p>
            <p className="mt-0.5 text-sm text-violet-300/70">Compartilhe a demonstração do FoodSaaS com clientes.</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a href={FOODSAAS_DEMO_URL} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-black text-white shadow-[0_4px_14px_-4px_rgba(139,92,246,0.7),inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:bg-violet-500">
            <ExternalLink className="h-3.5 w-3.5" /> Abrir Central
          </a>
          <button onClick={copyLink}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-semibold transition ${
              copied ? 'border-green-500/40 bg-green-500/15 text-green-400' : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
            }`}>
            <Copy className="h-3.5 w-3.5" /> {copied ? 'Copiado!' : 'Copiar Link'}
          </button>
          <a href={waUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-green-500/25 bg-green-500/10 px-4 py-2 text-xs font-semibold text-green-400 transition hover:bg-green-500/20">
            <MessageCircle className="h-3.5 w-3.5" /> Compartilhar WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

function TenantsTable({
  tenants, loading, search, setSearch, onOpenDetail, onToggleBlock,
}: {
  tenants: Tenant[];
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  onOpenDetail: (t: Tenant) => void;
  onToggleBlock: (t: Tenant) => void;
}) {
  return (
    <div className="rounded-2xl overflow-hidden border border-white/10" style={{ background: 'var(--surface)' }}>
      <div className="px-5 py-3.5 border-b border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-sm font-bold shrink-0">Clientes &amp; Empresas ({tenants.length})</p>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar empresa, nicho ou e-mail..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs outline-none placeholder:text-gray-500 focus:border-violet-500" />
          </div>
          <a href="https://food-system-sas-erp-frontend.vercel.app/super-admin/dashboard" target="_blank" rel="noopener noreferrer"
            title='Abre o dashboard do FoodSaaS — clique em "Novo restaurante" lá (cadastro unificado pros 4 sistemas ainda não existe)'
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white transition-colors shrink-0">
            <Plus className="w-3.5 h-3.5" /> Novo Cliente
          </a>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
        </div>
      ) : (
      <div className="max-h-[480px] overflow-y-auto scc-scroll">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-[1]" style={{ background: 'var(--surface)' }}>
          <tr className="border-b border-white/10 text-left text-gray-400">
            <th className="px-5 py-3 font-medium">Empresa</th>
            <th className="px-5 py-3 font-medium">Nicho</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {tenants.map((t) => {
            const icon = systemIcon(t.system);
            return (
              <tr key={`${t.system}-${t.id}`} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${icon.color}22` }}>
                      <icon.icon className="w-3.5 h-3.5" style={{ color: icon.color }} />
                    </div>
                    <div>
                      <p className="font-medium">{t.name}</p>
                      {t.monthlyRevenue !== null && (
                        <p className="text-xs text-gray-500">R$ {fmtBRL(t.monthlyRevenue)}/mês</p>
                      )}
                    </div>
                  </div>
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
                    <button onClick={() => onOpenDetail(t)} title="Configurar / detalhes"
                      className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                      <Blocks className="w-3.5 h-3.5" />
                    </button>
                    {t.canToggleBlock && (
                      <button onClick={() => onToggleBlock(t)} title={t.status === 'BLOCKED' ? 'Reativar' : 'Bloquear'}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                        {t.status === 'BLOCKED' ? <Play className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {tenants.length === 0 && (
            <tr><td colSpan={4} className="px-5 py-10 text-center text-gray-500">Nenhuma loja encontrada.</td></tr>
          )}
        </tbody>
      </table>
      </div>
      )}
      {!loading && tenants.length > 0 && (
        <div className="px-5 py-3 border-t border-white/10 text-xs text-gray-500">
          Mostrando {tenants.length} de {tenants.length}
        </div>
      )}
    </div>
  );
}

function NicheGrid({ tenants, onConfigure }: { tenants: Tenant[]; onConfigure: (m: NicheModule) => void }) {
  return (
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
                onClick={() => onConfigure(m)}
                disabled={!m.live}
                className="w-full py-2 rounded-xl text-xs font-bold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={m.live
                  ? { background: `${m.color}1f`, borderColor: `${m.color}66`, color: m.color }
                  : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
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
            <div className="mx-4 mb-3 rounded-lg overflow-hidden h-16"
              style={{ background: `${m.color}14` }}
              title={m.key === 'SERVICOS' ? 'Sem sistema próprio ainda' : `Ativas ${statusCounts[0]} · Trial ${statusCounts[1]} · Atraso ${statusCounts[2]} · Bloqueadas ${statusCounts[3]}`}>
              {m.chartType === 'line' ? (
                <StatusAreaChart values={statusCounts} max={maxCount} color={m.color} />
              ) : (
                <StatusBarChart values={statusCounts} max={maxCount} color={m.color} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Mini área/linha (Ativas/Trial/Atraso/Bloqueadas) — mesmo dado real do bar
 * chart antigo, só com um traçado mais parecido com a referência (curva
 * suave + preenchimento em gradiente) em vez de 4 retângulos secos. */
function StatusAreaChart({ values, max, color }: { values: number[]; max: number; color: string }) {
  const w = 100;
  const h = 40;
  const pad = 4;
  const step = (w - pad * 2) / (values.length - 1);
  const points = values.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - (v / max) * (h - pad * 2);
    return [x, y];
  });
  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1][0]},${h} L${points[0][0]},${h} Z`;
  const gradId = `grad-${color.replace('#', '')}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-full">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.55" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2" fill={color} />
      ))}
    </svg>
  );
}

/** Variante em barras do mesmo dado real (Ativas/Trial/Atraso/Bloqueadas) —
 * só pra dar variedade visual entre os cards, mesmo princípio do line chart
 * acima: zero número inventado, sempre os 4 status reais desse nicho. */
function StatusBarChart({ values, max, color }: { values: number[]; max: number; color: string }) {
  return (
    <div className="w-full h-full flex items-end gap-1.5 px-1 pb-1">
      {values.map((v, i) => (
        <div key={i} className="flex-1 rounded-t-sm transition-all"
          style={{ height: `${Math.max(8, (v / max) * 100)}%`, background: v > 0 ? color : 'rgba(255,255,255,0.08)', opacity: v > 0 ? 0.85 : 1 }} />
      ))}
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
