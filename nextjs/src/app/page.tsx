'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Boxes, Ship, Store, Cloud, Search, Bot, Languages } from 'lucide-react';
import AuthAwareButtons from '@/components/AuthAwareButtons';
import HomePricing from "@/components/HomePricing";
import { useLanguage } from '@/lib/context/LanguageContext';

export default function Home() {
  const productName = process.env.NEXT_PUBLIC_PRODUCTNAME || 'JIEDIAN';
  const { language, setLanguage, t } = useLanguage();

  const features = [
    { icon: Boxes, key: 'supply', color: 'text-cyan-600' },
    { icon: Ship, key: 'freight', color: 'text-blue-600' },
    { icon: Store, key: 'operation', color: 'text-amber-600' },
    { icon: Cloud, key: 'cloud', color: 'text-indigo-600' },
    { icon: Search, key: 'site', color: 'text-emerald-600' },
    { icon: Bot, key: 'ai', color: 'text-purple-600' },
  ];

  const stats = [
    { key: 'countries' },
    { key: 'shipments' },
    { key: 'stores' },
    { key: 'uptime' },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 w-[94%] max-w-7xl bg-white/90 backdrop-blur rounded-2xl z-50 border border-slate-200 shadow-sm px-6 py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">{productName.charAt(0)}</span>
            </div>
            <span className="text-lg font-bold tracking-tight whitespace-nowrap">{productName}</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="#services" className="hidden md:inline text-sm font-medium text-slate-600 hover:text-primary-600 transition-colors">
              {t('home.nav.services')}
            </Link>
            <Link href="#plans" className="hidden md:inline text-sm font-medium text-slate-600 hover:text-primary-600 transition-colors">
              {t('home.nav.solutions')}
            </Link>
            <button
              type="button"
              onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-primary-600 transition-colors"
              aria-label="Switch language"
            >
              <Languages className="w-4 h-4" />
              {language === 'en' ? '中文' : 'EN'}
            </button>
            <AuthAwareButtons variant="nav" />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-40 pb-24">
        <div className="absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-primary-50 to-white pointer-events-none" />
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-600" />
            </span>
            <span className="text-xs font-semibold text-primary-700">{t('home.hero.badge')}</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-slate-900">
            {t('home.hero.title')}
          </h1>

          <p className="max-w-2xl mx-auto text-slate-600 text-lg leading-relaxed">
            {t('home.hero.subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-2">
            <AuthAwareButtons />
            <Link
              href="#services"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
            >
              {t('home.hero.ctaSecondary')}
            </Link>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-14 text-center space-y-3">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">{t('home.features.eyebrow')}</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t('home.features.heading')}</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.key}
                className="rounded-2xl p-7 border border-slate-200 bg-white hover:shadow-md hover:border-slate-300 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-5 group-hover:bg-primary-50 transition-colors">
                  <feature.icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                <h3 className="text-xl font-semibold mb-2">{t(`home.feature.${feature.key}.title`)}</h3>
                <p className="text-slate-600 leading-relaxed">{t(`home.feature.${feature.key}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 border-y border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
            {stats.map((stat) => (
              <div key={stat.key} className="text-center space-y-1">
                <div className="text-4xl font-bold tracking-tight text-primary-600">{t(`home.stats.${stat.key}.value`)}</div>
                <div className="text-sm font-medium text-slate-500">{t(`home.stats.${stat.key}.label`)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <div id="plans">
        <HomePricing />
      </div>

      {/* CTA */}
      <section className="py-28">
        <div className="max-w-3xl mx-auto px-6 text-center space-y-6">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">{t('home.cta.heading')}</h2>
          <p className="text-lg text-slate-600">{t('home.cta.subtitle')}</p>
          <div className="flex justify-center pt-2">
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-3 px-10 h-14 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold text-base shadow-sm transition-all active:scale-[0.98] group"
            >
              {t('home.cta.button')}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
            <div className="col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
                  <span className="text-white font-bold text-xs">{productName.charAt(0)}</span>
                </div>
                <span className="text-base font-bold tracking-tight">{productName}</span>
              </div>
              <p className="max-w-xs text-sm leading-relaxed text-slate-500">{t('home.footer.blurb')}</p>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-900">{t('home.footer.services')}</h4>
              <ul className="space-y-3">
                <li><Link href="#services" className="text-sm text-slate-500 hover:text-primary-600 transition-colors">{t('home.feature.supply.title')}</Link></li>
                <li><Link href="#services" className="text-sm text-slate-500 hover:text-primary-600 transition-colors">{t('home.feature.cloud.title')}</Link></li>
                <li><Link href="#plans" className="text-sm text-slate-500 hover:text-primary-600 transition-colors">{t('home.nav.solutions')}</Link></li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-900">{t('home.footer.legal')}</h4>
              <ul className="space-y-3">
                <li><Link href="/legal/privacy" className="text-sm text-slate-500 hover:text-primary-600 transition-colors">{t('home.footer.privacy')}</Link></li>
                <li><Link href="/legal/terms" className="text-sm text-slate-500 hover:text-primary-600 transition-colors">{t('home.footer.terms')}</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-14 pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} {productName}. {t('home.footer.rights')}
            </p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-slate-500">{t('home.footer.status')}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
