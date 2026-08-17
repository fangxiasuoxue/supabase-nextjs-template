-- node_profiles 线上启用了 RLS 但没有任何 SELECT 策略 → authenticated(浏览器登录态)读取返回 0 行且无报错,
-- 导致部署表单(NodeDeployForm)"协议模板"下拉为空、进而"创建部署任务"按钮恒 disabled。
-- 补一条 authenticated 可读策略(协议模板非敏感,允许登录用户读)。service_role(服务端)本就绕过 RLS 不受影响。
ALTER TABLE node_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS node_profiles_select_authenticated ON node_profiles;
CREATE POLICY node_profiles_select_authenticated
  ON node_profiles FOR SELECT TO authenticated USING (true);
