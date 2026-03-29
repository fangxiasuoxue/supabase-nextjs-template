// API Route: POST /api/nodes/parse-url
// Parse node URLs and return structured data

import { NextRequest, NextResponse } from 'next/server';
import { nodeUrlParser } from '@/lib/parsers/node-url-parser';
import type { ParseUrlRequest, ParseUrlResponse } from '@/types/nodes';
import { createSSRClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
    try {
        const supabase = await createSSRClient();

        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body: ParseUrlRequest = await request.json();

        if (!body.urls || !Array.isArray(body.urls) || body.urls.length === 0) {
            return NextResponse.json(
                { error: 'urls array is required and must not be empty' },
                { status: 400 }
            );
        }

        // Parse URLs
        const { parsed, errors } = nodeUrlParser.parseMultiple(body.urls);

        const response: ParseUrlResponse = {
            parsed,
            errors,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
