-- SDD 57 P4 · 清理模板 demo 的 DB 残留(todo_list 表 + files 存储桶)
-- 背景:表/桶均来自 Supabase SaaS 模板,已随 P1 删除对应前端页面(示例表格/示例存储)。
--   · todo_list 曾把 CRUD 全量授予 anon 角色(模板默认)= 越权隐患,一并根除。
--   · files 桶仅 demo「文件管理」页使用,已无引用。
--
-- 应用记录(2026-08-25,经 `jiedian db` Management API 应用于生产库 vvgd):
--   · todo_list:实测 0 行 → 已 drop(连带其 anon 越权授权/RLS/约束/索引)。
--   · files 桶 + 其 4 条 storage.objects 策略:生产库**从未创建**(demo storage 迁移未曾应用),
--     故无需处理;本文件保留幂等 DROP POLICY IF EXISTS 以对齐其它环境。
--
-- 注意:Supabase 禁止对 storage.objects / storage.buckets 直接 DELETE(protect_delete 触发器),
--   如某环境确有 files 桶需删,须走 Storage API(`DELETE /storage/v1/bucket/files`,桶须先清空),
--   不能用 SQL delete —— 故本迁移不含 storage 行删除语句。

-- ── 1. todo_list 表(CASCADE 连带其 RLS 策略/授权/约束/索引一起删)──
drop table if exists public.todo_list cascade;

-- ── 2. files 桶的 RLS 策略(幂等;生产库本就不存在,IF EXISTS 安全跳过)──
drop policy if exists "Give users access to own folder 1m0cqf_0" on storage.objects;
drop policy if exists "Give users access to own folder 1m0cqf_1" on storage.objects;
drop policy if exists "Give users access to own folder 1m0cqf_2" on storage.objects;
drop policy if exists "Give users access to own folder 1m0cqf_3" on storage.objects;

-- ── 3. files 桶本体:若存在,走 Storage API 删除(见文件头注),SQL 不处理 ──
