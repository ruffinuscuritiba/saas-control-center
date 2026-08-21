'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Crown } from 'lucide-react';

const TOKEN_KEY = 'scc_token';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Erro ao entrar.');
        return;
      }
      localStorage.setItem(TOKEN_KEY, data.accessToken);
      router.push('/');
    } catch {
      setError('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0d12]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 bg-violet-600">
            <Crown className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">SaaS Control Center</h1>
          <p className="text-gray-400 text-sm mt-1">Food · Estética · Mecânica · Moda</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl p-8 space-y-5 bg-[#14171f] border border-white/10">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">E-mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full px-4 py-3 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none placeholder:text-gray-500"
              placeholder="voce@plataforma.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Senha</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full px-4 py-3 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none placeholder:text-gray-500"
              placeholder="••••••••" />
          </div>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-white bg-violet-600 hover:bg-violet-500 transition-colors disabled:opacity-60">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
