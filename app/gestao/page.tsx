'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function GestaoRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get('tab');
    router.replace(tab ? `/?tab=${tab}` : '/');
  }, [router, searchParams]);

  return null;
}

/** /gestao existiu por poucos minutos como página separada — o painel real
 * voltou a ser "/". Mantido como redirect só pra não quebrar quem já tinha
 * o link salvo/aberto. */
export default function GestaoRedirect() {
  return (
    <Suspense fallback={null}>
      <GestaoRedirectInner />
    </Suspense>
  );
}
