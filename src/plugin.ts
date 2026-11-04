import { definePlugin, server } from "@komari-monitor/plugin-sdk";
import { SyncEngine } from "./ddns";
import { registerRoutes } from "./routes";
import { Storage } from "./storage";
import { NodeInfo } from "./types";
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

function nodeOnline(status: unknown): boolean {
  if (!status) return true;
  if (typeof status === "boolean") return status;
  if (typeof status === "object" && "online" in (status as Record<string, unknown>)) {
    return (status as Record<string, unknown>).online !== false;
  }
  return true;
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
  try {
    const result = await server.call<Record<string, unknown>>(
      "common:getNodesLatestStatus",
      selected.length ? { uuids: selected } : {},
    );
    statuses = result && typeof result === "object" ? result : {};
  } catch (error) {
    console.warn("[ddns-plus] getNodesLatestStatus failed:", errorMessage(error));
  }

  return list
    .map((node) => {
      const uuid = String(node.uuid || "");
      return {
        uuid,
        name: String(node.name || uuid),
        ipv4: String(node.ipv4 || ""),
        ipv6: String(node.ipv6 || ""),
        online: nodeOnline(statuses[uuid]),
        group: String(node.group || ""),
      };
    })
    .filter((node) => node.uuid)
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function notify(message: string): Promise<void> {
  await server.call("admin:sendNotification", {
    event: {
      event: "DDNS Plus",
      message,
      time: nowIso(),
    },
  });
}

definePlugin({
  load() {
    storage.ensure();
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
      }
    });
    console.log("[ddns-plus] loaded, storage:", __storageDir__);
  },
  unload() {
    console.log("[ddns-plus] unloaded");
  },
});
