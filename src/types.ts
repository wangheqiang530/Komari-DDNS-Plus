export type AuthMode = "token" | "key";
export type DnsRecordType = "A" | "AAAA";
export type CreateMode = "v4" | "v6" | "dual";
export type StatusState =
  | "pending"
  | "running"
  | "success"
  | "error"
  | "skipped"
  | "disabled";

export const INTERVAL_VALUES = [1, 5, 10, 15, 30, 60] as const;
export const TTL_VALUES = [
  1,
  60,
  120,
  300,
  600,
  900,
  1800,
  3600,
  7200,
  18000,
  43200,
  86400,
] as const;
export const MAX_RECORDS = 1000;
export const MAX_DOMAINS_PER_BATCH = 100;
export const MAX_NODES_PER_BATCH = 50;
export const MAX_LOGS = 1000;
export const RECORD_MARKER_PREFIX = "komari-ddns-plus:";

export interface Settings {
  version: 1;
  authMode: AuthMode;
  token: string;
  email: string;
  apiKey: string;
  notify: boolean;
  intervalMinutes: number;
  updatedAt: string;
}

export interface PublicSettings {
  authMode: AuthMode;
  email: string;
  hasToken: boolean;
  hasApiKey: boolean;
  notify: boolean;
  intervalMinutes: number;
  updatedAt: string;
}

export interface DdnsRecord {
  id: string;
  domain: string;
  type: DnsRecordType;
  nodeUuid: string;
  ttl: number;
  proxied: boolean;
  enabled: boolean;
  intervalMinutes: number;
  adoptExisting: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecordStatus {
  state: StatusState;
  action?: "created" | "updated" | "unchanged" | "skipped" | "error";
  currentIp?: string;
  recordId?: string;
  lastCheckedAt?: string;
  lastSuccessAt?: string;
  lastChangedAt?: string;
  lastError?: string;
  nextRunAt?: string;
}

export interface SyncJob {
  running: boolean;
  startedAt?: string;
  finishedAt?: string;
  total: number;
  completed: number;
  changed: number;
  skipped: number;
  errors: number;
  message?: string;
}

export interface LogEntry {
  id: string;
  at: string;
  level: "info" | "success" | "warning" | "error";
  action: string;
  message: string;
  domain?: string;
  type?: DnsRecordType;
  nodeUuid?: string;
}

export interface NodeInfo {
  uuid: string;
  name: string;
  ipv4: string;
  ipv6: string;
  online: boolean;
  group: string;
}

export interface BatchInput {
  nodeUuids: string[];
  domains: string[];
  mode: CreateMode;
  ttl: number;
  proxied: boolean;
  intervalMinutes: number;
  enabled: boolean;
  adoptExisting: boolean;
}

export interface AuthCredentials {
  authMode: AuthMode;
  token: string;
  email: string;
  apiKey: string;
}

export interface CloudflareRecord {
  id: string;
  type: DnsRecordType;
  name: string;
  content: string;
  ttl: number;
  proxied: boolean;
  comment?: string;
}

export interface CloudflareZone {
  id: string;
  name: string;
  status: string;
}
