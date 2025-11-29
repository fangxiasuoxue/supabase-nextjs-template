-- 消息模板系统迁移
-- 创建日期: 2025-11-28

-- 1. 创建消息模板表
CREATE TABLE IF NOT EXISTS public.message_templates (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,              -- 模板名称
    type VARCHAR(20) NOT NULL,               -- 模板类型: system, custom
    channels TEXT[] NOT NULL,                -- 适用渠道: email, wechat
    title_template TEXT,                     -- 标题模板
    content_template TEXT NOT NULL,          -- 正文模板
    variables JSONB,                         -- 支持的变量定义
    description TEXT,                        -- 模板描述
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- 2. 创建推送配置表
CREATE TABLE IF NOT EXISTS public.push_configs (
    id BIGSERIAL PRIMARY KEY,
    user_key VARCHAR(50) NOT NULL,           -- 用户标识: user1, user2
    user_name VARCHAR(100) NOT NULL,         -- 用户名称
    channel VARCHAR(20) NOT NULL,            -- 推送渠道: wechat, email
    config_key VARCHAR(200) NOT NULL,        -- 配置键名
    config_value TEXT NOT NULL,              -- 配置值
    is_enabled BOOLEAN DEFAULT TRUE,         -- 是否启用
    description TEXT,                        -- 配置说明
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 创建自动推送规则表
CREATE TABLE IF NOT EXISTS public.auto_push_rules (
    id BIGSERIAL PRIMARY KEY,
    user_key VARCHAR(50) NOT NULL,           -- 关联的用户
    is_enabled BOOLEAN DEFAULT FALSE,        -- 规则是否启用
    event_types TEXT[] NOT NULL,             -- 触发的事件类型
    priority_filter VARCHAR(20),             -- 优先级过滤
    time_window JSONB,                       -- 时间窗口配置
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 创建推送日志表
CREATE TABLE IF NOT EXISTS public.push_logs (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT REFERENCES external_messages(id) ON DELETE CASCADE,
    user_key VARCHAR(50) NOT NULL,           -- 推送目标用户
    channel VARCHAR(20) NOT NULL,            -- 推送渠道
    template_id BIGINT REFERENCES message_templates(id),
    status VARCHAR(20) NOT NULL,             -- success, failed, pending
    error_message TEXT,                      -- 错误信息
    pushed_at TIMESTAMPTZ DEFAULT NOW(),
    response_time INTEGER                    -- 响应时间(ms)
);

-- 5. 扩展 external_messages 表
ALTER TABLE external_messages
    ADD COLUMN IF NOT EXISTS template_id BIGINT REFERENCES message_templates(id),
    ADD COLUMN IF NOT EXISTS custom_content TEXT,    -- 自定义内容片段
    ADD COLUMN IF NOT EXISTS push_status VARCHAR(20) DEFAULT 'pending';

-- 6. 创建索引和唯一约束
ALTER TABLE message_templates ADD CONSTRAINT message_templates_name_unique UNIQUE (name);
CREATE INDEX IF NOT EXISTS idx_message_templates_type ON message_templates(type);
CREATE INDEX IF NOT EXISTS idx_message_templates_active ON message_templates(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_push_configs_user_key ON push_configs(user_key);
CREATE INDEX IF NOT EXISTS idx_push_configs_channel ON push_configs(channel);
CREATE INDEX IF NOT EXISTS idx_auto_push_rules_user ON auto_push_rules(user_key);
CREATE INDEX IF NOT EXISTS idx_auto_push_rules_enabled ON auto_push_rules(is_enabled) WHERE is_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_push_logs_message_id ON push_logs(message_id);
CREATE INDEX IF NOT EXISTS idx_push_logs_status ON push_logs(status);
CREATE INDEX IF NOT EXISTS idx_push_logs_pushed_at ON push_logs(pushed_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_messages_template ON external_messages(template_id);

-- 7. 启用行级安全
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_push_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_logs ENABLE ROW LEVEL SECURITY;

-- 8. RLS 策略
-- 消息模板: 管理员可管理
CREATE POLICY message_templates_admin ON message_templates
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 推送配置: 管理员可管理
CREATE POLICY push_configs_admin ON push_configs
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 自动推送规则: 管理员可管理
CREATE POLICY auto_push_rules_admin ON auto_push_rules
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 推送日志: 管理员可查看
CREATE POLICY push_logs_admin ON push_logs
  FOR SELECT USING (public.is_admin());

-- 9. 授予权限
GRANT ALL ON message_templates TO authenticated;
GRANT ALL ON push_configs TO authenticated;
GRANT ALL ON auto_push_rules TO authenticated;
GRANT ALL ON push_logs TO authenticated;

-- 10. 添加注释
COMMENT ON TABLE message_templates IS '消息模板表';
COMMENT ON COLUMN message_templates.name IS '模板名称';
COMMENT ON COLUMN message_templates.type IS '模板类型: system(系统模板), custom(自定义模板)';
COMMENT ON COLUMN message_templates.channels IS '适用渠道数组: email, wechat';
COMMENT ON COLUMN message_templates.title_template IS '标题模板，支持变量占位符';
COMMENT ON COLUMN message_templates.content_template IS '正文模板，支持变量占位符';
COMMENT ON COLUMN message_templates.variables IS '变量定义JSON';

COMMENT ON TABLE push_configs IS '推送配置表';
COMMENT ON COLUMN push_configs.user_key IS '用户标识，如: user1, user2';
COMMENT ON COLUMN push_configs.user_name IS '用户显示名称';
COMMENT ON COLUMN push_configs.channel IS '推送渠道: wechat, email';
COMMENT ON COLUMN push_configs.config_key IS '配置键名';
COMMENT ON COLUMN push_configs.config_value IS '配置值，如webhook URL';
COMMENT ON COLUMN push_configs.is_enabled IS '是否启用';

COMMENT ON TABLE auto_push_rules IS '自动推送规则表';
COMMENT ON COLUMN auto_push_rules.user_key IS '关联的用户键';
COMMENT ON COLUMN auto_push_rules.is_enabled IS '规则是否启用';
COMMENT ON COLUMN auto_push_rules.event_types IS '触发的事件类型数组';
COMMENT ON COLUMN auto_push_rules.priority_filter IS '优先级过滤';
COMMENT ON COLUMN auto_push_rules.time_window IS '时间窗口配置JSON';

COMMENT ON TABLE push_logs IS '推送日志表';
COMMENT ON COLUMN push_logs.message_id IS '关联的消息ID';
COMMENT ON COLUMN push_logs.user_key IS '推送目标用户';
COMMENT ON COLUMN push_logs.channel IS '推送渠道';
COMMENT ON COLUMN push_logs.template_id IS '使用的模板ID';
COMMENT ON COLUMN push_logs.status IS '推送状态: success, failed, pending';
COMMENT ON COLUMN push_logs.error_message IS '错误信息';
COMMENT ON COLUMN push_logs.response_time IS '响应时间(毫秒)';

-- 11. 插入默认模板数据
INSERT INTO message_templates (name, type, channels, title_template, content_template, description, is_active) VALUES
('维护通知模板', 'system', ARRAY['email', 'wechat'],
'[{date}] 代理维护通知',
'尊贵的会员,您好:
抱歉的通知您,由于当地运营商接入线路需要调整维护,您的IP网络地址业务将于以下时间可能不可用:
> **维护开始时间:** <font color="warning">{startTime}</font>
> **维护结束时间:** <font color="warning">{endTime}</font>
> **Proxy ID:** {proxyId}

在此过程中,您依赖这个IP地址的所有服务将中断,为了弥补因为我们的服务商给您带来的损失,我们将延长IP使用到期的时间,虽然它微不足道,但这仅代表我们的诚意。万分抱歉,我们将不断为您甄选最优质的当地运营服务商,以不断提升服务的品质。感谢一路有你陪伴!',
'系统默认的维护通知模板', TRUE),

('状态变更模板', 'system', ARRAY['email', 'wechat'],
'[{date}] 代理状态变更通知',
'尊贵的会员,您好:
您的IP地址业务状态已发生变更:
> **Proxy ID:** {proxyId}
> **旧状态:** <font color="comment">{oldStatus}</font>
> **新状态:** <font color="info">{status}</font>

如有疑问,请随时联系客服。',
'系统默认的状态变更通知模板', TRUE),

('流量增加模板', 'system', ARRAY['email', 'wechat'],
'[{date}] 代理流量增加通知',
'尊贵的会员,您好:
您的IP地址业务已成功增加流量:
> **Proxy ID:** {proxyId}
> **增加流量:** <font color="info">{trafficInGb} GB</font>

感谢您的支持!',
'系统默认的流量增加通知模板', TRUE),

('通用通知模板', 'system', ARRAY['email', 'wechat'],
'[{date}] 系统通知',
'**系统通知**
**事件类型:** {eventType}
**时间:** {date}

> **内容摘要:**
> ```json
{jsonContent}
> ```

感谢您的关注!',
'系统默认的通用通知模板', TRUE)
ON CONFLICT (name) DO NOTHING;
