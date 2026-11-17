import { definePlugin, server } from "@komari-monitor/plugin-sdk";
import { SyncEngine } from "./ddns";
import { registerRoutes } from "./routes";
import { Storage } from "./storage";
import { NodeInfo, NotificationPayload } from "./types";
import { errorMessage, makeId, nowIso, redact } from "./util";

const storage = new Storage(__storageDir__);
let engine: SyncEngine;
let csrf = makeId(24);

function normalizeNodeList(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object") as Record<string, unknown>[];
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).filter(
      (item) => item && typeof item === "object",
    ) as Record<string, unknown>[];
  }
  return [];
}

/**
 * 在线状态未知时按离线处理：宁可这一轮跳过同步，也不要把可能过期的 IP 写进 DNS。
 */
function nodeOnline(status: unknown): boolean {
  if (status === undefined || status === null) return false;
  if (typeof status === "boolean") return status;
  if (typeof status === "object") {
    const online = (status as Record<string, unknown>).online;
    if (typeof online === "boolean") return online;
    const connected = (status as Record<string, unknown>).connected;
    if (typeof connected === "boolean") return connected;
  }
  return false;
}

async function getNodes(uuids?: string[]): Promise<NodeInfo[]> {
  const raw = await server.call<unknown>("common:getNodes");
  const wanted = uuids && uuids.length ? new Set(uuids) : null;
  const list = normalizeNodeList(raw).filter((node) => {
    const uuid = String(node.uuid || "");
    return !wanted || wanted.has(uuid);
  });
  const selected = list.map((node) => String(node.uuid || "")).filter(Boolean);
  let statuses: Record<string, unknown> = {};
  let statusError = "";
  try {
    const result = await server.call<Record<string, unknown>>(
      "common:getNodesLatestStatus",
      selected.length ? { uuids: selected } : {},
    );
    statuses = result && typeof result === "object" ? result : {};
  } catch (error) {
    statusError = errorMessage(error);
    console.warn("[ddns-plus] getNodesLatestStatus failed:", statusError);
  }

  if (statusError) {
    // 状态读取失败时不要继续用「未知」猜测，直接把整批节点标成离线，并让上层写一次告警日志。
    const settings = storage.loadSettings();
    storage.appendLog({
      level: "warning",
      action: "sync",
      message: `无法读取节点在线状态，本轮全部跳过：${redact(statusError, settings)}`,
    });
    storage.flushLogs();
  }

  return list
    .map((node) => {
      const uuid = String(node.uuid || "");
      const status = statuses[uuid];
      return {
        uuid,
        name: String(node.name || uuid),
        ipv4: String(node.ipv4 || ""),
        ipv6: String(node.ipv6 || ""),
        online: statusError ? false : nodeOnline(status),
        group: String(node.group || ""),
      };
    })
    .filter((node) => node.uuid)
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function notify(payload: NotificationPayload): Promise<void> {
  await server.call("admin:sendNotification", {
    event: {
      event: "DDNS Plus",
      message: payload.message,
      time: nowIso(),
      clients: payload.clients.map((uuid) => ({ uuid })),
    },
  });
}

function reportStorageIssues(): void {
  const issues = storage.drainIssues();
  if (!issues.length) return;
  const settings = storage.loadSettings();
  for (const issue of issues) {
    storage.appendLog({
      level: "error",
      action: "storage",
      message: `数据文件异常：${redact(issue, settings)}`,
    });
  }
  storage.flushLogs();
}

definePlugin({
  load() {
    storage.ensure();
    reportStorageIssues();
    csrf = makeId(24);
    engine = new SyncEngine({ storage, getNodes, notify });
    registerRoutes({ server, storage, engine, getNodes, csrf });
    server.cron("@every 30s", () => {
      try {
        engine.startDue();
      } catch (error) {
        const settings = storage.loadSettings();
        storage.appendLog({
          level: "error",
          action: "schedule",
          message: redact(errorMessage(error), settings),
        });
        storage.flushLogs();
      }
    });
    console.log("[ddns-plus] loaded, storage:", __storageDir__);
  },
  unload() {
    try {
      storage.flushLogs();
    } catch (error) {
      console.warn("[ddns-plus] flush logs on unload failed:", errorMessage(error));
    }
    console.log("[ddns-plus] unloaded");
  },
});
