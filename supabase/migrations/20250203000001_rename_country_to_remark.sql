-- Migration: Rename country column to remark in ip_assets table
-- Changes the country field to remark to avoid duplication with country_code

-- 1. 重命名字段
ALTER TABLE public.ip_assets 
  RENAME COLUMN country TO remark;

-- 2. 删除旧索引
DROP INDEX IF EXISTS public.ip_assets_country_idx;

-- 3. 创建新索引
CREATE INDEX IF NOT EXISTS ip_assets_remark_idx 
  ON public.ip_assets(remark) 
  TABLESPACE pg_default;

-- 4. 添加字段注释
COMMENT ON COLUMN public.ip_assets.remark IS '备注：用于给IP取的一个独立的名字便于记录';

