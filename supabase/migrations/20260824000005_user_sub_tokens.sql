-- SDD 55 · P4/E6 —— 端用户合订阅:per-user 稳定订阅 token。
-- 背景:一个端用户可能被授权跨多节点的多个 seat(node_clients)。E6 给其「一个订阅 URL」
--   合并全部被授权 seat(客户导一次含全部)。该 URL 由高熵 user token 承担鉴权(同 /sub/* 语义,
--   匿名 GET,代理客户端带不了登录态)。作用域 = 该 user 当下被授权(access_grants node_client)的 seat。
-- token 唯一、每用户一行;由 /api/v1/me/sub-bundle 惰性铸造。撤销某 seat 授权后合订阅自动少一条(动态解析)。

CREATE TABLE IF NOT EXISTS user_sub_tokens (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE user_sub_tokens ENABLE ROW LEVEL SECURITY;
-- 自读(前端可查自己的 token 展示);写入走 service_role(API 层)。
DROP POLICY IF EXISTS user_sub_tokens_select_self ON user_sub_tokens;
CREATE POLICY user_sub_tokens_select_self ON user_sub_tokens
  FOR SELECT TO authenticated USING (user_id = auth.uid());
