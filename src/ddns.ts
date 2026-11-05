import * as net from "node:net";
import { CloudflareClient, CloudflareError, createCloudflareClient } from "./cloudflare";
import { Storage } from "./storage";
import {
  CloudflareRecord,
  DdnsRecord,
  NotificationChange,
  NotificationFailure,
  NotificationPayload,
  NodeInfo,
  RecordStatus,
  Settings,
  SyncJob,
} from "./types";
import {
  PluginError,
  errorMessage,
  nowIso,
  recordMarker,
  redact,
} from "./util";

const SYNC_CHUNK_SIZE = 10;

export interface SyncDependencies {
  storage: Storage;
  getNodes: (uuids?: string[]) => Promise<NodeInfo[]>;
  notify: (payload: NotificationPayload) => Promise<void>;
  createClient?: (settings: Settings) => CloudflareClient;
}

export interface SyncSnapshot {
  job: SyncJob;
  statuses: Record<string, RecordStatus>;
}

interface RecordSyncResult {
  changed: boolean;
  action?: "created" | "updated" | "unchanged" | "skipped";
  previousIp?: string;
  currentIp?: string;
}

function hasCredentials(settings: Settings): boolean {
  return settings.authMode === "token" ? Boolean(settings.token) : Boolean(settings.email && settings.apiKey);
}

function emptyJob(): SyncJob {
  return {
    running: false,
    total: 0,
    completed: 0,
    changed: 0,
    skipped: 0,
    errors: 0,
  };
}

function isPublicIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 192 && b === 0) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && parts[2] === 100) return false;
  if (a === 203 && b === 0 && parts[2] === 113) return false;
  return true;
}

function isPublicIPv6(ip: string): boolean {
  const value = ip.toLowerCase();
  if (value === "::" || value === "::1") return false;
  if (value.startsWith("fc") || value.startsWith("fd")) return false;
  if (/^fe[89ab]/.test(value)) return false;
  if (value.startsWith("ff")) return false;
  if (value.startsWith("2001:db8")) return false;
  return true;
}

export function validateAddress(ipValue: unknown, type: "A" | "AAAA"): string {
  const ip = String(ipValue || "").trim();
  const family = net.isIP(ip);
  if (family !== (type === "A" ? 4 : 6)) {
    throw new PluginError(
      `节点尚未上报有效的 ${type === "A" ? "IPv4" : "IPv6"} 地址。`,
      422,
    );
  }
  if (type === "A" && !isPublicIPv4(ip)) {
    throw new PluginError("节点上报的 IPv4 不是可用的公网地址。", 422);
  }
  if (type === "AAAA" && !isPublicIPv6(ip)) {
    throw new PluginError("节点上报的 IPv6 不是可用的公网地址。", 422);
  }
  return ip;
}

function statusForRecord(
  record: DdnsRecord,
  state: RecordStatus["state"],
  extra: Partial<RecordStatus> = {},
): RecordStatus {
  const checkedAt = nowIso();
  return {
    state,
    lastCheckedAt: checkedAt,
    nextRunAt: new Date(Date.now() + record.intervalMinutes * 60000).toISOString(),
    ...extra,
  };
}

export class SyncEngine {
  private readonly deps: SyncDependencies;
  private job: SyncJob = emptyJob();
  private statuses: Record<string, RecordStatus>;
  private blockedUntil = 0;
  private changes: NotificationChange[] = [];
  private failures: NotificationFailure[] = [];

  constructor(deps: SyncDependencies) {
    this.deps = deps;
    this.statuses = deps.storage.loadStatuses();
  }

  snapshot(): SyncSnapshot {
    return {
      job: { ...this.job },
      statuses: { ...this.statuses },
    };
  }

  removeStatuses(ids: string[]): void {
    for (const id of ids) delete this.statuses[id];
    this.deps.storage.saveStatuses(this.statuses);
  }

