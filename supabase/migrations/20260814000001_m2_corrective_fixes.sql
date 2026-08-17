-- Migration: m2_corrective_fixes
-- Date: 2026-08-14
-- 状态:⚠️ 草案,待评审后再 push(本文件存在 ≠ 已上线;需人工 supabase db push / SQL Editor 执行)
-- 依据:docs/current/22-m2-field-mapping.md §5 四雷线上实测(库 vvgdwqvuxzcwkhoeavle,SQL Editor 核对)
-- 范围:只做 SQL 能安全根治的纠正性增量;读写路径切换/旧表冻结退场在 M2 后续阶段(D9)。
-- 安全性:全部为「加约束/放宽约束/改默认值」,对现有 7 行 vps + 空 nodes 表零破坏(已按实测数据验证)。
-- 自验:ops/testing/m2(docker postgres 红/绿,17 断言全绿,不碰生产)。
-- ⚠️ push 前置检查(唯一索引要求无重复 gcp_instance_name;实测 distinct=7 安全,仍建议复核):
--   SELECT count(*) - count(DISTINCT gcp_instance_name) AS dup_count FROM public.vps_instances;  -- 期望 0

-- ============================================================
-- 雷1 + 雷4:gcp_instance_name 补唯一索引
-- 实测:唯一索引仅 instance_id + pkey,gcp_instance_name 无唯一约束
-- → sync-from-openclaw 的 onConflict:'gcp_instance_name' 结构上必报 42P10;
--   且无机制阻止同一 VM 经两条路径写成两行(雷4)。
-- 现状数据:7 行 gcp_instance_name 全非空且唯一(distinct=7,null=0),索引可直接建。
-- ⚠️ 用「普通」唯一索引而非部分索引(WHERE ... IS NOT NULL):
--   supabase-js 的 upsert onConflict:'gcp_instance_name' 生成不带谓词的 ON CONFLICT (col),
--   部分索引不匹配裸 ON CONFLICT → 报 42P10。普通唯一索引默认 NULLS DISTINCT,
--   多个 NULL gcp_instance_name 仍允许(旧 GCP 同步路径未回填时),且能匹配 upsert。
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_vps_instances_gcp_name
    ON public.vps_instances (gcp_instance_name);

-- ============================================================
-- 雷2:放宽旧 GCP 采集层的 NOT NULL,使新模型 insert 能工作
-- 实测:instance_id/account/name/zone/status 五列仍 NOT NULL 无默认;
--   admin/vps/register(insert)与 sync-from-openclaw(upsert)都不给全这几列 → 必失败。
--   (zone 也在其中:sync-from-openclaw 的 vm.zone 可能为空、bare 节点手工注册可能不带 zone。)
--   线上 7 行实为 actions/vps.ts(GCP 同步)灌入(它给全五列)。
-- D9 方向=旧字段退场,故五列一并放宽为可空(旧 GCP 同步路径运行时仍会回填)。
-- 放宽 NOT NULL 永不破坏既有行或仍提供值的旧路径。
-- ============================================================
ALTER TABLE public.vps_instances ALTER COLUMN instance_id DROP NOT NULL;
ALTER TABLE public.vps_instances ALTER COLUMN account     DROP NOT NULL;
ALTER TABLE public.vps_instances ALTER COLUMN name        DROP NOT NULL;
ALTER TABLE public.vps_instances ALTER COLUMN zone        DROP NOT NULL;
ALTER TABLE public.vps_instances ALTER COLUMN status      DROP NOT NULL;
-- 注意:instance_id 上有 UNIQUE 索引;放宽 NOT NULL 后多行 NULL instance_id 合法(Postgres 唯一索引允许多个 NULL)。
--   新模型行以 gcp_instance_name 为业务键;instance_id 仅旧 GCP 同步路径使用。

-- ============================================================
-- 雷3:nodes.status DEFAULT 与 CHECK 对齐(活雷)
-- 实测:status CHECK 已是新值域(provisioning/active/.../error),
--   但 DEFAULT 仍是旧 'enabled' → 任何不显式给 status 的 insert 取默认即违反 CHECK 而失败。
-- nodes 表当前 0 行,改默认零风险。
-- ============================================================
ALTER TABLE public.nodes ALTER COLUMN status SET DEFAULT 'provisioning';

-- ============================================================
-- 雷3 附:nodes.protocol CHECK 与 nodes_patch 意图对齐(去 shadowsocks/ssr)
-- 实测:protocol 仍 varchar(50) + 旧 7 值 CHECK(含 shadowsocks/ssr)。
-- ⚠️ 只改 CHECK,不改列类型 varchar(50)→(20):
--   实测线上视图 node_statistics 依赖 nodes.protocol(rule _RETURN),
--   ALTER COLUMN ... TYPE 会被拒(0A000)。而列长度纯 cosmetic(5 个短协议名 20/50 都够),
--   node_statistics 是旧模型视图(按 vps_id 分组),留到 d/e 退场时连视图一起重做,
--   届时再顺带收窄类型。CHECK 改动不碰列类型、不受视图影响。
-- nodes 空表,ADD CONSTRAINT 无行可违反。
-- ============================================================
ALTER TABLE public.nodes DROP CONSTRAINT IF EXISTS nodes_protocol_check;
ALTER TABLE public.nodes
    ADD CONSTRAINT nodes_protocol_check
        CHECK (protocol IN ('vless', 'vmess', 'trojan', 'socks', 'http'));

-- ============================================================
-- 验证(push 后在 SQL Editor 跑,应全部符合预期)
-- ============================================================
-- 1) 唯一索引已建:
--    SELECT indexname FROM pg_indexes WHERE tablename='vps_instances' AND indexname='idx_vps_instances_gcp_name';
-- 2) 五列已可空:
--    SELECT column_name,is_nullable FROM information_schema.columns
--     WHERE table_name='vps_instances' AND column_name IN ('instance_id','account','name','zone','status');
-- 3) nodes.status 默认已改:
--    SELECT column_default FROM information_schema.columns WHERE table_name='nodes' AND column_name='status';
-- 4) protocol CHECK 已 5 值去 shadowsocks/ssr(列类型仍 varchar(50),留 d/e 收窄):
--    SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='nodes_protocol_check';
