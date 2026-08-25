"use client";

import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/context/LanguageContext';

interface LegalDocumentProps {
    fileName: string;
    title: string;
}

const LegalDocument: React.FC<LegalDocumentProps> = ({ fileName, title }) => {
    const { language, t } = useLanguage();
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);

        const localizedPath = `/terms/${language}/${fileName}`;
        const fallbackPath = `/terms/${fileName}`;

        const loadFrom = (path: string) =>
            fetch(path).then(response => {
                if (!response.ok) {
                    throw new Error('Failed to load document');
                }
                return response.text();
            });

        // Prefer the language-specific document; fall back to the flat file if missing.
        loadFrom(localizedPath)
            .catch(() => loadFrom(fallbackPath))
            .then(text => {
                setContent(text);
                setLoading(false);
            })
            .catch(error => {
                console.error('Error loading markdown:', error);
                setError(t('legal.loadError'));
                setLoading(false);
            });
    }, [fileName, language, t]);

    return (
        <Card className="w-full max-w-4xl mx-auto my-8">
            <CardHeader>
                <h1 className="text-2xl font-bold text-center">{title}</h1>
            </CardHeader>
            <CardContent className="prose prose-blue max-w-none min-h-[200px]">
                {loading ? (
                    <div className="flex items-center justify-center h-[200px]">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                ) : error ? (
                    <div className="text-center text-red-600 py-8">
                        {error}
                    </div>
                ) : (
                    <ReactMarkdown
                        components={{
                            h1: ({ children }) => <h1 className="text-2xl font-bold mt-8 mb-4">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-xl font-semibold mt-6 mb-3">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-lg font-medium mt-4 mb-2">{children}</h3>,
                            ul: ({ children }) => <ul className="list-disc pl-6 mb-4">{children}</ul>,
                            li: ({ children }) => <li className="mb-1">{children}</li>,
                            p: ({ children }) => <p className="mb-4">{children}</p>,
                        }}
                    >
                        {content}
                    </ReactMarkdown>
                )}
            </CardContent>
        </Card>
    );
};

export default LegalDocument;