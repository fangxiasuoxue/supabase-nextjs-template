// 域名管理 (Domain Management) Type Definitions — SDD 54 §5/§8 (read-only P1)
// 结构 SSOT(注册商/属主/注册人邮箱)在 assets.yaml domains.portfolio(尚未入库);
// 本模块只读 console DB 两表:domain_state(运行态) + dns_record(关键解析记录)。

// 域名运行态镜像(采集/对账写) —— 对应表 domain_state
export interface DomainState {
    domain: string;
    observed_ns: string[] | null;
    nxdomain: boolean;
    expires_at: string | null;        // date
    days_to_expiry: number | null;
    registrant_verified: boolean | null;
    last_checked: string | null;      // timestamptz
    note: string | null;
    updated_at: string;
}

// 关键解析记录(期望态 + 实测镜像) —— 对应表 dns_record
export interface DnsRecord {
    id: string;
    domain: string;
    type: string;                     // A/AAAA/CNAME/MX/TXT/NS/SRV/CAA/...
    name: string;                     // @ 表示根
    value: string;
    ttl: number | null;
    priority: number | null;
    proxied: boolean | null;          // CF 橙云代理
    is_key: boolean;
    desired: boolean;
    observed_value: string | null;
    observed_at: string | null;
    managed_by: string | null;        // console / manual / 52-publish / cf-ddns
    created_at: string;
    updated_at: string;
}

// 备案信息(Notion 录入 SSOT 的 console 只读镜像)—— 对应表 domain_beian(SDD 54 §8 D5)
export interface DomainBeian {
    domain: string;
    site_name: string | null;   // 网站名称
    icp_no: string | null;      // 网站备案号(粤ICP备…号-N)
    subject: string | null;     // 备案主体名
    updated_at: string;
}

// 分域 RBAC 授权行(mirror docs/current/53 access_grants)—— 对应表 domain_grants(SDD 54 P4)
export interface DomainGrant {
    domain: string;             // 资源键
    user_id?: string;
}

// 域名风险等级(用于总览徽标 + 排序)——依据 SDD 54 §8
export type DomainRisk = 'nxdomain' | 'expiring' | 'normal';

export const EXPIRE_WARN_DAYS = 30; // 到期临近阈值(与 expiry_audit EXPIRE_WARN_DAYS 对齐,doc 49 §2.3)

// 计算域名风险等级
export function domainRisk(d: Pick<DomainState, 'nxdomain' | 'days_to_expiry'>): DomainRisk {
    if (d.nxdomain) return 'nxdomain';
    if (d.days_to_expiry != null && d.days_to_expiry <= EXPIRE_WARN_DAYS) return 'expiring';
    return 'normal';
}

// 排序权重:NXDOMAIN 最前,其次到期临近(越快到期越前),正常最后
export function domainRiskWeight(d: DomainState): number {
    if (d.nxdomain) return 1_000_000; // 失联最高危
    if (d.days_to_expiry != null) {
        // 已过期/临近(<=阈值)按倒计时越小权重越高;其余小权重
        if (d.days_to_expiry <= EXPIRE_WARN_DAYS) return 100_000 - d.days_to_expiry;
        return Math.max(0, 1_000 - d.days_to_expiry);
    }
    return 0;
}
