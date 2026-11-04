import {
  AuthCredentials,
  CloudflareRecord,
  CloudflareZone,
  DnsRecordType,
} from "./types";
import { PluginError, errorMessage, normalizeDomain } from "./util";

const CF_API = "https://api.cloudflare.com/client/v4";
const ZONE_CACHE_MS = 5 * 60 * 1000;

interface CloudflareErrorBody {
  code?: number;
  message?: string;
  error_chain?: CloudflareErrorBody[];
}

interface CloudflareEnvelope<T> {
  success?: boolean;
  result?: T;
  result_info?: {
    page?: number;
    total_pages?: number;
  };
  errors?: CloudflareErrorBody[];
}

export class CloudflareError extends PluginError {
  retryAfterMs?: number;

  constructor(message: string, status = 502, code?: number, retryAfterMs?: number) {
    super(message, status, code);
    this.name = "CloudflareError";
    this.retryAfterMs = retryAfterMs;
  }
}

export interface CloudflareClient {
  test(): Promise<{ message: string; zoneCount: number }>;
  listZones(): Promise<CloudflareZone[]>;
  zoneFor(domain: string): Promise<CloudflareZone>;
  listRecords(zoneId: string, name: string, type: DnsRecordType): Promise<CloudflareRecord[]>;
  createRecord(
    zoneId: string,
    payload: Record<string, unknown>,
  ): Promise<CloudflareRecord>;
  updateRecord(
    zoneId: string,
    recordId: string,
    payload: Record<string, unknown>,
  ): Promise<CloudflareRecord>;
  deleteRecord(zoneId: string, recordId: string): Promise<void>;
}

function authHeaders(auth: AuthCredentials): Record<string, string> {
  if (auth.authMode === "token") {
    if (!auth.token) throw new PluginError("尚未配置 Cloudflare API Token。");
    return { Authorization: `Bearer ${auth.token}` };
  }
  if (!auth.email || !auth.apiKey) {
    throw new PluginError("尚未配置 Cloudflare 邮箱或 Global API Key。");
  }
  return {
    "X-Auth-Email": auth.email,
    "X-Auth-Key": auth.apiKey,
  };
}

function flattenCloudflareErrors(errors: CloudflareErrorBody[] | undefined): CloudflareErrorBody[] {
  const result: CloudflareErrorBody[] = [];
  for (const error of errors || []) {
    result.push(error);
    if (Array.isArray(error.error_chain)) result.push(...error.error_chain);
  }
  return result;
}

function cloudflareFailure(
  status: number,
  errors: CloudflareErrorBody[] | undefined,
  retryAfterMs?: number,
): CloudflareError {
  const flattened = flattenCloudflareErrors(errors);
  const codes = flattened
    .map((item) => Number(item.code))
    .filter((item) => Number.isFinite(item));
  const messages = flattened
    .map((item) => String(item.message || "").trim())
    .filter(Boolean);
  const code = codes[0];

  if (status === 429) {
    return new CloudflareError(
      "Cloudflare API 请求受限，请稍后重试。",
      429,
      code,
      retryAfterMs,
    );
  }
  if (status === 401 || status === 403) {
    return new CloudflareError(
      "Cloudflare 认证或权限失败，请检查认证方式、Token 权限或 API Key。",
      status,
      code,
    );
  }
  if (codes.includes(6003) || codes.includes(6102) || codes.includes(6103) || codes.includes(6111)) {
    return new CloudflareError(
      "Cloudflare 认证请求头无效。API Token 必须使用 Bearer 认证；Global API Key 必须使用邮箱和 X-Auth-Key。",
      400,
      code,
    );
  }
  if (status === 400) {
    return new CloudflareError(
      `Cloudflare 拒绝了请求${messages.length ? `：${messages.join("；")}` : "。"}`,
      400,
      code,
    );
  }
  return new CloudflareError(
    `Cloudflare 请求失败（HTTP ${status}${code ? `，错误码 ${code}` : ""}）${
      messages.length ? `：${messages.join("；")}` : ""
    }`,
    status >= 500 ? 502 : status,
    code,
  );
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  if (/^\d+$/.test(value.trim())) return Number(value) * 1000;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : undefined;
}

