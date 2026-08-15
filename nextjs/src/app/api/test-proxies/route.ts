// @ts-nocheck
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { SocksClient } from 'socks';
import https from 'https';
import { Database } from '@/lib/types';
import { createSSRClient } from '@/lib/supabase/server';

// W1 鉴权门:此前本路由完全无鉴权(P0),任何人可用 service-role 读明文 IP 密码/改状态。
// 登录 + admin/ops 角色校验;未过则拦截,过了才走下方 service-role 逻辑。
async function requireAdminOps(): Promise<NextResponse | null> {
    const authClient = await createSSRClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (!user || authError) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { data: roleData } = await authClient
        .from('user_roles').select('role').eq('user_id', user.id).single();
    if (!roleData || !['admin', 'ops'].includes((roleData as any).role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return null;
}

// Create a Supabase client with the service role key for admin access
// We need admin access to update any proxy status
const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.PRIVATE_SUPABASE_SERVICE_KEY!
);

interface ProxyConfig {
    id: number;
    host: string;
    port: number;
    username?: string | null;
    password?: string | null;
    type?: string | null;
}

interface TestResult {
    proxy_id: number;
    host: string;
    port: number;
    is_reachable: boolean;
    latency_ms: number | null;
    download_speed_kbps: number | null;
    ip_address: string | null;
    error_message: string | null;
    tested_at: string;
}

// ==== TESTABLE-BEGIN ====
// Pure, dependency-free units extracted for TDD.
// Mirror-tested by ops/testing/ip/test_proxies.test.js, which reads THIS block
// verbatim from source and evals it (route.ts itself can't be imported under
// `node --test` because it pulls in Next.js / Supabase / `@/` aliases).
// Written in plain JS (no TS annotations) so the extracted block is directly
// evaluable; the file is `// @ts-nocheck`.

// Bug #3: throughput must be measured over the DOWNLOAD window only
// (first byte received -> stream end), NOT from connection start. Including the
// SOCKS handshake + TLS build-connection time in the window massively
// under-reports the speed. latency (build-connection time) is reported separately.
function computeSpeedFromTimeline(timeline) {
    // timeline: { connectStartMs, firstByteMs, endMs, downloadedBytes }
    const windowMs = timeline.endMs - timeline.firstByteMs;
    if (!(windowMs > 0)) return 0;
    const speedKbps = (timeline.downloadedBytes * 8) / ((windowMs / 1000) * 1024);
    return Math.round(speedKbps);
}

// Bug #5: proxies that are only reachable over HTTP/HTTPS cannot be tested via
// SOCKS5. They must NOT be silently dropped — emit an explicit "unsupported"
// result so the caller/UI gets clear feedback instead of assuming success.
function isSocks5Testable(proxy) {
    return !!(proxy.socks5_port || proxy.proxy_type === 'socks5');
}

function buildUnsupportedResult(proxy) {
    return {
        proxy_id: proxy.id,
        host: proxy.ip,
        port: proxy.http_port || proxy.https_port || 0,
        is_reachable: false,
        latency_ms: null,
        download_speed_kbps: null,
        ip_address: null,
        error_message: 'Unsupported proxy type: only SOCKS5 testing is supported (HTTP/HTTPS proxy skipped)',
        tested_at: new Date().toISOString()
    };
}

function partitionProxies(proxies) {
    const testable = [];
    const skipped = [];
    for (const p of proxies) {
        if (isSocks5Testable(p)) testable.push(p);
        else skipped.push(buildUnsupportedResult(p));
    }
    return { testable, skipped };
}
// ==== TESTABLE-END ====

async function testSocks5Proxy(proxy: ProxyConfig): Promise<TestResult> {
    const startTime = Date.now();
    const result: TestResult = {
        proxy_id: proxy.id,
        host: proxy.host,
        port: proxy.port,
        is_reachable: false,
        latency_ms: null,
        download_speed_kbps: null,
        ip_address: null,
        error_message: null,
        tested_at: new Date().toISOString()
    };

    try {
        // Test 1: Connectivity Test - Get IP
        const connectStart = Date.now();
        const ipResponse = await testProxyConnection(proxy);
        const connectTime = Date.now() - connectStart;

        result.is_reachable = true;
        result.latency_ms = connectTime;
        result.ip_address = ipResponse.ip;

        // Test 2: Download Speed Test
        try {
            const speed = await testDownloadSpeed(proxy);
            result.download_speed_kbps = speed;
        } catch (speedError) {
            console.log('Speed test failed, but proxy is reachable:', speedError);
        }

    } catch (error: any) {
        result.is_reachable = false;
        result.error_message = error.message || 'Connection failed';
    }

    // If reachable but latency not set (should be set above), fallback to total time
    if (result.is_reachable && result.latency_ms === null) {
        result.latency_ms = Date.now() - startTime;
    }

    return result;
}

async function testProxyConnection(proxy: ProxyConfig): Promise<{ ip: string }> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Connection timeout'));
        }, 30000);

        const options: any = {
            proxy: {
                host: proxy.host,
                port: proxy.port,
                type: 5,
                userId: proxy.username || undefined,
                password: proxy.password || undefined
            },
            command: 'connect',
            destination: {
                host: 'ipv4.icanhazip.com',
                port: 443
            }
        };

        SocksClient.createConnection(options)
            .then((info) => {
                clearTimeout(timeout);

                const reqOptions = {
                    socket: info.socket,
                    host: 'ipv4.icanhazip.com',
                    port: 443,
                    path: '/',
                    method: 'GET',
                    headers: {
                        'User-Agent': 'ProxyTester/1.0'
                    }
                };

                const req = https.request(reqOptions, (res) => {
                    let data = '';
                    res.on('data', (chunk) => { data += chunk; });
                    res.on('end', () => {
                        resolve({ ip: data.trim() });
                    });
                });

                req.on('error', (err) => {
                    reject(err);
                });

                req.end();
            })
            .catch((err) => {
                clearTimeout(timeout);
                reject(err);
            });
    });
}

