export interface SystemConfig {
  id: string;
  key: string;
  value: string | null;
  description: string | null;
  is_secret: boolean;
  group: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateConfigParams {
  key: string;
  value?: string;
  description?: string;
  is_secret?: boolean;
  group?: string;
}

export interface UpdateConfigParams {
  id: string;
  value?: string;
  description?: string;
  is_secret?: boolean;
  group?: string;
}

export interface ConfigFilter {
  search?: string;
  group?: string;
}
