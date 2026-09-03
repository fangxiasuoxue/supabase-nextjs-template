-- IP 授权行增加 per-user 展示名与到期停用意愿。
-- 同一个 IP 授权给不同用户时,每个用户可看到不同 display_name;
-- 普通用户的「终止使用」写入自己的授权行,管理员续费/自动续费后续按该字段过滤。

ALTER TABLE public.ip_allocations
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS terminate_at_period_end boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_ip_allocations_terminate_active
  ON public.ip_allocations(ip_id, assignee_user_id)
  WHERE state = 'allocated' AND released_at IS NULL AND terminate_at_period_end = true;

COMMENT ON COLUMN public.ip_allocations.display_name IS '该授权用户看到的 IP 显示名称;为空时回退 notes/ip_assets.remark/label';
COMMENT ON COLUMN public.ip_allocations.terminate_at_period_end IS '授权用户到期后不再续用/续费的意愿;普通用户可通过页面开关修改自己的授权行';

UPDATE public.ip_allocations
SET display_name = NULLIF(btrim(notes), '')
WHERE display_name IS NULL AND notes IS NOT NULL;
