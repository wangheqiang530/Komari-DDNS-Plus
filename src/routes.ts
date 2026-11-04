import type { PluginRequest, PluginResponse, PluginServer } from "@komari-monitor/plugin-sdk";
import { jsonResponse } from "@komari-monitor/plugin-sdk";
import { expandBatch } from "./batch";
import { SyncEngine } from "./ddns";
import { createCloudflareClient } from "./cloudflare";
import { Storage } from "./storage";
import { CreateMode, NodeInfo } from "./types";
import {
  PluginError,
  assertRecordLimit,
  errorMessage,
  normalizeInterval,
  normalizeNodeIds,
  normalizeSettings,
  normalizeTtl,
  nowIso,
  parseDomains,
  parseJsonBody,
  publicSettings,
  recordKey,
  resolveCredentials,
} from "./util";

interface RouteDependencies {
  server: PluginServer;
  storage: Storage;
  engine: SyncEngine;
  getNodes: (uuids?: string[]) => Promise<NodeInfo[]>;
  csrf: string;
}

function isAdmin(req: PluginRequest): boolean {
  const principal = req.context?.principal;
  return Boolean(
    principal &&
      Array.isArray(principal.roles) &&
      principal.roles.includes("admin"),
  );
}

function setNoStore(res: PluginResponse): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

function fail(res: PluginResponse, error: unknown): void {
  const message = errorMessage(error);
  const status = error instanceof PluginError ? error.status : 500;
  setNoStore(res);
  jsonResponse(res, { error: message }, status);
}

function requireAdmin(req: PluginRequest, res: PluginResponse): boolean {
  if (isAdmin(req)) return true;
  setNoStore(res);
  jsonResponse(res, { error: "请先登录 Komari 管理员账户。" }, 401);
  return false;
}

function requireCsrf(req: PluginRequest, expected: string): void {
  const value = req.headers["x-komari-ddns-plus-csrf"];
  const token = Array.isArray(value) ? value[0] : value;
  if (!token || token !== expected) throw new PluginError("CSRF 校验失败，请刷新页面后重试。", 403);
}

function bodyOf(req: PluginRequest): Record<string, unknown> {
  const parsed = parseJsonBody(req.body);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new PluginError("请求体必须是 JSON 对象。");
  }
  return parsed as Record<string, unknown>;
}

function parseMode(value: unknown): CreateMode {
  if (value === "v4" || value === "v6" || value === "dual") return value;
  throw new PluginError("模式只能是 IPv4、IPv6 或 IPv4 + IPv6。");
}

function parseIds(value: unknown): string[] {
  if (!Array.isArray(value)) throw new PluginError("请选择至少一条规则。");
  const ids = Array.from(
    new Set(
      value
        .map((item) => String(item || "").trim())
        .filter((item) => /^[a-zA-Z0-9-]{8,64}$/.test(item)),
    ),
  );
  if (ids.length === 0) throw new PluginError("请选择至少一条规则。");
  return ids;
}

function parseBoolean(value: unknown, fallback: boolean, label: string): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new PluginError(`${label}格式无效。`);
  return value;
}

function ensureIdle(engine: SyncEngine): void {
  if (engine.snapshot().job.running) {
    throw new PluginError("同步任务正在运行，请完成后再修改规则或设置。", 409);
  }
}

