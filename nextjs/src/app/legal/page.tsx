
'use client';

import React from 'react';
import { useLanguage } from '@/lib/context/LanguageContext';


export default function LegalPage() {
    const { t } = useLanguage();


    return (
        <div className="container mx-auto px-4 py-8">
            {t('legal.selectPrompt')}
        </div>
    );
}