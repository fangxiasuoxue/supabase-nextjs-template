-- Migration: ip_assets.label 规范资产标识 ｜ Date: 2026-08-15
-- 背景:资产标识须与 proxy-cheap 网页"名称"列一致(US01–US18/VN01),该名称 = API source_raw.note
--   (经 CDP 抓网页 + API 三方核实一致,见 memory proxy-cheap-api / 命名标准 doc 33)。
--   旧 remark 是手工残留("US-15(不再续期)"等),不可信,弃用为展示名。
-- 规则:label = source_raw.note(权威);null 时前端回退 provider_id。
-- 状态:✅ 生产已执行(2026-08-15)。

ALTER TABLE public.ip_assets ADD COLUMN IF NOT EXISTS label text;

-- 回填:从 proxy-cheap API 原始 note 取规范名称
UPDATE public.ip_assets
SET label = source_raw->>'note'
WHERE source_raw ? 'note'
  AND NULLIF(source_raw->>'note', '') IS NOT NULL;