  start(ids?: string[], force = true): SyncJob {
    if (this.job.running) {
      throw new PluginError("已有同步任务正在运行，请稍后重试。", 409);
    }
    if (Date.now() < this.blockedUntil) {
      this.job = { ...this.job, message: "Cloudflare 限流等待中，请稍后重试。" };
      return { ...this.job };
    }
    const settings = this.deps.storage.loadSettings();
    if (!hasCredentials(settings)) {
      throw new PluginError("请先在设置页配置 Cloudflare API Token 或 API Key。", 422);
    }
    const records = this.deps.storage.loadRecords();
    const selectedIds = ids && ids.length ? new Set(ids) : null;
    const due = records.filter((record) => {
      if (!record.enabled) return false;
      if (selectedIds && !selectedIds.has(record.id)) return false;
      if (force || !selectedIds) {
        if (force) return true;
      }
      const next = this.statuses[record.id]?.nextRunAt;
      return !next || Date.parse(next) <= Date.now();
    });
    if (!due.length) {
      this.job = {
        ...this.job,
        running: false,
        message: selectedIds ? "所选规则中没有可同步的已启用记录。" : "当前没有到期的同步任务。",
      };
      return { ...this.job };
    }

    this.job = {
      running: true,
      startedAt: nowIso(),
      total: due.length,
      completed: 0,
      changed: 0,
      skipped: 0,
      errors: 0,
    };
    setTimeout(() => {
      void this.run(due, force).catch((error) => {
        this.job.running = false;
        this.job.finishedAt = nowIso();
        this.job.message = redact(errorMessage(error), settings);
      });
    }, 0);
    return { ...this.job };
  }

  startDue(): SyncJob {
    const settings = this.deps.storage.loadSettings();
    if (settings.paused) {
      this.job = { ...this.job, message: "计划同步已暂停。" };
      return { ...this.job };
    }
    if (!hasCredentials(settings)) {
      this.job = { ...emptyJob(), message: "尚未配置 Cloudflare 凭据。" };
      return { ...this.job };
    }
    return this.start(undefined, false);
  }

  private async run(records: DdnsRecord[], forceCloudflare: boolean): Promise<void> {
    const settings = this.deps.storage.loadSettings();
    this.changes = [];
    this.failures = [];
    const client = this.deps.createClient
      ? this.deps.createClient(settings)
      : createCloudflareClient(settings);
    const nodes = await this.deps.getNodes(Array.from(new Set(records.map((record) => record.nodeUuid))));
    const nodeMap = new Map(nodes.map((node) => [node.uuid, node]));

    for (let offset = 0; offset < records.length; offset += SYNC_CHUNK_SIZE) {
      const chunk = records.slice(offset, offset + SYNC_CHUNK_SIZE);
      for (const record of chunk) {
        const previousStatus = this.statuses[record.id];
        let result: RecordSyncResult | undefined;
        try {
          result = await this.syncRecord(
            record,
            client,
            nodeMap,
            settings.compareMode,
            forceCloudflare,
          );
        } catch (error) {
          const message = redact(errorMessage(error), settings);
          if (error instanceof CloudflareError && error.status === 429) {
            this.blockedUntil = Date.now() + (error.retryAfterMs || 60000);
          }
          this.statuses[record.id] = statusForRecord(record, "error", {
            action: "error",
            lastError: message,
          });
          this.job.errors += 1;
          if (previousStatus?.state !== "error") {
            this.failures.push({
              record,
              nodeName: nodeMap.get(record.nodeUuid)?.name || record.nodeUuid,
              message,
            });
          }
          this.deps.storage.appendLog({
            level: "error",
            action: "sync",
            message,
            domain: record.domain,
            type: record.type,
            nodeUuid: record.nodeUuid,
          });
        }
        if (
          result?.changed &&
          (result.action === "created" || result.action === "updated") &&
          (result.action === "created" || result.previousIp !== result.currentIp)
        ) {
          this.changes.push({
            record,
            nodeName: nodeMap.get(record.nodeUuid)?.name || record.nodeUuid,
            previousIp: result.previousIp,
            currentIp: result.currentIp || "",
            action: result.action,
          });
        }
        this.job.completed += 1;
      }
      this.deps.storage.saveStatuses(this.statuses);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }

    this.job.running = false;
    this.job.finishedAt = nowIso();
    this.job.message = `同步完成：共 ${this.job.total} 条，变更 ${this.job.changed} 条，跳过 ${this.job.skipped} 条，失败 ${this.job.errors} 条。`;
    if (this.job.changed > 0 || this.job.errors > 0) {
      this.deps.storage.appendLog({
        level: this.job.errors ? "warning" : "success",
        action: "sync",
        message: this.job.message,
      });
    }

    await this.sendNotificationSummary(settings);
  }