export function createCloudflareClient(
  auth: AuthCredentials,
  fetcher: typeof fetch = fetch,
  now: () => number = Date.now,
): CloudflareClient {
  let zoneCache: { at: number; zones: CloudflareZone[] } | null = null;

  async function request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<CloudflareEnvelope<T>> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...authHeaders(auth),
    };
    if (init.body !== undefined) headers["Content-Type"] = "application/json";

    let response: Response;
    try {
      response = await fetcher(`${CF_API}${path}`, {
        ...init,
        headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
        redirect: "error",
      });
    } catch (error) {
      throw new CloudflareError(
        `无法连接 Cloudflare：${errorMessage(error)}`,
        502,
      );
    }

    let data: CloudflareEnvelope<T>;
    try {
      data = (await response.json()) as CloudflareEnvelope<T>;
    } catch {
      throw new CloudflareError(
        `Cloudflare 返回了无法解析的响应（HTTP ${response.status}）。`,
        response.status === 200 ? 502 : response.status,
      );
    }

    if (!response.ok || data.success !== true) {
      throw cloudflareFailure(
        response.status,
        data.errors,
        parseRetryAfter(response.headers.get("retry-after")),
      );
    }
    return data;
  }

  async function listZones(): Promise<CloudflareZone[]> {
    if (zoneCache && now() - zoneCache.at < ZONE_CACHE_MS) return zoneCache.zones;
    const zones: CloudflareZone[] = [];
    for (let page = 1; page <= 100; page++) {
      const data = await request<CloudflareZone[]>(
        `/zones?per_page=100&page=${page}`,
      );
      zones.push(...(data.result || []));
      const totalPages = Number(data.result_info?.total_pages || 1);
      if (page >= totalPages) break;
    }
    const active = zones.filter((zone) => zone.status === "active");
    zoneCache = { at: now(), zones: active };
    return active;
  }

  async function zoneFor(domain: string): Promise<CloudflareZone> {
    const normalized = normalizeDomain(domain).replace(/^\*\./, "");
    const labels = normalized.split(".");
    const zones = await listZones();
    for (let index = 0; index < labels.length - 1; index++) {
      const candidate = labels.slice(index).join(".");
      const zone = zones.find((item) => item.name.toLowerCase() === candidate);
      if (zone) return zone;
    }
    throw new PluginError(
      `在 Cloudflare 账户中找不到 ${normalized} 对应的有效 Zone。`,
      422,
    );
  }

  async function listRecords(
    zoneId: string,
    name: string,
    type: DnsRecordType,
  ): Promise<CloudflareRecord[]> {
    const records: CloudflareRecord[] = [];
    for (let page = 1; page <= 100; page++) {
      const data = await request<CloudflareRecord[]>(
        `/zones/${encodeURIComponent(zoneId)}/dns_records?name=${encodeURIComponent(
          name,
        )}&type=${encodeURIComponent(type)}&per_page=100&page=${page}`,
      );
      records.push(...(data.result || []));
      const totalPages = Number(data.result_info?.total_pages || 1);
      if (page >= totalPages) break;
    }
    return records;
  }

  async function createRecord(
    zoneId: string,
    payload: Record<string, unknown>,
  ): Promise<CloudflareRecord> {
    const data = await request<CloudflareRecord>(
      `/zones/${encodeURIComponent(zoneId)}/dns_records`,
      { method: "POST", body: JSON.stringify(payload) },
    );
    if (!data.result?.id) throw new CloudflareError("Cloudflare 未返回 DNS 记录 ID。");
    return data.result;
  }

  async function updateRecord(
    zoneId: string,
    recordId: string,
    payload: Record<string, unknown>,
  ): Promise<CloudflareRecord> {
    const data = await request<CloudflareRecord>(
      `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    );
    if (!data.result?.id) throw new CloudflareError("Cloudflare 未返回更新后的 DNS 记录。");
    return data.result;
  }

  async function deleteRecord(zoneId: string, recordId: string): Promise<void> {
    await request<{ id: string }>(
      `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`,
      { method: "DELETE" },
    );
  }

  async function test(): Promise<{ message: string; zoneCount: number }> {
    if (auth.authMode === "token") {
      await request<{ status: string }>("/user/tokens/verify");
    } else {
      await request<{ id: string }>("/user");
    }
    const zones = await listZones();
    return {
      message:
        auth.authMode === "token"
          ? `API Token 验证成功，可读取 ${zones.length} 个有效 Zone。`
          : `Global API Key 验证成功，可读取 ${zones.length} 个有效 Zone。`,
      zoneCount: zones.length,
    };
  }

  return {
    test,
    listZones,
    zoneFor,
    listRecords,
    createRecord,
    updateRecord,
    deleteRecord,
  };
}
