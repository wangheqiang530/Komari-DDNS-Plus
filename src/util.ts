import crypto from "node:crypto";
import {
  AuthCredentials,
  AuthMode,
  DdnsRecord,
  INTERVAL_VALUES,
  MAX_DOMAINS_PER_BATCH,
  MAX_NODES_PER_BATCH,
  MAX_RECORDS,
  PublicSettings,
  Settings,
  TTL_VALUES,
} from "./types";

export class PluginError extends Error {
  status: number;
  code?: string | number;

  constructor(message: string, status = 400, code?: string | number) {
    super(message);
    this.name = "PluginError";
    this.status = status;
    this.code = code;
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function makeId(bytes = 12): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function stableId(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 24);
}

export function normalizeDomain(value: unknown): string {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  const name = raw.replace(/\.$/, "");
  const labels = name.split(".");
  const valid =
    name.length > 0 &&
    name.length <= 253 &&
    labels.length >= 2 &&
    labels.every(
      (label, index) =>
        (index === 0 && label === "*") ||
        /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label),
    );
  if (!valid) {
    throw new PluginError("请输入完整域名，例如 home.example.com；中文域名请使用 Punycode。");
  }
  return name;
}

export function parseDomains(value: unknown): string[] {
  const text = Array.isArray(value)
    ? value.map((item) => String(item)).join("\n")
    : typeof value === "string"
      ? value
      : "";
  const parts = text
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const domains: string[] = [];
  for (const part of parts) {
    const domain = normalizeDomain(part);
    if (!seen.has(domain)) {
      seen.add(domain);
      domains.push(domain);
    }
  }
  if (domains.length === 0) throw new PluginError("请至少输入一个域名。");
  if (domains.length > MAX_DOMAINS_PER_BATCH) {
    throw new PluginError(`单次最多添加 ${MAX_DOMAINS_PER_BATCH} 个域名。`);
  }
  return domains;
}

export function normalizeAuthMode(value: unknown, fallback: AuthMode = "token"): AuthMode {
  return value === "key" || value === "token" ? value : fallback;
}

export function normalizeSecret(value: unknown, label: string, required: boolean): string {
  const secret = typeof value === "string" ? value.trim() : "";
  if (!secret) {
    if (required) throw new PluginError(`请填写${label}。`);
    return "";
  }
  if (!/^[A-Za-z0-9_-]{20,300}$/.test(secret)) {
    throw new PluginError(`${label}格式不正确，请确认没有空格或换行。`);
  }
  return secret;
}

export function normalizeEmail(value: unknown, required: boolean): string {
  const email = typeof value === "string" ? value.trim() : "";
  if (!email && !required) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new PluginError("请输入有效的 Cloudflare 登录邮箱。");
  }
  return email;
}

export function normalizeSettings(input: unknown, previous?: Settings): Settings {
  if (!input || typeof input !== "object") throw new PluginError("设置格式无效。");
  const raw = input as Record<string, unknown>;
  const authMode = normalizeAuthMode(raw.authMode, previous?.authMode || "token");
  const tokenInput = typeof raw.token === "string" ? raw.token.trim() : "";
  const keyInput = typeof raw.apiKey === "string" ? raw.apiKey.trim() : "";
  const emailInput = typeof raw.email === "string" ? raw.email.trim() : "";

  const token =
    authMode === "token"
      ? normalizeSecret(tokenInput || (previous?.authMode === "token" ? previous.token : ""), "API Token", true)
      : "";
  const email = authMode === "key" ? normalizeEmail(emailInput, true) : "";
  if (
    previous?.authMode === "key" &&
    authMode === "key" &&
    previous.email &&
    previous.email !== email &&
    !keyInput
  ) {
    throw new PluginError("更换邮箱时必须同时填写对应的 Global API Key。");
  }
  const apiKey =
    authMode === "key"
      ? normalizeSecret(
          keyInput ||
            (previous?.authMode === "key" && previous.email === email ? previous.apiKey : ""),
          "Global API Key",
          true,
        )
      : "";

  const intervalMinutes = Number(raw.intervalMinutes ?? previous?.intervalMinutes ?? 1);
  if (!(INTERVAL_VALUES as readonly number[]).includes(intervalMinutes)) {
    throw new PluginError("同步间隔必须是 1、5、10、15、30 或 60 分钟。");
  }
  if (raw.notify !== undefined && typeof raw.notify !== "boolean") {
    throw new PluginError("通知开关格式无效。");
  }
  if (raw.paused !== undefined && typeof raw.paused !== "boolean") {
    throw new PluginError("暂停开关格式无效。");
  }

  return {
    version: 1,
    authMode,
    token,
    email,
    apiKey,
    notify: raw.notify === undefined ? Boolean(previous?.notify) : Boolean(raw.notify),
    paused: raw.paused === undefined ? Boolean(previous?.paused) : Boolean(raw.paused),
    intervalMinutes,
    updatedAt: nowIso(),
  };
}