  private async sendNotificationSummary(settings: Settings): Promise<void> {
    if (!settings.notify || (this.changes.length === 0 && this.failures.length === 0)) {
      return;
    }
    const lines: string[] = [];
    if (this.changes.length) {
      lines.push(`IP 变更 ${this.changes.length} 条：`);
      for (const change of this.changes.slice(0, 8)) {
        const before = change.action === "created" ? "新建" : change.previousIp || "未知";
        lines.push(
          `- ${change.nodeName} / ${change.record.domain} ${change.record.type}: ${before} -> ${change.currentIp}`,
        );
      }
      if (this.changes.length > 8) {
        lines.push(`- 另有 ${this.changes.length - 8} 条变更未列出`);
      }
    }
    if (this.failures.length) {
      if (lines.length) lines.push("");
      lines.push(`同步失败 ${this.failures.length} 条：`);
      for (const failure of this.failures.slice(0, 8)) {
        const detail =
          failure.message.length > 160
            ? failure.message.slice(0, 157) + "..."
            : failure.message;
        lines.push(
          `- ${failure.nodeName} / ${failure.record.domain} ${failure.record.type}: ${detail}`,
        );
      }
      if (this.failures.length > 8) {
        lines.push(`- 另有 ${this.failures.length - 8} 条失败未列出`);
      }
    }
    const clients = Array.from(
      new Set(
        [...this.changes, ...this.failures].map((item) => item.record.nodeUuid),
      ),
    );
    try {
      await this.deps.notify({
        message: lines.join("\n").slice(0, 3500),
        clients,
      });
    } catch (error) {
      this.deps.storage.appendLog({
        level: "warning",
        action: "notify",
        message: `通知发送失败：${redact(errorMessage(error), settings)}`,
      });
    }
  }

