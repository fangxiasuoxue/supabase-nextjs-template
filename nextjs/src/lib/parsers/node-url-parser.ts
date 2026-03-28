// Node URL Parser
// Parses various proxy protocol URLs (vless, vmess, trojan, shadowsocks)

import type { Protocol, ParsedNode } from '@/types/nodes';

export class NodeUrlParser {
    /**
     * Parse a node URL and extract configuration
     */
    parse(url: string): ParsedNode {
        const protocol = url.split('://')[0] as Protocol;

        switch (protocol) {
            case 'vless':
                return this.parseVless(url);
            case 'vmess':
                return this.parseVmess(url);
            case 'trojan':
                return this.parseTrojan(url);
            case 'ss':
            case 'shadowsocks':
                return this.parseShadowsocks(url);
            case 'ssr':
                return this.parseSsr(url);
            default:
                throw new Error(`Unsupported protocol: ${protocol}`);
        }
    }

    /**
     * Parse vless URL
     * Format: vless://uuid@host:port?params#remark
     */
    private parseVless(url: string): ParsedNode {
        const match = url.match(/vless:\/\/([^@]+)@([^:]+):(\d+)\?([^#]+)#?(.*)/);
        if (!match) throw new Error('Invalid vless URL');

        const [, uuid, host, port, paramsStr, remark] = match;
        const params = new URLSearchParams(paramsStr);

        const extra_params: Record<string, any> = {};
        params.forEach((value, key) => {
            extra_params[key] = value;
        });

        return {
            protocol: 'vless',
            uuid,
            host,
            port: parseInt(port),
            remark: decodeURIComponent(remark || ''),
            extra_params,
            node_url: url,
        };
    }

    /**
     * Parse vmess URL
     * Format: vmess://base64encoded
     */
    private parseVmess(url: string): ParsedNode {
        const base64 = url.replace('vmess://', '');
        let decoded: any;

        try {
            decoded = JSON.parse(atob(base64));
        } catch (error) {
            throw new Error('Invalid vmess URL: failed to decode base64');
        }

        return {
            protocol: 'vmess',
            uuid: decoded.id,
            host: decoded.add,
            port: parseInt(decoded.port),
            remark: decoded.ps || '',
            extra_params: {
                aid: decoded.aid,
                net: decoded.net,
                type: decoded.type,
                host: decoded.host,
                path: decoded.path,
                tls: decoded.tls,
                sni: decoded.sni,
                alpn: decoded.alpn,
            },
            node_url: url,
        };
    }

    /**
     * Parse trojan URL
     * Format: trojan://password@host:port?params#remark
     */
    private parseTrojan(url: string): ParsedNode {
        const match = url.match(/trojan:\/\/([^@]+)@([^:]+):(\d+)(\?([^#]+))?#?(.*)/);
        if (!match) throw new Error('Invalid trojan URL');

        const [, password, host, port, , paramsStr, remark] = match;
        const params = paramsStr ? new URLSearchParams(paramsStr) : new URLSearchParams();

        const extra_params: Record<string, any> = {};
        params.forEach((value, key) => {
            extra_params[key] = value;
        });

        return {
            protocol: 'trojan',
            uuid: password,
            host,
            port: parseInt(port),
            remark: decodeURIComponent(remark || ''),
            extra_params,
            node_url: url,
        };
    }

    /**
     * Parse shadowsocks URL
     * Format: ss://base64(method:password)@host:port#remark
     */
    private parseShadowsocks(url: string): ParsedNode {
        // Remove ss:// prefix
        const withoutProtocol = url.replace(/^ss:\/\//, '');

        // Try to parse modern format: ss://base64@host:port#remark
        let match = withoutProtocol.match(/^([^@]+)@([^:]+):(\d+)#?(.*)/);

        if (match) {
            const [, base64Part, host, port, remark] = match;
            let method = '';
            let password = '';

            try {
                const decoded = atob(base64Part);
                [method, password] = decoded.split(':');
            } catch (error) {
                throw new Error('Invalid shadowsocks URL: failed to decode credentials');
            }

            return {
                protocol: 'shadowsocks',
                uuid: password,
                host,
                port: parseInt(port),
                remark: decodeURIComponent(remark || ''),
                extra_params: {
                    method,
                },
                node_url: url,
            };
        }

        throw new Error('Invalid shadowsocks URL format');
    }

    /**
     * Parse SSR URL
     * Format: ssr://base64encoded
     */
    private parseSsr(url: string): ParsedNode {
        const base64 = url.replace('ssr://', '');
        let decoded: string;

        try {
            decoded = atob(base64);
        } catch (error) {
            throw new Error('Invalid SSR URL: failed to decode base64');
        }

        // SSR format: host:port:protocol:method:obfs:base64pass/?params
        const match = decoded.match(/^([^:]+):(\d+):([^:]+):([^:]+):([^:]+):([^\/]+)\/?\??(.*)/);
        if (!match) throw new Error('Invalid SSR URL format');

        const [, host, port, protocol, method, obfs, base64pass, paramsStr] = match;
        const params = paramsStr ? new URLSearchParams(paramsStr) : new URLSearchParams();

        let password = '';
        try {
            password = atob(base64pass);
        } catch (error) {
            password = base64pass;
        }

        const extra_params: Record<string, any> = {
            protocol,
            method,
            obfs,
        };

        params.forEach((value, key) => {
            try {
                extra_params[key] = atob(value);
            } catch {
                extra_params[key] = value;
            }
        });

        return {
            protocol: 'ssr',
            uuid: password,
            host,
            port: parseInt(port),
            remark: extra_params.remarks || extra_params.remark || '',
            extra_params,
            node_url: url,
        };
    }

    /**
     * Batch parse multiple URLs
     */
    parseMultiple(urls: string[]): { parsed: ParsedNode[]; errors: string[] } {
        const parsed: ParsedNode[] = [];
        const errors: string[] = [];

        urls.forEach((url, index) => {
            try {
                const node = this.parse(url.trim());
                parsed.push(node);
            } catch (error) {
                errors.push(`URL ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });

        return { parsed, errors };
    }
}

// Export singleton instance
export const nodeUrlParser = new NodeUrlParser();
