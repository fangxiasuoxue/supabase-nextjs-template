'use client';

import React from 'react';
import LegalDocument from '@/components/LegalDocument';
import { notFound } from 'next/navigation';
import { useLanguage } from '@/lib/context/LanguageContext';

const legalDocuments = {
    'privacy': {
        titleKey: 'legal.doc.privacy',
        fileName: 'privacy-notice.md'
    },
    'terms': {
        titleKey: 'legal.doc.terms',
        fileName: 'terms-of-service.md'
    },
    'refund': {
        titleKey: 'legal.doc.refund',
        fileName: 'refund-policy.md'
    }
} as const;

type LegalDocument = keyof typeof legalDocuments;

interface LegalPageProps {
    document: LegalDocument;
    lng: string;
}

interface LegalPageParams {
    params: Promise<LegalPageProps>
}

export default function LegalPage({ params }: LegalPageParams) {
    const {document} = React.use<LegalPageProps>(params);
    const { t } = useLanguage();

    if (!legalDocuments[document]) {
        notFound();
    }

    const { titleKey, fileName } = legalDocuments[document];

    return (
        <div className="container mx-auto px-4 py-8">
            <LegalDocument
                title={t(titleKey)}
                fileName={fileName}
            />
        </div>
    );
}