  private async syncRecord(
    record: DdnsRecord,
    client: ReturnType<typeof createCloudflareClient>,
    nodes: Map<string, NodeInfo>,
    compareMode: Settings["compareMode"],
    forceCloudflare: boolean,
  ): Promise<RecordSyncResult> {
    if (!record.enabled) {
      this.statuses[record.id] = statusForRecord(record, "disabled", {
        action: "skipped",
      });
      this.job.skipped += 1;
      return { changed: false, action: "skipped" };
    }

    const node = nodes.get(record.nodeUuid);
    if (!node) {
      throw new PluginError("所选节点已删除或无法读取。", 422);
    }
    if (!node.online) {
      this.statuses[record.id] = statusForRecord(record, "skipped", {
        action: "skipped",
        lastError: "节点离线，保留现有 DNS 记录。",
      });
      this.job.skipped += 1;
      this.deps.storage.appendLog({
        level: "info",
        action: "sync",
        message: "节点离线，跳过同步。",
        domain: record.domain,
        type: record.type,
        nodeUuid: record.nodeUuid,
      });
      return { changed: false, action: "skipped" };
    }

    const ip = validateAddress(record.type === "A" ? node.ipv4 : node.ipv6, record.type);
    const effectiveTtl = record.proxied ? 1 : record.ttl;
    const previous = this.statuses[record.id];
    if (
      !forceCloudflare &&
      compareMode === "local" &&
      previous?.state === "success" &&
      previous.currentIp === ip &&
      previous.recordId &&
      previous.syncedTtl === effectiveTtl &&
      previous.syncedProxied === record.proxied
    ) {
      this.statuses[record.id] = statusForRecord(record, "success", {
        action: "unchanged",
        currentIp: ip,
        recordId: previous.recordId,
        lastSuccessAt: previous.lastSuccessAt,
        lastChangedAt: previous.lastChangedAt,
        syncedTtl: effectiveTtl,
        syncedProxied: record.proxied,
      });
      this.job.skipped += 1;
      return { changed: false, action: "unchanged", previousIp: ip, currentIp: ip };
    }
    const zone = await client.zoneFor(record.domain);
    const existing = await client.listRecords(zone.id, record.domain, record.type);
    const marker = recordMarker(record.id);
    const managed = existing.filter(
      (item) => item.type === record.type && item.name === record.domain && item.comment === marker,
    );
    if (managed.length > 1) {
      throw new PluginError("发现多条由本插件管理的重复 DNS 记录，请先到 Cloudflare 整理。", 422);
    }

    let current: CloudflareRecord | undefined = managed[0];
    if (!current && this.statuses[record.id]?.recordId) {
      current = existing.find((item) => item.id === this.statuses[record.id]?.recordId);
    }

    if (!current) {
      const orphanedManaged = existing.filter(
        (item) =>
          item.type === record.type &&
          item.name === record.domain &&
          String(item.comment || "").startsWith("komari-ddns-plus:"),
      );
      if (orphanedManaged.length > 1) {
        throw new PluginError(
          "目标域名存在多条本插件历史记录，请先到 Cloudflare 整理。",
          422,
        );
      }
      if (orphanedManaged.length === 1) current = orphanedManaged[0];
    }

    if (!current) {
      const unmanaged = existing.filter((item) => !String(item.comment || "").startsWith("komari-ddns-plus:"));
      if (unmanaged.length > 0) {
        if (!record.adoptExisting || unmanaged.length !== 1 || unmanaged[0].comment) {
          throw new PluginError(
            "目标域名已有非本插件管理的同类型记录，已停止覆盖。可先整理记录，或启用“接管唯一已有记录”。",
            422,
          );
        }
        current = unmanaged[0];
      }
    }

    const payload = {
      type: record.type,
      name: record.domain,
      content: ip,
      ttl: effectiveTtl,
      proxied: record.proxied,
      comment: marker,
    };

    if (
      current &&
      current.content === ip &&
      Number(current.ttl) === payload.ttl &&
      Boolean(current.proxied) === payload.proxied &&
      current.comment === marker
    ) {
      this.statuses[record.id] = statusForRecord(record, "success", {
        action: "unchanged",
        currentIp: ip,
        recordId: current.id,
        lastSuccessAt: nowIso(),
        lastChangedAt: this.statuses[record.id]?.lastChangedAt,
        syncedTtl: payload.ttl,
        syncedProxied: record.proxied,
      });
      this.job.skipped += 1;
      return {
        changed: false,
        action: "unchanged",
        previousIp: current.content,
        currentIp: ip,
      };
    }

    const updated = current
      ? await client.updateRecord(zone.id, current.id, payload)
      : await client.createRecord(zone.id, payload);
    const changedAt = nowIso();
    this.statuses[record.id] = statusForRecord(record, "success", {
      action: current ? "updated" : "created",
      currentIp: ip,
      recordId: updated.id,
      lastSuccessAt: changedAt,
      lastChangedAt: changedAt,
      syncedTtl: payload.ttl,
      syncedProxied: record.proxied,
    });
    this.job.changed += 1;
    this.deps.storage.appendLog({
      level: "success",
      action: current ? "update" : "create",
      message: `${current ? "更新" : "创建"} ${record.type} 记录为 ${ip}`,
      domain: record.domain,
      type: record.type,
      nodeUuid: record.nodeUuid,
    });
    return {
      changed: true,
      action: current ? "updated" : "created",
      previousIp: current?.content,
      currentIp: ip,
    };
  }
}
