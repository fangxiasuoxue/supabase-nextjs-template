-- 创建外部消息表,用于存储来自 proxy-cheap 等外部服务的 webhook 消息
create table if not exists public.external_messages (
  id bigint generated always as identity primary key,
  source text not null,                    -- 消息来源: 'proxy-cheap'
  event_type text not null,                -- 事件类型: 'proxy.status.changed', 'proxy.maintenance_window.created' 等
  event_id text not null unique,           -- 事件ID(唯一,用于幂等性)
  payload jsonb not null,                  -- 完整消息体
  is_read boolean default false,           -- 是否已读
  notes text,                              -- 备注(可编辑)
  received_at timestamptz not null,        -- 接收时间
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz                   -- 软删除
);

-- 创建索引以优化查询性能
create index if not exists idx_external_messages_source_event 
  on public.external_messages(source, event_type);

create index if not exists idx_external_messages_is_read 
  on public.external_messages(is_read) 
  where deleted_at is null;

create index if not exists idx_external_messages_deleted 
  on public.external_messages(deleted_at) 
  where deleted_at is null;

create index if not exists idx_external_messages_received_at 
  on public.external_messages(received_at desc);

create unique index if not exists idx_external_messages_event_id 
  on public.external_messages(event_id);

-- 添加注释
comment on table public.external_messages is '外部消息表,存储来自 proxy-cheap 等外部服务的 webhook 通知';
comment on column public.external_messages.source is '消息来源,如: proxy-cheap';
comment on column public.external_messages.event_type is '事件类型,如: proxy.status.changed';
comment on column public.external_messages.event_id is '事件ID,用于幂等性控制';
comment on column public.external_messages.payload is '完整的消息体(JSON格式)';
comment on column public.external_messages.is_read is '是否已读';
comment on column public.external_messages.notes is '管理员备注';
comment on column public.external_messages.received_at is '消息接收时间';
comment on column public.external_messages.deleted_at is '软删除时间戳';

-- 启用行级安全
alter table public.external_messages enable row level security;

-- RLS 策略: 只有管理员可以查看
create policy external_messages_select_admin on public.external_messages
  for select using (public.is_admin());

-- RLS 策略: 只有管理员可以插入
create policy external_messages_insert_admin on public.external_messages
  for insert with check (public.is_admin());

-- RLS 策略: 只有管理员可以更新
create policy external_messages_update_admin on public.external_messages
  for update using (public.is_admin()) 
  with check (public.is_admin());

-- RLS 策略: 只有管理员可以删除
create policy external_messages_delete_admin on public.external_messages
  for delete using (public.is_admin());

-- 授予权限
grant select, insert, update, delete on public.external_messages to authenticated;
