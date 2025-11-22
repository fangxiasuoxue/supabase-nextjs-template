import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/types";

export enum ClientType {
    SERVER = 'server',
    SPA = 'spa'

}

export class SassClient {
    private client: SupabaseClient<Database, "public", "public">;
    private clientType: ClientType;

    constructor(client: SupabaseClient<Database, "public", "public">, clientType: ClientType) {
        this.client = client;
        this.clientType = clientType;

    }

    async loginEmail(email: string, password: string) {
        return this.client.auth.signInWithPassword({
            email: email,
            password: password
        });
    }

    async registerEmail(email: string, password: string) {
        return this.client.auth.signUp({
            email: email,
            password: password
        });
    }

    async exchangeCodeForSession(code: string) {
        return this.client.auth.exchangeCodeForSession(code);
    }

    async resendVerificationEmail(email: string) {
        return this.client.auth.resend({
            email: email,
            type: 'signup'
        })
    }

    async logout() {
        const { error } = await this.client.auth.signOut({
            scope: 'local',
        });
        if (error) throw error;
        if (this.clientType === ClientType.SPA) {
            window.location.href = '/auth/login';
        }
    }

    async uploadFile(myId: string, filename: string, file: File) {
        filename = filename.replace(/[^0-9a-zA-Z!\-_.*'()]/g, '_');
        filename = myId + "/" + filename
        return this.client.storage.from('files').upload(filename, file);
    }

    async getFiles(myId: string) {
        return this.client.storage.from('files').list(myId)
    }

    async deleteFile(myId: string, filename: string) {
        filename = myId + "/" + filename
        return this.client.storage.from('files').remove([filename])
    }

    async shareFile(myId: string, filename: string, timeInSec: number, forDownload: boolean = false) {
        filename = myId + "/" + filename
        return this.client.storage.from('files').createSignedUrl(filename, timeInSec, {
            download: forDownload
        });

    }

    async getMyTodoList(page: number = 1, pageSize: number = 100, order: string = 'created_at', done: boolean | null = false) {
        let query = this.client.from('todo_list').select('*').range(page * pageSize - pageSize, page * pageSize - 1).order(order)
        if (done !== null) {
            query = query.eq('done', done)
        }
        return query
    }

    async createTask(row: Database["public"]["Tables"]["todo_list"]["Insert"]) {
        return this.client.from('todo_list').insert(row)
    }

    async removeTask(id: number) {
        return this.client.from('todo_list').delete().eq('id', id)
    }

    async updateAsDone(id: number) {
        return this.client.from('todo_list').update({ done: true }).eq('id', id)
    }

    getSupabaseClient() {
        return this.client;
    }

    async hasModulePermission(module: 'vps' | 'ip' | 'nodes' | 'orders', perm: 'read' | 'write' | 'manage') {
        const { data: userRes } = await this.client.auth.getUser()
        const uid = userRes.user?.id
        if (!uid) return { allowed: false }

        const { data: role } = await this.client
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .from('user_roles' as any)
            .select('role')
            .eq('user_id', uid)
            .limit(1)
            .maybeSingle()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((role as any)?.role === 'admin') return { allowed: true }

        const { data } = await this.client
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .from('module_permissions' as any)
            .select('can_read, can_write, can_manage')
            .eq('user_id', uid)
            .eq('module', module)
            .limit(1)
            .maybeSingle()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allowed = !!(data as any) && (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (perm === 'read' && !!(data as any).can_read) ||
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (perm === 'write' && !!(data as any).can_write) ||
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (perm === 'manage' && !!(data as any).can_manage)
        )
        return { allowed }
    }

    async listIpAssets(filters?: { provider?: string; remark?: string; status?: string }) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q = this.client.from('ip_assets' as any).select('*').order('created_at', { ascending: false })
        if (filters?.provider) q = q.eq('provider', filters.provider)
        if (filters?.remark) q = q.ilike('remark', `%${filters.remark}%`)
        if (filters?.status) q = q.eq('status', filters.status)
        return q
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async createIpAsset(row: { provider: string; ip: string; remark?: string | null; asn?: string | null; type?: 'residential' | 'datacenter' | null; status?: string | null; expires_at?: string | null; metadata?: any }) {
        const { data: userRes } = await this.client.auth.getUser()
        const uid = userRes.user?.id
        if (!uid) return { error: { message: 'Not logged in' } }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return this.client.from('ip_assets' as any).insert({
            provider: row.provider,
            ip: row.ip,
            remark: row.remark ?? null,
            asn: row.asn ?? null,
            type: row.type ?? null,
            status: row.status ?? null,
            expires_at: row.expires_at ?? null,
            metadata: row.metadata ?? {},
            owner: uid,
        })
    }

    async allocateIp(ip_id: number, assigned_to: string, notes?: string) {
        const { data: userRes } = await this.client.auth.getUser()
        const uid = userRes.user?.id
        if (!uid) return { error: { message: 'Not logged in' } }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return this.client.from('ip_allocations' as any).insert({
            ip_id,
            assigned_to,
            state: 'allocated',
            allocated_at: new Date().toISOString(),
            notes: notes ?? null,
            owner: uid,
        })
    }

    async releaseIp(allocation_id: number) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return this.client.from('ip_allocations' as any).update({
            state: 'released',
            released_at: new Date().toISOString(),
        }).eq('id', allocation_id)
    }

}