export function resolveCredentials(
  input: unknown,
  saved: Settings,
): AuthCredentials {
  if (!input || typeof input !== "object") throw new PluginError("认证信息格式无效。");
  const raw = input as Record<string, unknown>;
  const authMode = normalizeAuthMode(raw.authMode, saved.authMode);
  const tokenInput = typeof raw.token === "string" ? raw.token.trim() : "";
  const keyInput = typeof raw.apiKey === "string" ? raw.apiKey.trim() : "";
  const emailInput = typeof raw.email === "string" ? raw.email.trim() : "";
  const token =
    authMode === "token"
      ? normalizeSecret(tokenInput || (saved.authMode === "token" ? saved.token : ""), "API Token", true)
      : "";
  const email = authMode === "key" ? normalizeEmail(emailInput || (saved.authMode === "key" ? saved.email : ""), true) : "";
  const apiKey =
    authMode === "key"
      ? normalizeSecret(
          keyInput || (saved.authMode === "key" && saved.email === email ? saved.apiKey : ""),
          "Global API Key",
          true,
        )
      : "";
  return { authMode, token, email, apiKey };
}

export function publicSettings(settings: Settings): PublicSettings {
  return {
    authMode: settings.authMode,
    email: settings.email,
    hasToken: Boolean(settings.token),
    hasApiKey: Boolean(settings.apiKey),
    notify: settings.notify,
    paused: settings.paused,
    intervalMinutes: settings.intervalMinutes,
    updatedAt: settings.updatedAt,
  };
}

export function normalizeTtl(value: unknown, proxied: boolean): number {
  const ttl = Number(value);
  if (proxied) return 1;
  if (!(TTL_VALUES as readonly number[]).includes(ttl)) {
    throw new PluginError("TTL 值无效。");
  }
  return ttl;
}

export function normalizeInterval(value: unknown): number {
  const interval = Number(value);
  if (!(INTERVAL_VALUES as readonly number[]).includes(interval)) {
    throw new PluginError("同步间隔必须是 1、5、10、15、30 或 60 分钟。");
  }
  return interval;
}

export function normalizeRecord(
  input: unknown,
  previous?: DdnsRecord,
): DdnsRecord {
  if (!input || typeof input !== "object") throw new PluginError("规则格式无效。");
  const raw = input as Record<string, unknown>;
  const type = raw.type === "AAAA" ? "AAAA" : raw.type === "A" ? "A" : null;
  if (!type) throw new PluginError("记录类型只能是 A 或 AAAA。");
  if (raw.proxied !== undefined && typeof raw.proxied !== "boolean") {
    throw new PluginError("代理开关格式无效。");
  }
  if (raw.enabled !== undefined && typeof raw.enabled !== "boolean") {
    throw new PluginError("启用开关格式无效。");
  }
  if (raw.adoptExisting !== undefined && typeof raw.adoptExisting !== "boolean") {
    throw new PluginError("接管已有记录开关格式无效。");
  }
  const proxied = Boolean(raw.proxied);
  const nodeUuid = typeof raw.nodeUuid === "string" ? raw.nodeUuid.trim() : "";
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(nodeUuid)) throw new PluginError("节点 UUID 无效。");
  const id = typeof raw.id === "string" && raw.id ? raw.id : previous?.id || makeId();
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(id)) throw new PluginError("规则 ID 无效。");
  const groupId =
    typeof raw.groupId === "string" && raw.groupId
      ? raw.groupId
      : previous?.groupId || makeId();
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(groupId)) throw new PluginError("规则组 ID 无效。");
  return {
    id,
    groupId,
    domain: normalizeDomain(raw.domain),
    type,
    nodeUuid,
    ttl: normalizeTtl(raw.ttl, proxied),
    proxied,
    enabled: raw.enabled === undefined ? previous?.enabled ?? true : Boolean(raw.enabled),
    intervalMinutes: normalizeInterval(raw.intervalMinutes ?? previous?.intervalMinutes ?? 1),
    adoptExisting:
      raw.adoptExisting === undefined ? previous?.adoptExisting ?? false : Boolean(raw.adoptExisting),
    createdAt: previous?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

export function recordKey(domain: string, type: string, nodeUuid: string): string {
  return `${domain}|${type}|${nodeUuid}`;
}

export function recordMarker(recordId: string): string {
  return `komari-ddns-plus:${recordId}`;
}

export function parseJsonBody(body: string): unknown {
  if (!body || !body.trim()) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw new PluginError("请求体不是合法 JSON。");
  }
}

export function assertRecordLimit(count: number): void {
  if (count > MAX_RECORDS) throw new PluginError(`最多支持 ${MAX_RECORDS} 条 DNS 规则。`);
}

export function normalizeNodeIds(value: unknown): string[] {
  if (!Array.isArray(value)) throw new PluginError("请选择至少一台服务器。");
  const ids = Array.from(
    new Set(
      value
        .map((item) => String(item || "").trim())
        .filter((item) => /^[a-zA-Z0-9-]{1,64}$/.test(item)),
    ),
  );
  if (ids.length === 0) throw new PluginError("请选择至少一台服务器。");
  if (ids.length > MAX_NODES_PER_BATCH) {
    throw new PluginError(`单次最多选择 ${MAX_NODES_PER_BATCH} 台服务器。`);
  }
  return ids;
}

export function redact(value: unknown, settings: Settings): string {
  let text = value instanceof Error ? value.message : String(value ?? "");
  for (const secret of [settings.token, settings.apiKey]) {
    if (secret) text = text.split(secret).join("[REDACTED]");
  }
  return text;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || "未知错误");
}