async function testDownloadSpeed(proxy: ProxyConfig): Promise<number> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Speed test timeout'));
        }, 30000);

        // Download a small file for testing (100KB)
        // Using a reliable speed test file
        const testHost = 'proof.ovh.net';
        const testPath = '/files/100Kb.dat';

        // Bug #3: capture the moment the connection is initiated (latency window)
        // separately from the download window. Throughput is computed ONLY over
        // firstByte -> end, so SOCKS handshake + TLS setup no longer drag it down.
        const connectStartMs = Date.now();
        let firstByteMs: number | null = null;
        let downloadedBytes = 0;

        const options: any = {
            proxy: {
                host: proxy.host,
                port: proxy.port,
                type: 5,
                userId: proxy.username || undefined,
                password: proxy.password || undefined
            },
            command: 'connect',
            destination: {
                host: testHost,
                port: 443
            }
        };

        SocksClient.createConnection(options)
            .then((info) => {
                clearTimeout(timeout);

                const reqOptions = {
                    socket: info.socket,
                    host: testHost,
                    port: 443,
                    path: testPath,
                    method: 'GET',
                    headers: {
                        'User-Agent': 'ProxyTester/1.0'
                    }
                };

                const req = https.request(reqOptions, (res) => {
                    res.on('data', (chunk) => {
                        if (firstByteMs === null) firstByteMs = Date.now();
                        downloadedBytes += chunk.length;
                    });

                    res.on('end', () => {
                        const endMs = Date.now();
                        // Throughput over the download window only (Bug #3 fix).
                        const speedKbps = computeSpeedFromTimeline({
                            connectStartMs,
                            firstByteMs: firstByteMs === null ? endMs : firstByteMs,
                            endMs,
                            downloadedBytes
                        });
                        resolve(speedKbps);
                    });
                });

                req.on('error', (err) => {
                    reject(err);
                });

                req.setTimeout(20000, () => {
                    req.destroy();
                    reject(new Error('Download timeout'));
                });

                req.end();
            })
            .catch((err) => {
                clearTimeout(timeout);
                reject(err);
            });
    });
}

