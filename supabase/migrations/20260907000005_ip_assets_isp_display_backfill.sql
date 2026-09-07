-- 普通用户 IP 列表需要显示 ISP/运营商。
-- cheap IP 由 Proxy-Cheap metadata.ispName 同步；自建 VPS 导入的 IP 用 VPS provider 归一化填充，避免为空。
UPDATE public.ip_assets ia
SET isp_name = CASE lower(coalesce(v.provider, ''))
  WHEN 'gcp' THEN 'GCP'
  WHEN 'google' THEN 'GCP'
  WHEN 'google-cloud' THEN 'GCP'
  WHEN 'google cloud' THEN 'GCP'
  WHEN 'aliyun' THEN 'Aliyun'
  WHEN 'alicloud' THEN 'Aliyun'
  WHEN 'ali' THEN 'Aliyun'
  WHEN 'alibaba cloud' THEN 'Aliyun'
  WHEN 'aws' THEN 'AWS'
  WHEN 'amazon' THEN 'AWS'
  WHEN 'amazon web services' THEN 'AWS'
  WHEN 'azure' THEN 'Azure'
  WHEN '' THEN coalesce(NULLIF(ia.isp_name, ''), 'Cloud VPS')
  ELSE coalesce(NULLIF(v.provider, ''), 'Cloud VPS')
END
FROM public.vps_instances v
WHERE ia.vps_instance_id = v.id
  AND ia.origin_kind = 'managed_vps'
  AND (ia.isp_name IS NULL OR btrim(ia.isp_name) = '' OR lower(ia.isp_name) IN ('gcp','google','google-cloud','google cloud','aliyun','alicloud','ali','alibaba cloud','aws','amazon','amazon web services','azure'));
