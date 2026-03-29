// @ts-nocheck
"use client";
import React from 'react';
import { useGlobal } from '@/lib/context/GlobalContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { CalendarDays, Settings, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/lib/context/LanguageContext';

export default function DashboardContent() {
    const { loading, user } = useGlobal();
    const { t } = useLanguage();

    const getDaysSinceRegistration = () => {
        if (!user?.registered_at) return 0;
        const today = new Date();
        const diffTime = Math.abs(today.getTime() - user.registered_at.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    const daysSinceRegistration = getDaysSinceRegistration();

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Hero Welcome Section */}
            <div className="relative overflow-hidden glass-card rounded-[2rem] p-8 border border-primary-500/20 shadow-2xl shadow-primary-500/5">
                <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                    <CalendarDays className="h-64 w-64" />
                </div>
                
                <div className="relative z-10 space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-[10px] font-black uppercase tracking-widest text-primary-400">
                        System Online / Welcome Back
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-foreground">
                        {t('dashboard.welcome', { name: user?.email?.split('@')[0] || 'Operator' })} <span className="text-primary-500">.</span>
                    </h1>
                    <div className="flex items-center gap-4 text-muted-foreground">
                        <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/5 shadow-inner">
                            <CalendarDays className="h-4 w-4 text-primary-400" />
                            <span className="text-sm font-bold tech-mono">{t('dashboard.memberDays', { days: daysSinceRegistration })}</span>
                            <span className="text-[10px] uppercase opacity-50 font-bold ml-1">Days Active</span>
                        </div>
                        <div className="h-1 w-1 rounded-full bg-white/20" />
                        <span className="text-xs uppercase tracking-widest font-bold opacity-70">Uptime: 99.99%</span>
                    </div>
                </div>
            </div>

            {/* Quick Actions & Navigation */}
            <div className="grid gap-8 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between mb-2 px-2">
                        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground/80">Command Shortcuts</h2>
                    </div>
                    
                    <div className="grid gap-4 md:grid-cols-2">
                        <Link
                            href="/app/user-settings"
                            className="group glass-card p-6 rounded-3xl border border-white/5 hover:border-primary-500/30 transition-all duration-300 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Settings className="h-16 w-16" />
                            </div>
                            <div className="flex items-start gap-4 mb-4">
                                <div className="p-3 bg-primary-500/10 rounded-2xl border border-primary-500/10 group-hover:border-primary-500/30 transition-colors">
                                    <Settings className="h-6 w-6 text-primary-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black tracking-tight">{t('dashboard.quickActions.userSettings.title')}</h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed mt-1 uppercase tracking-wider font-bold opacity-60">
                                        {t('dashboard.quickActions.userSettings.desc')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary-400 mt-4">
                                <span>Execution Layer</span>
                                <div className="h-px flex-1 bg-primary-500/10" />
                            </div>
                        </Link>

                        <Link
                            href="/app/table"
                            className="group glass-card p-6 rounded-3xl border border-white/5 hover:border-primary-500/30 transition-all duration-300 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <ExternalLink className="h-16 w-16" />
                            </div>
                            <div className="flex items-start gap-4 mb-4">
                                <div className="p-3 bg-primary-500/10 rounded-2xl border border-primary-500/10 group-hover:border-primary-500/30 transition-colors">
                                    <ExternalLink className="h-6 w-6 text-primary-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black tracking-tight">{t('dashboard.quickActions.examplePage.title')}</h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed mt-1 uppercase tracking-wider font-bold opacity-60">
                                        {t('dashboard.quickActions.examplePage.desc')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary-400 mt-4">
                                <span>Network Layer</span>
                                <div className="h-px flex-1 bg-primary-500/10" />
                            </div>
                        </Link>
                    </div>
                </div>

                {/* Info / Status Sidebar */}
                <div className="glass-card p-6 rounded-3xl border border-amber-500/10 bg-amber-500/[0.02]">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-amber-500/10 rounded-xl">
                            <Settings className="h-4 w-4 text-amber-500" />
                        </div>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500">System Notification</h3>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Core Service</span>
                            </div>
                            <p className="text-xs font-bold uppercase text-foreground">Next-Gen Node Infrastructure Active</p>
                        </div>
                        
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2 opacity-50 grayscale">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Maintenance</span>
                            </div>
                            <p className="text-xs font-bold uppercase text-foreground">Scheduled API Optimization (Pending)</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}