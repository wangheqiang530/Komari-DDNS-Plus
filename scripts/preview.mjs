import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 18795);

const nodes = [
  { uuid: "hk1-node", name: "HK1", ipv4: "45.136.12.201", ipv6: "2001:df1:7880:4::16c9", online: true, group: "Hong Kong" },
  { uuid: "sg1-node", name: "SG1", ipv4: "129.221.157.155", ipv6: "2603:c024:4517:d166:0:edb9:78b3:259e", online: true, group: "Singapore" },
  { uuid: "usw1-node", name: "VIP-USW1", ipv4: "38.146.29.223", ipv6: "", online: true, group: "Los Angeles" },
  { uuid: "de1-node", name: "DE1", ipv4: "79.76.109.60", ipv6: "2603:c020:8015:c800:0:8cdd:e050:ff", online: false, group: "Frankfurt" },
];

let records = [
  {
    id: "record-preview-a",
    groupId: "group-hk1",
    domain: "hk1.example.com",
    type: "A",
    nodeUuid: "hk1-node",
    ttl: 1,
    proxied: false,
    enabled: true,
    intervalMinutes: 1,
    adoptExisting: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "record-preview-aaaa",
    groupId: "group-hk1",
    domain: "hk1.example.com",
    type: "AAAA",
    nodeUuid: "hk1-node",
    ttl: 1,
    proxied: false,
    enabled: true,
    intervalMinutes: 1,
    adoptExisting: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "record-preview-sg",
    groupId: "group-sg1",
    domain: "sg1.example.com",
    type: "A",
    nodeUuid: "sg1-node",
    ttl: 300,
    proxied: true,
    enabled: true,
    intervalMinutes: 5,
    adoptExisting: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "record-preview-extra-a",
    groupId: "group-hk1-v4",
    domain: "hk1-v4.example.com",
    type: "A",
    nodeUuid: "hk1-node",
    ttl: 300,
    proxied: false,
    enabled: true,
    intervalMinutes: 5,
    adoptExisting: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "record-preview-extra-b",
    groupId: "group-hk1-v4",
    domain: "hk1-v6.example.com",
    type: "A",
    nodeUuid: "hk1-node",
    ttl: 300,
    proxied: false,
    enabled: true,
    intervalMinutes: 5,
    adoptExisting: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let groups = [
  {
    id: "group-hk1",
    nodeUuid: "hk1-node",
    domains: ["hk1.example.com"],
    mode: "dual",
    ttl: 1,
    proxied: false,
    enabled: true,
    intervalMinutes: 1,
    adoptExisting: false,
    recordIds: ["record-preview-a", "record-preview-aaaa"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "group-sg1",
    nodeUuid: "sg1-node",
    domains: ["sg1.example.com"],
    mode: "v4",
    ttl: 300,
    proxied: true,
    enabled: true,
    intervalMinutes: 5,
    adoptExisting: false,
    recordIds: ["record-preview-sg"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "group-hk1-v4",
    nodeUuid: "hk1-node",
    domains: ["hk1-v4.example.com", "hk1-v6.example.com"],
    mode: "v4",
    ttl: 300,
    proxied: false,
    enabled: true,
    intervalMinutes: 5,
    adoptExisting: false,
    recordIds: ["record-preview-extra-a", "record-preview-extra-b"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let settings = {
  authMode: "token",
  email: "",
  hasToken: true,
  hasApiKey: false,
  notify: true,
  paused: false,
  compareMode: "local",
  intervalMinutes: 1,
  updatedAt: new Date().toISOString(),
};

const statuses = {
  "record-preview-a": {
    state: "success",
    action: "unchanged",
    currentIp: "45.136.12.201",
    lastCheckedAt: new Date(Date.now() - 25_000).toISOString(),
    lastSuccessAt: new Date(Date.now() - 25_000).toISOString(),
  },
  "record-preview-aaaa": {
    state: "success",
    action: "updated",
    currentIp: "2001:df1:7880:4::16c9",
    lastCheckedAt: new Date(Date.now() - 25_000).toISOString(),
    lastSuccessAt: new Date(Date.now() - 25_000).toISOString(),
    lastChangedAt: new Date(Date.now() - 25_000).toISOString(),
  },
  "record-preview-sg": {
    state: "error",
    action: "error",
    currentIp: "129.221.157.155",
    lastCheckedAt: new Date(Date.now() - 65_000).toISOString(),
    lastError: "Cloudflare 代理记录与当前设置不一致，将在下个周期重试。",
  },
  "record-preview-extra-a": {
    state: "success",
    action: "unchanged",
    currentIp: "45.136.12.202",
    lastCheckedAt: new Date(Date.now() - 20_000).toISOString(),
    lastSuccessAt: new Date(Date.now() - 20_000).toISOString(),
  },
  "record-preview-extra-b": {
    state: "success",
    action: "unchanged",
    currentIp: "45.136.12.203",
    lastCheckedAt: new Date(Date.now() - 20_000).toISOString(),
    lastSuccessAt: new Date(Date.now() - 20_000).toISOString(),
  },
};

let sync = {
  running: false,
  total: 0,
  completed: 0,
  changed: 0,
  skipped: 0,
  errors: 0,
  message: "上次同步完成：共 3 条，变更 1 条，跳过 1 条，失败 1 条。",
  finishedAt: new Date(Date.now() - 20_000).toISOString(),
};

const logs = [
  { id: "log-1", at: new Date(Date.now() - 25_000).toISOString(), level: "success", action: "update", message: "更新 AAAA 记录为 2001:df1:7880:4::16c9", domain: "hk1.example.com", type: "AAAA" },
  { id: "log-2", at: new Date(Date.now() - 65_000).toISOString(), level: "error", action: "sync", message: "Cloudflare 代理记录与当前设置不一致，将在下个周期重试。", domain: "sg1.example.com", type: "A" },
  { id: "log-3", at: new Date(Date.now() - 70_000).toISOString(), level: "info", action: "batch-add", message: "批量添加 3 条规则，跳过 0 条重复规则。" },
];

function json(res, value, status = 200) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(value));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function staticFile(res, relative) {
  const file = path.join(root, relative);
  if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  const ext = path.extname(file);
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
  };
  res.writeHead(200, { "content-type": types[ext] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
  if (url.pathname === "/") {
    res.writeHead(302, { location: "/pages/admin.html" });
    res.end();
    return;
  }
  if (url.pathname === "/theme-parent.html") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(`<!doctype html>
<html class="dark">
  <head>
    <meta charset="utf-8">
    <style>
      html, body, iframe { margin: 0; width: 100%; height: 100%; border: 0; }
      body { background: #101419; }
      .theme-root {
        --accent-3: #1d314e;
        --accent-9: #4f8df7;
        --accent-10: #76a8ff;
        --accent-11: #9dc2ff;
        --accent-contrast: #ffffff;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <div class="theme-root">
      <iframe src="/pages/admin.html"></iframe>
    </div>
  </body>
</html>`);
    return;
  }
  if (url.pathname.startsWith("/ddns-plus/")) {
    if (req.method === "GET" && url.pathname === "/ddns-plus/state") {
      json(res, {
        settings,
        records,
        groups,
        statuses,
        sync,
        csrf: "preview-csrf",
        version: "0.0.4",
      });
      return;
    }
    if (req.method === "GET" && url.pathname === "/ddns-plus/nodes") {
      json(res, nodes);
      return;
    }
    if (req.method === "GET" && url.pathname === "/ddns-plus/logs") {
      json(res, { logs, total: logs.length });
      return;
    }
    if (req.method === "POST" && url.pathname === "/ddns-plus/settings/test") {
      await new Promise((resolve) => setTimeout(resolve, 450));
      json(res, { message: "API Token 验证成功，可读取 2 个有效 Zone，并具备 DNS 记录读取权限。", zoneCount: 2 });
      return;
    }
    if (req.method === "POST" && url.pathname === "/ddns-plus/settings") {
      const body = await readBody(req);
      settings = {
        ...settings,
        notify: Boolean(body.notify),
        compareMode: body.compareMode === "cloudflare" ? "cloudflare" : "local",
        intervalMinutes: Number(body.intervalMinutes) || 1,
        updatedAt: new Date().toISOString(),
      };
      json(res, {
        settings,
      });
      return;
    }
    if (req.method === "POST" && url.pathname === "/ddns-plus/pause") {
      const body = await readBody(req);
      settings = { ...settings, paused: Boolean(body.paused) };
      json(res, { paused: settings.paused });
      return;
    }
    if (req.method === "POST" && url.pathname === "/ddns-plus/records/batch") {
      const body = await readBody(req);
      const count = String(body.domains || "").split(/[\s,;]+/).filter(Boolean).length;
      json(res, { groupsAdded: Array.isArray(body.nodeUuids) ? body.nodeUuids.length : 1, recordsAdded: count, totalRecords: records.length + count, records: [] });
      return;
    }
    if (req.method === "POST" && url.pathname === "/ddns-plus/groups/update") {
      const body = await readBody(req);
      groups = groups.map((group) =>
        group.id === body.groupId
          ? {
              ...group,
              domains: String(body.domains || "")
                .split(/[\s,;]+/)
                .filter(Boolean),
              mode: body.mode || group.mode,
              ttl: Number(body.ttl) || group.ttl,
              proxied: Boolean(body.proxied),
              intervalMinutes: Number(body.intervalMinutes) || group.intervalMinutes,
            }
          : group,
      );
      json(res, { ok: true, removedTargets: 0 });
      return;
    }
    if (req.method === "POST" && url.pathname === "/ddns-plus/records/bulk") {
      const body = await readBody(req);
      if (body.action === "delete") {
        records = records.filter((record) => !(body.ids || []).includes(record.groupId));
        groups = groups.filter((group) => !(body.ids || []).includes(group.id));
      }
      json(res, { ok: true, affectedGroups: (body.ids || []).length });
      return;
    }
    if (req.method === "POST" && url.pathname === "/ddns-plus/sync") {
      sync = { ...sync, running: true, total: records.length, completed: 0, changed: 0, skipped: 0, errors: 0, message: "" };
      json(res, { ok: true, job: sync });
      setTimeout(() => {
        sync = {
          running: false,
          total: records.length,
          completed: records.length,
          changed: 1,
          skipped: records.length - 2,
          errors: 1,
          message: `同步完成：共 ${records.length} 条，变更 1 条，跳过 ${Math.max(0, records.length - 2)} 条，失败 1 条。`,
          finishedAt: new Date().toISOString(),
        };
      }, 1800);
      return;
    }
    if (req.method === "DELETE" && url.pathname === "/ddns-plus/logs") {
      json(res, { ok: true });
      return;
    }
  }
  staticFile(res, url.pathname.replace(/^\/+/, ""));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Komari DDNS Plus preview: http://127.0.0.1:${port}`);
});
