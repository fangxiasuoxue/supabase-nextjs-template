import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * 验证 Proxy-Cheap webhook 签名
 * 
 * 签名算法: HMAC SHA256
 * 输入: algo + eventName + eventId + body + secret
 * 格式: sha256=hash
 */
function verifyWebhookSignature(
    eventName: string,
    eventId: string,
    body: string,
    signature: string,
    secret: string
): boolean {
    try {
        // 签名格式: sha256=hash
        const [algo, hash] = signature.split('=');

        if (algo !== 'sha256') {
            console.error('Unsupported signature algorithm:', algo);
            return false;
        }

        // 计算期望的签名
        // 根据 proxy-cheap 文档: algo + eventName + eventId + body + secret
        const input = algo + eventName + eventId + body + secret;
        const expectedHash = crypto
            .createHmac('sha256', secret)
            .update(input)
            .digest('hex');

        // 使用时间安全比较防止时序攻击
        return crypto.timingSafeEqual(
            Buffer.from(hash),
            Buffer.from(expectedHash)
        );
    } catch (error) {
        console.error('Signature verification error:', error);
        return false;
    }
}

/**
 * POST /api/outservice/cheapwebhook
 * 
 * 接收来自 Proxy-Cheap 的 webhook 通知
 * 
 * Headers:
 * - Webhook-Event: 事件名称
 * - Webhook-Id: 事件ID
 * - Webhook-Signature: 签名 (格式: sha256=hash)
 * - Content-Type: application/json
 */
export async function POST(request: NextRequest) {
    try {
        // 提取请求头
        const eventName = request.headers.get('Webhook-Event');
        const eventId = request.headers.get('Webhook-Id');
        const signature = request.headers.get('Webhook-Signature');

        // 验证必需的请求头
        if (!eventName || !eventId || !signature) {
            console.error('Missing required headers:', { eventName, eventId, signature });
            return NextResponse.json(
                { error: 'Missing required headers' },
                { status: 400 }
            );
        }

        // 读取请求体
        const body = await request.text();

        // 从系统配置中获取 webhook secret
        const adminClient = await createServerAdminClient();
        const { data: configData, error: configError } = await adminClient
            .from('system_configs' as any)
            .select('value')
            .eq('key', 'message.cheap.webhook.secret')
            .single();

        if (configError || !(configData as any)?.value) {
            console.error('Failed to get webhook secret:', configError);
            return NextResponse.json(
                { error: 'Webhook secret not configured' },
                { status: 500 }
            );
        }

        const secret = (configData as any).value;

        // 验证签名
        const isValid = verifyWebhookSignature(
            eventName,
            eventId,
            body,
            signature,
            secret
        );

        if (!isValid) {
            console.error('Invalid webhook signature');
            return NextResponse.json(
                { error: 'Invalid signature' },
                { status: 401 }
            );
        }

        // 解析请求体
        let payload: any;
        try {
            payload = JSON.parse(body);
        } catch (error) {
            console.error('Invalid JSON payload:', error);
            return NextResponse.json(
                { error: 'Invalid JSON payload' },
                { status: 400 }
            );
        }

        // 检查事件ID是否已存在(幂等性)
        const { data: existingMessage } = await adminClient
            .from('external_messages' as any)
            .select('id')
            .eq('event_id', eventId)
            .single();

        if (existingMessage) {
            console.log('Event already processed:', eventId);
            return NextResponse.json({
                success: true,
                received: true,
                message: 'Event already processed'
            });
        }

        // 保存消息到数据库
        const { error: insertError } = await (adminClient
            .from('external_messages' as any) as any)
            .insert({
                source: 'proxy-cheap',
                event_type: eventName,
                event_id: eventId,
                payload: payload,
                is_read: false,
                received_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

        if (insertError) {
            console.error('Failed to save message:', insertError);
            return NextResponse.json(
                { error: 'Failed to save message' },
                { status: 500 }
            );
        }

        console.log('Webhook received successfully:', {
            eventName,
            eventId,
            source: 'proxy-cheap'
        });

        return NextResponse.json({
            success: true,
            received: true
        });

    } catch (error: any) {
        console.error('Webhook processing error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/outservice/cheapwebhook
 * 
 * 健康检查端点
 */
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        message: 'Webhook endpoint is active',
        timestamp: new Date().toISOString()
    });
}
