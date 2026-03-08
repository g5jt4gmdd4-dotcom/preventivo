'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, LogIn, PlaneTakeoff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password, rememberMe }),
      });

      if (res.ok) {
        // Ricarica la pagina: il middleware ora farà passare l'utente
        router.refresh();
        router.push('/');
      } else {
        const data = await res.json();
        setError(data.error || 'Password errata');
      }
    } catch (err) {
      setError('Errore di connessione al server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">
        <div className="p-8 text-center bg-blue-600">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <PlaneTakeoff className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Generatore Preventivi</h1>
          <p className="text-blue-100 text-sm">Accesso Riservato</p>
        </div>

        <form onSubmit={handleLogin} className="p-8 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium border border-red-100 text-center">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 block">Password Aziendale</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder-slate-300"
                required
              />
              <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <label className="flex items-center cursor-pointer group">
            <div className="relative flex items-center justify-center w-5 h-5">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.value === 'true' || e.target.checked)}
              />
              <div className="w-5 h-5 border-2 border-slate-300 rounded peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-colors"></div>
              <svg className="absolute w-3 h-3 text-white scale-0 peer-checked:scale-100 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="ml-3 text-sm font-medium text-slate-600 group-hover:text-slate-800 transition-colors">
              Resta collegato (30 giorni)
            </span>
          </label>

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center transition-colors shadow-lg shadow-blue-600/20"
          >
            {loading ? (
              <span className="animate-pulse">Verifica in corso...</span>
            ) : (
              <>
                <LogIn className="w-5 h-5 mr-2" />
                Accedi al Sistema
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
