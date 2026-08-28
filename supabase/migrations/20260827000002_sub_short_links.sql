-- SDD 61 · 订阅短链别名:一条又短又好记的 URL(panel.3pay.top/x/<code>)→ 302 到通用订阅长链。
-- 背景:通用订阅链接(/sub/bundle|/sub/[node]|/sub/u|/sub/client)已按 UA 自动适配所有客户端,
--   但 token 是 64 位长串,手输不便。本表给每条订阅长链映射一个短码,发人一条短链。
-- 鉴权:/x/<code> 匿名 GET(同 /sub/* 语义,302 到长链后由 /sub/* 按 UA 转格式);
--   读写均走 service_role(路由/mint API 层),RLS 默认拒绝匿名/普通用户直读。
-- 幂等:同一 target_path 只留一条短码(唯一索引),mint 重复调用返回既有码。

CREATE TABLE IF NOT EXISTS sub_short_links (
  code        text PRIMARY KEY,
  target_path text NOT NULL,          -- 订阅长链的路径,如 /sub/bundle/<token>、/sub/u/<token>
  label       text,                    -- 可选备注(节点名/用途)
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS sub_short_links_target_uidx ON sub_short_links (target_path);

ALTER TABLE sub_short_links ENABLE ROW LEVEL SECURITY;
-- 无 anon/authenticated 直读策略(默认拒绝);/x/<code> 路由与 mint API 用 service_role 绕 RLS。