export async function POST(request: NextRequest) {
    try {
        const denied = await requireAdminOps();
        if (denied) return denied;

        const body = await request.json();
        const { proxy_ids, batch_size = 5 } = body;

        if (!proxy_ids || !Array.isArray(proxy_ids) || proxy_ids.length === 0) {
            return NextResponse.json(
                { error: 'proxy_ids array is required' },
                { status: 400 }
            );
        }

        // Fetch proxies from database
        const { data: proxies, error: fetchError } = await supabase
            .from('ip_assets')
            .select('*')
            .in('id', proxy_ids)
            .is('deleted_at', null);

        if (fetchError) {
            throw fetchError;
        }

        if (!proxies || proxies.length === 0) {
            return NextResponse.json(
                { error: 'No active proxies found' },
                { status: 404 }
            );
        }

        // Partition into SOCKS5-testable proxies and everything else.
        // Bug #5: HTTP/HTTPS-only proxies are NOT silently dropped — they get an
        // explicit "unsupported" result entry so the caller gets clear feedback.
        const { testable: testableProxies, skipped: skippedResults } = partitionProxies(proxies);

        if (testableProxies.length === 0 && skippedResults.length === 0) {
            return NextResponse.json(
                { error: 'No testable SOCKS5 proxies found in selection' },
                { status: 400 }
            );
        }

        // Batch testing
        const results: TestResult[] = [...skippedResults];
        for (let i = 0; i < testableProxies.length; i += batch_size) {
            const batch = testableProxies.slice(i, i + batch_size);
            const batchResults = await Promise.all(
                batch.map(proxy => {
                    // Determine port and type
                    let port = proxy.socks5_port;
                    if (!port && proxy.proxy_type === 'socks5' && proxy.http_port) {
                        // Fallback or misconfiguration? 
                        // If proxy_type is socks5 but no socks5_port, maybe check other ports?
                        // For now strict check on socks5_port or type
                    }

                    // If no explicit socks5 port, try to use the one available if type matches
                    if (!port && proxy.proxy_type === 'socks5') {
                        // Assuming the main port is the one
                        // But schema has specific columns. 
                        // Let's use socks5_port if available.
                    }

                    if (!port) {
                        // Skip if no port found
                        return Promise.resolve({
                            proxy_id: proxy.id,
                            host: proxy.ip,
                            port: 0,
                            is_reachable: false,
                            latency_ms: null,
                            download_speed_kbps: null,
                            ip_address: null,
                            error_message: 'No SOCKS5 port configured',
                            tested_at: new Date().toISOString()
                        });
                    }

                    return testSocks5Proxy({
                        id: proxy.id,
                        host: proxy.ip,
                        port: port,
                        username: proxy.auth_username,
                        password: proxy.auth_password,
                        type: '5'
                    });
                })
            );
            results.push(...batchResults);
        }

        // Note: proxy_test_results table not available, skipping result storage
        // In a real implementation, you would save results to a dedicated table

        // Update proxy status with test results (latency and speed)
        for (const result of results) {
            if (result.error_message === 'No SOCKS5 port configured') continue;
            // Bug #5: don't overwrite status for HTTP/HTTPS proxies we couldn't test.
            if (result.error_message && result.error_message.startsWith('Unsupported proxy type')) continue;

            const updateData: Database['public']['Tables']['ip_assets']['Update'] = {
                status: result.is_reachable ? 'active' : 'unreachable',
                last_tested_at: result.tested_at
            };

            if (result.is_reachable) {
                updateData.last_latency_ms = result.latency_ms;
                updateData.last_speed_kbps = result.download_speed_kbps;
            }

            try {
                await supabase
                    .from('ip_assets')
                    .update(updateData)
                    .eq('id', result.proxy_id);
            } catch (e: any) {
                console.error('Failed to update proxy status:', e.message);
            }
        }

        return NextResponse.json({
            success: true,
            total_tested: results.length,
            reachable: results.filter(r => r.is_reachable).length,
            unreachable: results.filter(r => !r.is_reachable).length,
            results: results
        });

    } catch (error: any) {
        console.error('Proxy test error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET method to test all active proxies
export async function GET(request: NextRequest) {
    try {
        const denied = await requireAdminOps();
        if (denied) return denied;

        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50');

        // Fetch active proxies
        const { data: proxies, error } = await supabase
            .from('ip_assets')
            .select('*')
            .is('deleted_at', null)
            // .eq('status', 'active') // Optional: only test active ones? Or all?
            // Requirement says "Test All", usually implies all in the list.
            .limit(limit);

        if (error) throw error;

        if (!proxies || proxies.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No proxies to test',
                results: []
            });
        }

        // Reuse logic by calling internal function or just repeating loop
        // For simplicity, we'll just return the IDs and let the client call POST if they want batch control,
        // OR we just execute it here.
        // Let's execute here.

        // Bug #5: partition instead of silently dropping HTTP/HTTPS-only proxies.
        const { testable: testableProxies, skipped: skippedResults } = partitionProxies(proxies);
        const results: TestResult[] = [...skippedResults];

        // Process in chunks of 5
        const batch_size = 5;
        for (let i = 0; i < testableProxies.length; i += batch_size) {
            const batch = testableProxies.slice(i, i + batch_size);
            const batchResults = await Promise.all(
                batch.map(proxy => {
                    const port = proxy.socks5_port;
                    if (!port) return Promise.resolve({
                        proxy_id: proxy.id,
                        host: proxy.ip,
                        port: 0,
                        is_reachable: false,
                        latency_ms: null,
                        download_speed_kbps: null,
                        ip_address: null,
                        error_message: 'No SOCKS5 port',
                        tested_at: new Date().toISOString()
                    });

                    return testSocks5Proxy({
                        id: proxy.id,
                        host: proxy.ip,
                        port: port,
                        username: proxy.auth_username,
                        password: proxy.auth_password,
                        type: '5'
                    });
                })
            );
            results.push(...batchResults);
        }

        // Save and Update (with error handling)
        if (results.length > 0) {
            // Note: proxy_test_results table not available, skipping result storage
            // In a real implementation, you would save results to a dedicated table

            for (const result of results) {
                if (result.error_message === 'No SOCKS5 port') continue;
                // Bug #5: don't overwrite status for untestable HTTP/HTTPS proxies.
                if (result.error_message && result.error_message.startsWith('Unsupported proxy type')) continue;

                const updateData: Database['public']['Tables']['ip_assets']['Update'] = {
                    status: result.is_reachable ? 'active' : 'unreachable',
                    last_tested_at: result.tested_at
                };

                if (result.is_reachable) {
                    updateData.last_latency_ms = result.latency_ms;
                    updateData.last_speed_kbps = result.download_speed_kbps;
                }

                try {
                    await supabase.from('ip_assets').update(updateData).eq('id', result.proxy_id);
                } catch (e: any) {
                    console.error('Failed to update proxy:', e.message);
                }
            }
        }

        return NextResponse.json({
            success: true,
            total_tested: results.length,
            reachable: results.filter(r => r.is_reachable).length,
            unreachable: results.filter(r => !r.is_reachable).length,
            results: results
        });

    } catch (error: any) {
        console.error('Proxy test error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