export function registerRoutes(deps: RouteDependencies): void {
  const { server, storage, engine, getNodes, csrf } = deps;

  server.route("GET", "/ddns-plus/state", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const settings = storage.loadSettings();
    const snapshot = engine.snapshot();
    setNoStore(res);
    jsonResponse(res, {
      settings: publicSettings(settings),
      records: storage.loadRecords(),
      statuses: snapshot.statuses,
      sync: snapshot.job,
      csrf,
      version: "0.0.1",
    });
  });

  server.route("GET", "/ddns-plus/nodes", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      setNoStore(res);
      jsonResponse(res, await getNodes());
    } catch (error) {
      fail(res, error);
    }
  });

  server.route("POST", "/ddns-plus/settings/test", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      requireCsrf(req, csrf);
      const saved = storage.loadSettings();
      const auth = resolveCredentials(bodyOf(req), saved);
      const result = await createCloudflareClient(auth).test();
      setNoStore(res);
      jsonResponse(res, result);
    } catch (error) {
      fail(res, error);
    }
  });

  server.route("POST", "/ddns-plus/settings", (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      requireCsrf(req, csrf);
      ensureIdle(engine);
      const previous = storage.loadSettings();
      const next = normalizeSettings(bodyOf(req), previous);
      storage.saveSettings(next);
      storage.appendLog({
        level: "info",
        action: "settings",
        message: "已保存 Cloudflare 连接设置。",
      });
      setNoStore(res);
      jsonResponse(res, { settings: publicSettings(next) });
    } catch (error) {
      fail(res, error);
    }
  });

  server.route("POST", "/ddns-plus/records/batch", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      requireCsrf(req, csrf);
      ensureIdle(engine);
      const body = bodyOf(req);
      const settings = storage.loadSettings();
      const nodeUuids = normalizeNodeIds(body.nodeUuids);
      const domains = parseDomains(body.domains);
      const mode = parseMode(body.mode);
      const proxied = parseBoolean(body.proxied, false, "代理开关");
      const ttl = normalizeTtl(body.ttl, proxied);
      const intervalMinutes = normalizeInterval(
        body.intervalMinutes ?? settings.intervalMinutes,
      );
      const enabled = parseBoolean(body.enabled, true, "启用开关");
      const adoptExisting = parseBoolean(body.adoptExisting, false, "接管已有记录开关");
      const nodes = await getNodes(nodeUuids);
      const available = new Set(nodes.map((node) => node.uuid));
      const missing = nodeUuids.filter((uuid) => !available.has(uuid));
      if (missing.length) throw new PluginError("规则中包含已删除的服务器，请刷新节点列表。");

      const generated = expandBatch(
        {
          nodeUuids,
          domains,
          mode,
          ttl,
          proxied,
          intervalMinutes,
          enabled,
          adoptExisting,
        },
        settings.intervalMinutes,
      );
      const records = storage.loadRecords();
      const existing = new Set(
        records.map((record) => recordKey(record.domain, record.type, record.nodeUuid)),
      );
      const additions = generated.filter((record) => {
        const key = recordKey(record.domain, record.type, record.nodeUuid);
        if (existing.has(key)) return false;
        existing.add(key);
        return true;
      });
      assertRecordLimit(records.length + additions.length);
      if (additions.length) {
        storage.saveRecords(records.concat(additions));
        storage.appendLog({
          level: "info",
          action: "batch-add",
          message: `批量添加 ${additions.length} 条规则，跳过 ${generated.length - additions.length} 条重复规则。`,
        });
      }
      setNoStore(res);
      jsonResponse(res, {
        added: additions.length,
        skipped: generated.length - additions.length,
        total: records.length + additions.length,
        records: additions,
      });
    } catch (error) {
      fail(res, error);
    }
  });

  server.route("POST", "/ddns-plus/records/bulk", (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      requireCsrf(req, csrf);
      const body = bodyOf(req);
      const ids = parseIds(body.ids);
      const action = String(body.action || "");
      const idSet = new Set(ids);
      const records = storage.loadRecords();
      if (action === "enable" || action === "disable") {
        ensureIdle(engine);
        const enabled = action === "enable";
        const updated = records.map((record) =>
          idSet.has(record.id) ? { ...record, enabled, updatedAt: nowIso() } : record,
        );
        storage.saveRecords(updated);
        storage.appendLog({
          level: "info",
          action: enabled ? "bulk-enable" : "bulk-disable",
          message: `${enabled ? "启用" : "停用"} ${ids.length} 条规则。`,
        });
        setNoStore(res);
        jsonResponse(res, { ok: true, affected: ids.length });
        return;
      }
      if (action === "delete") {
        ensureIdle(engine);
        const remaining = records.filter((record) => !idSet.has(record.id));
        storage.saveRecords(remaining);
        engine.removeStatuses(ids);
        storage.appendLog({
          level: "warning",
          action: "bulk-delete",
          message: `删除 ${records.length - remaining.length} 条规则，Cloudflare DNS 记录保留。`,
        });
        setNoStore(res);
        jsonResponse(res, { ok: true, affected: records.length - remaining.length });
        return;
      }
      if (action === "sync") {
        const job = engine.start(ids, true);
        setNoStore(res);
        jsonResponse(res, { ok: true, job });
        return;
      }
      throw new PluginError("不支持的批量操作。");
    } catch (error) {
      fail(res, error);
    }
  });

  server.route("POST", "/ddns-plus/sync", (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      requireCsrf(req, csrf);
      const body = bodyOf(req);
      const ids = Array.isArray(body.ids) ? parseIds(body.ids) : undefined;
      const job = engine.start(ids, body.force === false ? false : true);
      setNoStore(res);
      jsonResponse(res, { ok: true, job });
    } catch (error) {
      fail(res, error);
    }
  });

  server.route("GET", "/ddns-plus/logs", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const query = req.query || {};
    const level = String(query.level || "");
    const domain = String(query.domain || "").toLowerCase();
    const limit = Math.max(1, Math.min(1000, Number(query.limit) || 200));
    const logs = storage
      .loadLogs()
      .filter((log) => (!level || log.level === level) && (!domain || String(log.domain || "").toLowerCase().includes(domain)))
      .slice(-limit)
      .reverse();
    setNoStore(res);
    jsonResponse(res, { logs, total: logs.length });
  });

  server.route("DELETE", "/ddns-plus/logs", (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      requireCsrf(req, csrf);
      storage.clearLogs();
      setNoStore(res);
      jsonResponse(res, { ok: true });
    } catch (error) {
      fail(res, error);
    }
  });
}
