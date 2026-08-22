'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const TOKEN_KEY = 'scc_token';
const referenceImage = '/painel-super-admin-reference.jfif';

type TabKey = 'dashboard' | 'clientes' | 'modulos';

/**
 * Página principal — composição visual da referência aprovada, com os
 * hotspots levando de verdade pro painel funcional em /gestao (tabela real,
 * bloquear/reativar, resetar senha, impersonar, MRR real). Sem isso os
 * "botões" da imagem não fariam nada além de mudar um estado invisível.
 */
export default function SuperAdminReferencePreview() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem(TOKEN_KEY)) {
      window.location.href = '/login';
      return;
    }
    setChecked(true);
  }, []);

  function goTo(nextTab: TabKey) {
    setTab(nextTab);
    router.push(`/gestao?tab=${nextTab}`);
  }

  function handleFilterKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') router.push('/gestao?tab=clientes');
  }

  if (!checked) return null;

  return (
    <main className="reference-page" aria-label="Painel Super Admin V5 Nichos">
      <div className="reference-frame">
        <img
          src={referenceImage}
          alt="Prévia do Painel Super Admin V5 Nichos"
          className="reference-image"
        />

        {/* Camada de interação alinhada às regiões da referência — leva pro
            painel funcional em /gestao, com a aba já pré-selecionada. */}
        <div className="hotspots" aria-label="Controles do painel">
          <button className="hotspot dashboard-hotspot" onClick={() => goTo('dashboard')} aria-label="Dashboard" />
          <button className="hotspot clients-hotspot" onClick={() => goTo('clientes')} aria-label="Gestão de Clientes" />
          <button className="hotspot modules-hotspot" onClick={() => goTo('modulos')} aria-label="Configuração de Módulos" />
          <input
            className="filter-hotspot"
            aria-label="Filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            onKeyDown={handleFilterKeyDown}
            placeholder="Filter"
          />
        </div>

        <span className="sr-only">Aba atual: {tab}. Filtro: {filter}</span>
      </div>

      <style jsx global>{`
        * { box-sizing: border-box; }
        html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #edf1f5; }
        body { font-family: Arial, Helvetica, sans-serif; }
        .reference-page { width: 100vw; height: 100vh; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #edf1f5; }
        .reference-frame { position: relative; width: min(100vw, calc(100vh * 1.8333333333)); aspect-ratio: 1408 / 768; overflow: hidden; }
        .reference-image { position: absolute; inset: 0; width: 100%; height: 100%; display: block; object-fit: fill; user-select: none; pointer-events: none; }
        .hotspots { position: absolute; inset: 0; }
        .hotspot { position: absolute; border: 0; background: transparent; padding: 0; cursor: pointer; }
        .dashboard-hotspot { left: 21.5%; top: 23.8%; width: 8.3%; height: 3%; }
        .clients-hotspot { left: 21.5%; top: 26.9%; width: 8.3%; height: 4.7%; }
        .modules-hotspot { left: 21.5%; top: 31.8%; width: 8.3%; height: 5.6%; }
        .filter-hotspot { position: absolute; left: 58.2%; top: 23.6%; width: 6%; height: 2.5%; padding: 0 3px; border: 0; outline: none; background: transparent; color: transparent; caret-color: transparent; font-size: 8px; }
        .filter-hotspot::placeholder { color: transparent; }
        .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
      `}</style>
    </main>
  );
}
