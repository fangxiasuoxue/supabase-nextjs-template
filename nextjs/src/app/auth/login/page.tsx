// src/app/auth/login/page.tsx
'use client';

import { createSPASassClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SSOButtons from '@/components/SSOButtons';

const labels = {
  zh: {
    title: '登录账号', subtitle: '登录以继续使用控制台',
    emailLabel: '邮箱', passwordLabel: '密码',
    forgotPassword: '忘记密码？', submit: '登录', submitting: '登录中...',
    divider: '第三方登录', noAccount: '没有账号？', register: '立即注册',
  },
  en: {
    title: 'Sign In', subtitle: 'Authorize your session to continue',
    emailLabel: 'Email', passwordLabel: 'Password',
    forgotPassword: 'Forgot password?', submit: 'Sign In', submitting: 'Signing in...',
    divider: 'Third-Party Auth', noAccount: 'No account?', register: 'Register',
  },
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMFAPrompt, setShowMFAPrompt] = useState(false);
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const router = useRouter();
  const i18n = labels[lang];

  useEffect(() => {
    try {
      const saved = localStorage.getItem('app_language') as 'zh' | 'en' | null;
      if (saved === 'zh' || saved === 'en') setLang(saved);
    } catch {}
  }, []);

  useEffect(() => {
    if (showMFAPrompt) router.push('/auth/2fa');
  }, [showMFAPrompt, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const client = await createSPASassClient();
      const { error: signInError } = await client.loginEmail(email, password);
      if (signInError) throw signInError;

      const supabase = client.getSupabaseClient();
      const { data: mfaData, error: mfaError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (mfaError) throw mfaError;

      if (mfaData.nextLevel === 'aal2' && mfaData.nextLevel !== mfaData.currentLevel) {
        setShowMFAPrompt(true);
      } else {
        router.push('/app');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleLang = () => {
    const next = lang === 'zh' ? 'en' : 'zh';
    setLang(next);
    try { localStorage.setItem('app_language', next); } catch {}
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{i18n.title}</h1>
          <p className="text-sm text-muted-foreground">{i18n.subtitle}</p>
        </div>
        <button
          onClick={toggleLang}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors mt-1"
        >
          {lang === 'zh' ? 'EN' : '中文'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
          <span className="text-sm text-rose-400">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-foreground/80">
            {i18n.emailLabel}
          </label>
          <input
            id="email" name="email" type="email" autoComplete="email" required
            value={email} onChange={(e) => setEmail(e.target.value)}
            className="block w-full bg-secondary/40 border border-white/10 rounded-xl h-11 px-4 text-sm focus:ring-1 focus:ring-primary/50 focus:border-primary/40 outline-none transition-all placeholder:text-muted-foreground/40"
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium text-foreground/80">
              {i18n.passwordLabel}
            </label>
            <Link href="/auth/forgot-password" className="text-xs text-primary/70 hover:text-primary transition-colors">
              {i18n.forgotPassword}
            </Link>
          </div>
          <input
            id="password" name="password" type="password" autoComplete="current-password" required
            value={password} onChange={(e) => setPassword(e.target.value)}
            className="block w-full bg-secondary/40 border border-white/10 rounded-xl h-11 px-4 text-sm focus:ring-1 focus:ring-primary/50 focus:border-primary/40 outline-none transition-all placeholder:text-muted-foreground/40"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit" disabled={loading}
          className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-semibold text-sm shadow-[0_4px_14px_hsl(var(--primary)/0.3)] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              <span>{i18n.submitting}</span>
            </>
          ) : <span>{i18n.submit}</span>}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/8" />
        </div>
        <div className="relative flex justify-center text-xs text-muted-foreground/50">
          <span className="bg-background px-3">{i18n.divider}</span>
        </div>
      </div>

      <SSOButtons onError={setError} />

      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          {i18n.noAccount}{' '}
          <Link href="/auth/register" className="text-primary hover:text-primary/80 font-medium transition-colors">
            {i18n.register}
          </Link>
        </p>
      </div>
    </div>
  );
}
