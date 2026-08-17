-- Fix: check_node_expiration() 触发器引用了已被 m2 迁移改名的列 expire_time(现为 expires_at),
-- 导致 nodes 表所有 INSERT/UPDATE 报错 `record "new" has no field "expire_time"`,节点无法创建。
-- 本迁移重建该函数,改用 expires_at。(BEFORE INSERT OR UPDATE ON nodes 的 check_node_expiration_trigger 复用此函数。)
CREATE OR REPLACE FUNCTION check_node_expiration() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expires_at IS NOT NULL AND NEW.expires_at < NOW() THEN
    NEW.status = 'expired';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
