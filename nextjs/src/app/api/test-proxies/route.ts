import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { SocksClient } from 'socks';
import https from 'https';
import { Database } from '@/lib/types';

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

        const startTime = Date.now();
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
                        downloadedBytes += chunk.length;
                    });

                    res.on('end', () => {
                        const duration = (Date.now() - startTime) / 1000; // seconds
                        if (duration <= 0) {
                            resolve(0);
                            return;
                        }
                        const speedKbps = (downloadedBytes * 8) / (duration * 1024); // Kbps
                        resolve(Math.round(speedKbps));
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

        // Filter for SOCKS5 proxies or those with SOCKS5 ports
        // Currently only implementing SOCKS5 testing as per requirement example
        // But we can extend to HTTP/HTTPS if needed. The example code used SocksClient which is for SOCKS.
        // We will assume if it has socks5_port it is testable via SOCKS5.
        const testableProxies = proxies.filter(p => p.socks5_port || p.proxy_type === 'socks5');

        if (testableProxies.length === 0) {
            return NextResponse.json(
                { error: 'No testable SOCKS5 proxies found in selection' },
                { status: 400 }
            );
        }

        // Batch testing
        const results: TestResult[] = [];
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

        // Save results to database
        // We need to cast to any because proxy_test_results might not be in the generated types yet
        const { error: insertError } = await supabase
            .from('proxy_test_results' as any)
            .insert(results);

        if (insertError) {
            console.error('Failed to save test results:', insertError);
        }

        // Update proxy status
        for (const result of results) {
            if (result.error_message === 'No SOCKS5 port configured') continue;

            if (!result.is_reachable) {
                await supabase
                    .from('ip_assets')
                    .update({
                        status: 'unreachable',
                        last_tested_at: result.tested_at
                    } as any)
                    .eq('id', result.proxy_id);
            } else {
                await supabase
                    .from('ip_assets')
                    .update({
                        status: 'active',
                        last_ip: result.ip_address,
                        last_latency_ms: result.latency_ms,
                        last_speed_kbps: result.download_speed_kbps,
                        last_tested_at: result.tested_at
                    } as any)
                    .eq('id', result.proxy_id);
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

        const testableProxies = proxies.filter(p => p.socks5_port || p.proxy_type === 'socks5');
        const results: TestResult[] = [];

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

        // Save and Update
        if (results.length > 0) {
            await supabase.from('proxy_test_results' as any).insert(results);

            for (const result of results) {
                if (result.error_message === 'No SOCKS5 port') continue;

                const updateData: any = {
                    last_tested_at: result.tested_at
                };

                if (result.is_reachable) {
                    updateData.status = 'active';
                    updateData.last_ip = result.ip_address;
                    updateData.last_latency_ms = result.latency_ms;
                    updateData.last_speed_kbps = result.download_speed_kbps;
                } else {
                    updateData.status = 'unreachable';
                }

                await supabase.from('ip_assets').update(updateData).eq('id', result.proxy_id);
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
