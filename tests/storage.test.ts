import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Storage } from "../src/storage";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("storage migration", () => {
  it("assigns a stable group id to legacy flat records", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ddns-plus-storage-"));
    dirs.push(dir);
    const storage = new Storage(dir);
    storage.ensure();
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
});
