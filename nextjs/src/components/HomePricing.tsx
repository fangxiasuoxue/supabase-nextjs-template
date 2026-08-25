"use client";
import React from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { useLanguage } from '@/lib/context/LanguageContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

const HomePricing = () => {
    const { t } = useLanguage();

    const packages = [
        { key: 'starter', features: ['f1', 'f2', 'f3'], popular: false },
        { key: 'growth', features: ['f1', 'f2', 'f3', 'f4'], popular: true },
        { key: 'tech', features: ['f1', 'f2', 'f3', 'f4'], popular: false },
    ];

    return (
        <section className="py-24 bg-slate-50 border-y border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-14 space-y-3">
                    <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t('plans.heading')}</h2>
                    <p className="text-slate-600 text-lg max-w-2xl mx-auto">{t('plans.subtitle')}</p>
                </div>

                <div className="grid md:grid-cols-3 gap-8 mb-10">
                    {packages.map((pkg) => (
                        <Card
                            key={pkg.key}
                            className={`relative flex flex-col ${pkg.popular ? 'border-primary-500 shadow-lg' : 'border-slate-200'}`}
                        >
                            {pkg.popular && (
                                <div className="absolute top-0 right-6 -translate-y-1/2 px-3 py-1 bg-primary-600 text-white text-xs font-semibold rounded-full">
                                    {t('plans.popular')}
                                </div>
                            )}

                            <CardHeader>
                                <CardTitle>{t(`plans.${pkg.key}.name`)}</CardTitle>
                                <CardDescription>{t(`plans.${pkg.key}.desc`)}</CardDescription>
                            </CardHeader>

                            <CardContent className="flex-grow flex flex-col">
                                <ul className="space-y-3 mb-8 flex-grow">
                                    {pkg.features.map((f) => (
                                        <li key={f} className="flex items-center gap-2">
                                            <Check className="h-5 w-5 text-emerald-500 shrink-0" />
                                            <span className="text-slate-600">{t(`plans.${pkg.key}.${f}`)}</span>
                                        </li>
                                    ))}
                                </ul>

                                <Link
                                    href="/auth/register"
                                    className={`w-full text-center px-6 py-3 rounded-lg font-medium transition-colors ${
                                        pkg.popular
                                            ? 'bg-primary-600 text-white hover:bg-primary-700'
                                            : 'bg-white border border-slate-300 text-slate-900 hover:bg-slate-50'
                                    }`}
                                >
                                    {t('plans.cta')}
                                </Link>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="text-center">
                    <p className="text-slate-500 text-sm">{t('plans.include')}</p>
                </div>
            </div>
        </section>
    );
};

export default HomePricing;
