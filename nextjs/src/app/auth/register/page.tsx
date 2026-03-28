'use client';

import {createSPASassClient} from '@/lib/supabase/client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SSOButtons from "@/components/SSOButtons";

export default function RegisterPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!acceptedTerms) {
            setError('You must accept the Terms of Service and Privacy Policy');
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords don't match");
            return;
        }

        setLoading(true);

        try {
            const supabase = await createSPASassClient();
            const { error } = await supabase.registerEmail(email, password);

            if (error) throw error;

            router.push('/auth/verify-email');
        } catch (err: Error | unknown) {
            if(err instanceof Error) {
                setError(err.message);
            } else {
                setError('An unknown error occurred');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="space-y-2">
                <h1 className="text-3xl font-black tracking-tighter uppercase">New <span className="text-primary">Identity</span></h1>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black opacity-60">Register your terminal credentials</p>
            </div>

            {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 animate-in zoom-in-95">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                    <span className="text-[10px] font-black tech-mono text-rose-400 uppercase tracking-widest">{error}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">
                            Identification / Email
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="block w-full bg-white/[0.03] border border-white/5 rounded-2xl h-12 px-5 tech-mono text-sm focus:ring-1 focus:ring-primary/50 outline-none transition-all placeholder:text-muted-foreground/20"
                            placeholder="OPERATOR@CORE.SYS"
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">
                            Passcode / Key
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="new-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="block w-full bg-white/[0.03] border border-white/5 rounded-2xl h-12 px-5 tech-mono text-sm focus:ring-1 focus:ring-primary/50 outline-none transition-all placeholder:text-muted-foreground/20"
                            placeholder="••••••••••••"
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="confirmPassword" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">
                            Validate / Confirm
                        </label>
                        <input
                            id="confirmPassword"
                            name="confirmPassword"
                            type="password"
                            autoComplete="new-password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="block w-full bg-white/[0.03] border border-white/5 rounded-2xl h-12 px-5 tech-mono text-sm focus:ring-1 focus:ring-primary/50 outline-none transition-all placeholder:text-muted-foreground/20"
                            placeholder="••••••••••••"
                        />
                    </div>
                </div>

                <div className="flex items-start px-2">
                    <div className="flex h-5 items-center">
                        <input
                            id="terms"
                            name="terms"
                            type="checkbox"
                            checked={acceptedTerms}
                            onChange={(e) => setAcceptedTerms(e.target.checked)}
                            className="h-4 w-4 rounded border-white/10 bg-white/[0.03] text-primary focus:ring-primary/20 accent-primary"
                        />
                    </div>
                    <div className="ml-3 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-relaxed">
                        <label htmlFor="terms">
                            I accept the{' '}
                            <Link href="/legal/terms" className="text-primary/60 hover:text-primary transition-colors" target="_blank">Terms of Service</Link>
                            {' '}and{' '}
                            <Link href="/legal/privacy" className="text-primary/60 hover:text-primary transition-colors" target="_blank">Privacy Policy</Link>
                        </label>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl font-black uppercase tracking-[0.3em] text-[11px] shadow-[0_15px_30px_hsl(var(--primary)/0.2)] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
                >
                    {loading ? (
                        <>
                            <div className="w-4 h-4 border-2 border-primary-foreground/20 border-t-primary-foreground rounded-full animate-spin" />
                            <span>Creating Identity...</span>
                        </>
                    ) : (
                        <span>Initialize Account</span>
                    )}
                </button>
            </form>

            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/5"></div>
                </div>
                <div className="relative flex justify-center text-[8px] uppercase font-black tracking-[0.5em] text-muted-foreground opacity-30">
                    <span className="bg-[#020617] px-4">Direct Data Link</span>
                </div>
            </div>

            <SSOButtons onError={setError}/>

            <div className="text-center pt-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
                    Identified?{' '}
                    <Link href="/auth/login" className="text-primary/60 hover:text-primary transition-colors">
                        Return to Login
                    </Link>
                </p>
            </div>
        </div>
    );
}