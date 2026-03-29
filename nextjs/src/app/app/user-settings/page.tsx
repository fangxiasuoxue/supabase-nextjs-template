// @ts-nocheck
"use client";
import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useGlobal } from '@/lib/context/GlobalContext';
import { createSPASassClientAuthenticated as createSPASassClient } from '@/lib/supabase/client';
import { Key, User, CheckCircle, AlertCircle, Loader2, Activity } from 'lucide-react';
import { useLanguage } from '@/lib/context/LanguageContext';
import { MFASetup } from '@/components/MFASetup';

export default function UserSettingsPage() {
    const { user } = useGlobal();
    const { t } = useLanguage();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');



    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setError(t('user.password.mismatch'));
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const supabase = await createSPASassClient();
            const client = supabase.getSupabaseClient();

            const { error } = await client.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            setSuccess(t('user.password.updated'));
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: Error | unknown) {
            if (err instanceof Error) {
                console.error('Error updating password:', err);
                setError(err.message);
            } else {
                console.error('Error updating password:', err);
                setError('Failed to update password');
            }
        } finally {
            setLoading(false);
        }
    };



    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-[cubic-bezier(0.2,0.8,0.2,1)]">
            <div className="flex flex-col gap-4 relative">
                <div className="flex items-center gap-3 text-primary-400 mb-1 group cursor-default">
                    <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 group-hover:bg-primary/20 transition-colors">
                        <User className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-[0.3em] font-black text-primary-400/80">User Command Interface</span>
                        <span className="text-[8px] text-muted-foreground uppercase tracking-widest -mt-0.5">Identity Protocol v4.0</span>
                    </div>
                </div>
                <h1 className="text-5xl font-black tracking-tighter text-foreground leading-none">
                    {t('user.title')} <span className="text-primary-500 drop-shadow-[0_0_15px_hsl(var(--primary)/0.5)]">.</span>
                </h1>
                <p className="text-muted-foreground/80 max-w-2xl text-sm font-medium leading-relaxed">{t('user.desc')}</p>
            </div>

            {error && (
                <Alert className="bg-rose-500/10 border-rose-500/20 text-rose-400 rounded-2xl p-4 animate-in zoom-in-95 duration-300">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="tech-mono text-[10px] uppercase font-black tracking-widest ml-2">{error}</AlertDescription>
                </Alert>
            )}

            {success && (
                <Alert className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 rounded-2xl p-4 animate-in zoom-in-95 duration-300">
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription className="tech-mono text-[10px] uppercase font-black tracking-widest ml-2">{success}</AlertDescription>
                </Alert>
            )}

            <div className="grid gap-10 xl:grid-cols-3">
                <div className="xl:col-span-2 space-y-10">
                    {/* Identity Matrix */}
                    <div className="glass-card-premium p-10 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] -mr-32 -mt-32 group-hover:bg-primary/10 transition-colors" />
                        
                        <div className="flex items-center gap-6 mb-10 relative z-10">
                            <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20">
                                <User className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black tracking-tight uppercase">{t('user.details')}</h2>
                                <span className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black opacity-60">Identity Verification Data</span>
                            </div>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-8 relative z-10">
                            <div className="p-6 rounded-2xl bg-black/40 border border-white/5 space-y-2 hover:border-primary/20 transition-colors group/item">
                                <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest block opacity-60 group-hover/item:text-primary/60 transition-colors">{t('user.email')}</label>
                                <p className="text-base font-black tech-mono text-foreground break-all">{user?.email}</p>
                            </div>
                            <div className="p-6 rounded-2xl bg-black/40 border border-white/5 space-y-2 hover:border-primary/20 transition-colors group/item">
                                <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest block opacity-60 group-hover/item:text-primary/60 transition-colors">{t('user.id')}</label>
                                <p className="text-xs font-bold tech-mono text-muted-foreground/60 break-all">{user?.id}</p>
                            </div>
                        </div>
                    </div>

                    {/* Access Control Encryption */}
                    <div className="glass-card-premium p-10 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 blur-[100px] -mr-32 -mt-32 group-hover:bg-amber-500/10 transition-colors" />

                        <div className="flex items-center gap-6 mb-10 relative z-10">
                            <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                                <Key className="h-8 w-8 text-amber-500" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black tracking-tight uppercase">{t('user.password.title')}</h2>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black opacity-60">Security Credential Update</p>
                            </div>
                        </div>

                        <form onSubmit={handlePasswordChange} className="space-y-8 max-w-md relative z-10">
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <label htmlFor="new-password" className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest ml-1 block">
                                        {t('user.password.new')}
                                    </label>
                                    <input
                                        type="password"
                                        id="new-password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full bg-black/40 border border-white/5 rounded-2xl h-14 px-5 focus:ring-1 focus:ring-primary/50 outline-none tech-mono text-base transition-all placeholder:text-muted-foreground/20"
                                        placeholder="NEW TERMINAL CODE"
                                        required
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label htmlFor="confirm-password" className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest ml-1 block">
                                        {t('user.password.confirm')}
                                    </label>
                                    <input
                                        type="password"
                                        id="confirm-password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full bg-black/40 border border-white/5 rounded-2xl h-14 px-5 focus:ring-1 focus:ring-primary/50 outline-none tech-mono text-base transition-all placeholder:text-muted-foreground/20"
                                        placeholder="RE-ENTER CODE"
                                        required
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground w-full rounded-2xl h-14 font-black uppercase tracking-[0.3em] text-[11px] transition-all flex items-center justify-center gap-3 shadow-[0_15px_35px_hsl(var(--primary)/0.3)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>EXECUTING...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="h-4 w-4" />
                                        <span>RECODE_IDENTITY</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Multi-Factor Authentication Bridge */}
                    <div className="glass-card-premium p-2 rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl relative group">
                         <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] -mr-32 -mt-32 group-hover:bg-primary/10 transition-colors" />
                         <div className="relative z-10">
                            <MFASetup
                                onStatusChange={() => {
                                    setSuccess('');
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-10">
                    <div className="glass-card-premium p-8 rounded-[2.5rem] border border-primary/20 bg-primary/5 shadow-2xl relative overflow-hidden group/sec">
                        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-8 text-center drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]">System Security Status</h3>
                        <div className="flex flex-col items-center gap-8 py-4 relative z-10">
                            <div className="relative">
                                <div className="w-24 h-24 rounded-full bg-emerald-500/10 border-2 border-emerald-500/20 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.1)] group-hover/sec:scale-105 transition-transform duration-500">
                                    <CheckCircle className="h-10 w-10 text-emerald-500 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-emerald-500 border-4 border-[#020617] flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.6)]">
                                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                </div>
                            </div>
                            <div className="text-center space-y-2">
                                <p className="text-sm font-black uppercase tracking-widest text-foreground">Verified Operator</p>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] text-muted-foreground uppercase font-black tracking-[0.2em] opacity-60">Status: End-to-End Encrypted</span>
                                    <span className="text-[8px] text-primary/60 font-black uppercase tracking-[0.3em] tech-mono">AES_256_GCM_ACTIVE</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-10 pt-8 border-t border-white/5 space-y-4">
                            <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                                <span className="text-muted-foreground/60">Risk Assessment</span>
                                <span className="text-emerald-400">Low / Optimal</span>
                            </div>
                            <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full w-[95%] shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                            </div>
                        </div>
                    </div>

                    <div className="glass-card-premium p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden group/tip">
                        <div className="flex items-start gap-4 relative z-10">
                            <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-primary">
                                <Activity className="h-5 w-5" />
                            </div>
                            <div className="space-y-2">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground">Security Protocol Tip</h4>
                                <p className="text-[10px] font-bold text-muted-foreground/60 leading-relaxed uppercase">
                                    建议每隔 <span className="text-foreground">30 天</span> 更换一次身份验证代码。
                                    <br />
                                    开启 <span className="text-primary">MFA 二步验证</span> 后可获得最高级别的防御态势。
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}