'use client';

import { createSPASassClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SSOButtons from "@/components/SSOButtons";

const labels = {
  zh: {
    title: '注册账号', subtitle: '创建你的控制台账号',
    emailLabel: '邮箱', passwordLabel: '密码', confirmLabel: '确认密码',
    terms: '我已阅读并同意', termsLink: '服务条款', and: '和', privacyLink: '隐私政策',
    submit: '注册', submitting: '注册中...',
    divider: '第三方登录', hasAccount: '已有账号？', login: '登录',
    errTerms: '请先同意服务条款和隐私政策',
    errMismatch: '两次输入的密码不一致',
  },
  en: {
    title: 'Create Account', subtitle: 'Register your console credentials',
    emailLabel: 'Email', passwordLabel: 'Password', confirmLabel: 'Confirm Password',
    terms: 'I accept the', termsLink: 'Terms of Service', and: 'and', privacyLink: 'Privacy Policy',
    submit: 'Register', submitting: 'Creating account...',
    divider: 'Third-Party Auth', hasAccount: 'Already have an account?', login: 'Sign In',
    errTerms: 'You must accept the Terms of Service and Privacy Policy',
    errMismatch: "Passwords don't match",
  },
}

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const router = useRouter();
  const i18n = labels[lang];

  useEffect(() => {
    try {
      const saved = localStorage.getItem('app_language') as 'zh' | 'en' | null;
      if (saved === 'zh' || saved === 'en') setLang(saved);
    } catch {}
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!acceptedTerms) { setError(i18n.errTerms); return; }
    if (password !== confirmPassword) { setError(i18n.errMismatch); return; }

    setLoading(true);
    try {
      const supabase = await createSPASassClient();
      const { error } = await supabase.registerEmail(email, password);
      if (error) throw error;
      router.push('/auth/verify-email');
    } catch (err: Error | unknown) {
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
          <label htmlFor="email" className="text-sm font-medium text-foreground/80">{i18n.emailLabel}</label>
          <input
            id="email" name="email" type="email" autoComplete="email" required
            value={email} onChange={(e) => setEmail(e.target.value)}
            className="block w-full bg-secondary/40 border border-white/10 rounded-xl h-11 px-4 text-sm focus:ring-1 focus:ring-primary/50 focus:border-primary/40 outline-none transition-all placeholder:text-muted-foreground/40"
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium text-foreground/80">{i18n.passwordLabel}</label>
          <input
            id="password" name="password" type="password" autoComplete="new-password" required
            value={password} onChange={(e) => setPassword(e.target.value)}
            className="block w-full bg-secondary/40 border border-white/10 rounded-xl h-11 px-4 text-sm focus:ring-1 focus:ring-primary/50 focus:border-primary/40 outline-none transition-all placeholder:text-muted-foreground/40"
            placeholder="••••••••"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground/80">{i18n.confirmLabel}</label>
          <input
            id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required
            value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
            className="block w-full bg-secondary/40 border border-white/10 rounded-xl h-11 px-4 text-sm focus:ring-1 focus:ring-primary/50 focus:border-primary/40 outline-none transition-all placeholder:text-muted-foreground/40"
            placeholder="••••••••"
          />
        </div>

        <div className="flex items-start gap-3 pt-1">
          <input
            id="terms" name="terms" type="checkbox"
            checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="h-4 w-4 mt-0.5 rounded border-white/10 bg-secondary/40 text-primary focus:ring-primary/20 accent-primary flex-shrink-0"
          />
          <label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed">
            {i18n.terms}{' '}
            <Link href="/legal/terms" className="text-primary hover:text-primary/80 transition-colors" target="_blank">{i18n.termsLink}</Link>
            {' '}{i18n.and}{' '}
            <Link href="/legal/privacy" className="text-primary hover:text-primary/80 transition-colors" target="_blank">{i18n.privacyLink}</Link>
          </label>
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
          {i18n.hasAccount}{' '}
          <Link href="/auth/login" className="text-primary hover:text-primary/80 font-medium transition-colors">
            {i18n.login}
          </Link>
        </p>
      </div>
    </div>
  );
}
