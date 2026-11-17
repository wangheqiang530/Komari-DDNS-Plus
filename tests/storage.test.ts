import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Storage } from "../src/storage";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function makeStorage(): { dir: string; storage: Storage } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ddns-plus-storage-"));
  dirs.push(dir);
  const storage = new Storage(dir);
  storage.ensure();
  return { dir, storage };
}

describe("storage migration", () => {
  it("assigns a stable group id to legacy flat records", () => {
    const { dir, storage } = makeStorage();
    fs.writeFileSync(
      path.join(dir, "records.json"),
      JSON.stringify([
        {
          id: "legacy-a",
          domain: "home.example.com",
          type: "A",
          nodeUuid: "node-0001",
          ttl: 1,
          proxied: false,
          enabled: true,
          intervalMinutes: 1,
          adoptExisting: false,
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "legacy-aaaa",
          domain: "home.example.com",
          type: "AAAA",
          nodeUuid: "node-0001",
          ttl: 1,
          proxied: false,
          enabled: true,
          intervalMinutes: 1,
          adoptExisting: false,
          createdAt: "",
          updatedAt: "",
        },
      ]),
    );
    const first = storage.loadRecords();
    const second = storage.loadRecords();
    expect(first[0].groupId).toMatch(/^[a-f0-9]{24}$/);
    expect(first[0].groupId).toBe(first[1].groupId);
    expect(second[0].groupId).toBe(first[0].groupId);
  });

  it("backs up a corrupt data file instead of silently overwriting it", () => {
    const { dir, storage } = makeStorage();
    const file = path.join(dir, "records.json");
    const broken = '{ "records": [ This is not valid JSON';
    fs.writeFileSync(file, broken);

    const records = storage.loadRecords();
    expect(records).toEqual([]);

    const backups = fs.readdirSync(dir).filter((name) => name.includes("records.json.corrupt-"));
    expect(backups).toHaveLength(1);
    expect(fs.readFileSync(path.join(dir, backups[0]), "utf8")).toBe(broken);

    // 问题必须能上报出去，否则用户完全感觉不到数据丢了。
    const issues = storage.drainIssues();
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("records.json");
    expect(storage.drainIssues()).toEqual([]);
  });

  it("keeps the most recent logs and flushes them to disk", () => {
    const { dir, storage } = makeStorage();
    for (let index = 0; index < 5; index++) {
      storage.appendLog({ level: "info", action: "sync", message: "entry-" + index });
    }
    storage.flushLogs();
    const raw = JSON.parse(fs.readFileSync(path.join(dir, "logs.json"), "utf8"));
    expect(raw).toHaveLength(5);
    expect(raw[4].message).toBe("entry-4");

    storage.clearLogs();
    expect(JSON.parse(fs.readFileSync(path.join(dir, "logs.json"), "utf8"))).toEqual([]);
  });

  it("falls back to the default reconcile interval for bad settings", () => {
    const { dir, storage } = makeStorage();
    fs.writeFileSync(
      path.join(dir, "settings.json"),
      JSON.stringify({ version: 1, authMode: "token", reconcileHours: 9999 }),
    );
    expect(storage.loadSettings().reconcileHours).toBe(1);
  });
});
