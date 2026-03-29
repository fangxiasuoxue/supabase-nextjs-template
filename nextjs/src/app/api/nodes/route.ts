// @ts-nocheck
// API Route: GET /api/nodes
// List all nodes with pagination and filtering

import { createSSRClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import type { NodeListParams, PaginatedResponse, Node } from '@/types/nodes';

export async function GET(request: NextRequest) {
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

        // Parse query parameters
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const size = parseInt(searchParams.get('size') || '20');
        const vpsId = searchParams.get('vps_id');
        const protocol = searchParams.get('protocol');
        const status = searchParams.get('status');
        const search = searchParams.get('search');

        // Build query
        let query = supabase
            .from('nodes')
            .select('*, vps_configs(name)', { count: 'exact' })
            .is('deleted_at', null)
            .range((page - 1) * size, page * size - 1)
            .order('created_at', { ascending: false });

        // Apply filters
        if (vpsId) {
            query = query.eq('vps_id', vpsId);
        }
        if (protocol) {
            query = query.eq('protocol', protocol);
        }
        if (status) {
            query = query.eq('status', status);
        }
        if (search) {
            query = query.or(`name.ilike.%${search}%,remark.ilike.%${search}%`);
        }

        const { data, error, count } = await query;

        if (error) {
            console.error('Error fetching nodes:', error);
            return NextResponse.json(
                { error: 'Failed to fetch nodes' },
                { status: 500 }
            );
        }

        const response: PaginatedResponse<Node> = {
            data: data || [],
            total: count || 0,
            page,
            size,
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

// API Route: POST /api/nodes
// Create a new node

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

        const body = await request.json();

        // Validate required fields
        if (!body.name || !body.protocol || !body.host || !body.port) {
            return NextResponse.json(
                { error: 'Missing required fields: name, protocol, host, port' },
                { status: 400 }
            );
        }

        // Insert node
        const { data, error } = await supabase
            .from('nodes')
            .insert({
                ...body,
                created_by: user.id,
                is_manual: true, // Mark as manually created
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating node:', error);
            return NextResponse.json(
                { error: 'Failed to create node' },
                { status: 500 }
            );
        }

        return NextResponse.json(data, { status: 201 });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
