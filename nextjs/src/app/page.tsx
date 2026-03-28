'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Globe, Shield, Users, Key, Database, Clock, Activity, Cpu, Lock, Terminal, Zap, ChevronRight } from 'lucide-react';
import AuthAwareButtons from '@/components/AuthAwareButtons';
import HomePricing from "@/components/HomePricing";
import { useLanguage } from '@/lib/context/LanguageContext';

export default function Home() {
  const productName = process.env.NEXT_PUBLIC_PRODUCTNAME || 'JIEDIAN';
  const { language } = useLanguage();

  const features = [
    {
      icon: Terminal,
      title: language === 'en' ? 'Node Infrastructure' : '节点基础设施',
      description: language === 'en' ? 'Manage global proxy nodes with millisecond-precision telemetry.' : '以毫秒级精度管理全球代理节点。',
      color: 'text-cyan-400'
    },
    {
      icon: Shield,
      title: language === 'en' ? 'Hardened Security' : '强化安全',
      description: language === 'en' ? 'Multi-layer encryption and identity verification for every session.' : '为每个会话提供多层加密和身份验证。',
      color: 'text-emerald-400'
    },
    {
      icon: Zap,
      title: language === 'en' ? 'Quantum Performance' : '量子性能',
      description: language === 'en' ? 'Low-latency routing optimized for high-bandwidth operations.' : '针对高带宽操作优化的低延迟路由。',
      color: 'text-amber-400'
    },
    {
      icon: Database,
      title: language === 'en' ? 'Asset Management' : '资产管理',
      description: language === 'en' ? 'Unified control for VPS, IP ranges, and specialized containers.' : '对 VPS、IP 范围和专用容器的统一控制。',
      color: 'text-rose-400'
    },
    {
      icon: Activity,
      title: language === 'en' ? 'Live Telemetry' : '实时遥测',
      description: language === 'en' ? 'Real-time monitoring of node health and traffic patterns.' : '实时监控节点健康状况和流量模式。',
      color: 'text-indigo-400'
    },
    {
      icon: Lock,
      title: language === 'en' ? 'Privacy Shield' : '隐私盾',
      description: language === 'en' ? 'Next-gen tunneling protocols focused on anonymity.' : '专注于匿名性的下一代隧道协议。',
      color: 'text-purple-400'
    }
  ];

  return (
    <div className="min-h-screen bg-[#020617] text-foreground font-sans selection:bg-primary/30 overflow-x-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 grid-background opacity-20 pointer-events-none" />
      <div className="fixed inset-0 hero-glow opacity-40 pointer-events-none" />
      
      {/* Navigation */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 w-[90%] max-w-7xl glass-card-premium rounded-3xl z-50 border-white/[0.05] shadow-2xl overflow-hidden px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <span className="text-primary font-black text-xs">J</span>
            </div>
            <span className="text-xl font-black tracking-tighter uppercase whitespace-nowrap">
              {productName} <span className="text-primary">PRO</span>
            </span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground hover:text-primary transition-colors">
              Systems
            </Link>
            <Link href="#pricing" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground hover:text-primary transition-colors">
              Access Tiers
            </Link>
            <AuthAwareButtons variant="nav" />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-48 pb-32 flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center space-y-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.02] border border-white/5 backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-1000">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Protocol v4.2.0 Active</span>
          </div>

          <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] uppercase animate-in fade-in slide-in-from-bottom-8 duration-1000 text-white">
            Next-Gen <br /> 
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-cyan-300 to-white/90">Node Command</span> <br /> 
            Center
          </h1>

          <p className="max-w-2xl mx-auto text-muted-foreground font-medium text-lg md:text-xl leading-relaxed animate-in fade-in slide-in-from-bottom-8 delay-200 duration-1000">
            Deploy, monitor, and scale your global infrastructure with millisecond-precision. 
            The ultimate terminal for professional proxy and node management.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-in fade-in slide-in-from-bottom-8 delay-400 duration-1000">
            <AuthAwareButtons />
            <Link href="/legal/docs" className="h-14 px-8 flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-primary border border-white/5 hover:border-primary/20 rounded-2xl transition-all">
              <Terminal className="w-4 h-4" />
              Technical Docs
            </Link>
          </div>
        </div>
      </section>

      {/* Bento Grid Features */}
      <section id="features" className="py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-20 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Core Systems</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase">Integrated <br /> Capability</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="glass-card-premium glass-card-hover rounded-[2.5rem] p-8 space-y-6 group border-white/5"
              >
                <div className={`w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center group-hover:bg-primary/10 group-hover:border-primary/20 transition-all duration-500`}>
                  <feature.icon className={`h-7 w-7 ${feature.color}`} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black tracking-tight uppercase group-hover:text-primary transition-colors">{feature.title}</h3>
                  <p className="text-muted-foreground font-medium leading-relaxed italic">{feature.description}</p>
                </div>
                <div className="pt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary/40 group-hover:text-primary/100 transition-all">
                  Initialize <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Display */}
      <section className="py-24 border-y border-white/5 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
            {[
              { label: 'Active Clusters', value: '1.2k+' },
              { label: 'Latency Node', value: '14ms' },
              { label: 'Uplink Capacity', value: '400Gbps' },
              { label: 'Uptime Protocol', value: '99.99%' }
            ].map((stat, index) => (
              <div key={index} className="space-y-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">{stat.label}</div>
                <div className="text-4xl font-black tech-mono tracking-tighter text-primary">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div id="pricing" className="py-32">
        <HomePricing />
      </div>

      {/* CTA Section */}
      <section className="py-48 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 -skew-y-3 origin-center scale-110" />
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center space-y-8">
          <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase leading-none">
            Ready to <br /> <span className="text-primary italic">Authorize?</span>
          </h2>
          <p className="text-xl text-muted-foreground font-medium">
            Join the elite network of operators managing the digital frontier.
          </p>
          <div className="flex justify-center pt-4">
            <Link
              href="/auth/register"
              className="px-12 h-16 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl font-black uppercase tracking-[0.3em] text-[12px] shadow-[0_15px_30px_hsl(var(--primary)/0.3)] transition-all active:scale-[0.98] flex items-center gap-4 group"
            >
              Request Access Key
              <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* Technical Footer */}
      <footer className="py-20 border-t border-white/5 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
            <div className="col-span-2 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <span className="text-primary font-black text-[10px]">J</span>
                </div>
                <span className="text-sm font-black tracking-tighter uppercase">{productName} PRO</span>
              </div>
              <p className="max-w-xs text-[10px] font-medium leading-relaxed text-muted-foreground/60 uppercase tracking-widest">
                Professional node infrastructure for high-bandwidth operations. Built for performance and security.
              </p>
            </div>
            
            <div className="space-y-6">
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Resources</h4>
              <ul className="space-y-4">
                <li><Link href="#features" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">Documentation</Link></li>
                <li><Link href="#pricing" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">API Reference</Link></li>
              </ul>
            </div>

            <div className="space-y-6">
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Legal</h4>
              <ul className="space-y-4">
                <li><Link href="/legal/privacy" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">Privacy Protocol</Link></li>
                <li><Link href="/legal/terms" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">Terms of Use</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[8px] font-black uppercase tracking-[0.5em] text-muted-foreground/30">
              © {new Date().getFullYear()} {productName} SYSTEMS. ALL RIGHTS RESERVED.
            </p>
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60">Core Status: Operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}