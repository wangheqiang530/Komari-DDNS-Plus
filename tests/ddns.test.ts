import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CloudflareClient } from "../src/cloudflare";
import { SyncEngine } from "../src/ddns";
import { Storage } from "../src/storage";
import { CloudflareRecord, DdnsRecord, Settings } from "../src/types";
import { recordMarker } from "../src/util";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function makeStorage(): Storage {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ddns-plus-test-"));
  dirs.push(dir);
  const storage = new Storage(dir);
  storage.ensure();
  return storage;
}

function settings(authMode: "token" | "key" = "token"): Settings {
  return {
    version: 1,
    authMode,
    token: authMode === "token" ? "t".repeat(40) : "",
    email: authMode === "key" ? "admin@example.com" : "",
    apiKey: authMode === "key" ? "k".repeat(37) : "",
    notify: false,
    intervalMinutes: 1,
    updatedAt: "",
  };
}

function rule(overrides: Partial<DdnsRecord> = {}): DdnsRecord {
  return {
    id: "record-0001",
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
    ...overrides,
  };
}

function mockClient(initial: any[] = []): {
  client: CloudflareClient;
  records: any[];
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
} {
  const records = initial.slice();
  let next = records.length + 1;
  const create = vi.fn(async (_zone: string, payload: Record<string, unknown>) => {
    const record = { id: "dns-" + next++, ...payload } as CloudflareRecord;
    records.push(record);
    return record;
  });
  const update = vi.fn(async (_zone: string, id: string, payload: Record<string, unknown>) => {
    const index = records.findIndex((record) => record.id === id);
    records[index] = { ...records[index], ...payload };
    return records[index];
  });
  const client: CloudflareClient = {
    test: async () => ({ message: "ok", zoneCount: 1 }),
    listZones: async () => [{ id: "zone-1", name: "example.com", status: "active" }],
    zoneFor: async () => ({ id: "zone-1", name: "example.com", status: "active" }),
    listRecords: async () => records.slice(),
    createRecord: create,
    updateRecord: update,
    deleteRecord: async () => undefined,
  };
  return { client, records, create, update };
}

async function waitForIdle(engine: SyncEngine): Promise<void> {
  for (let index = 0; index < 100; index++) {
    if (!engine.snapshot().job.running) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("sync did not finish");
}

describe("SyncEngine", () => {
  it("creates a managed DNS record and stores status", async () => {
    const storage = makeStorage();
    storage.saveSettings(settings());
    storage.saveRecords([rule()]);
    const mock = mockClient();
    const notify = vi.fn(async () => undefined);
    const engine = new SyncEngine({
      storage,
      getNodes: async () => [
        {
          uuid: "node-0001",
          name: "HK1",
          ipv4: "8.8.8.8",
          ipv6: "2001:4860:4860::8888",
          online: true,
          group: "",
        },
      ],
      notify,
      createClient: () => mock.client,
    });

    engine.start();
    await waitForIdle(engine);
    expect(mock.records).toHaveLength(1);
    expect(mock.records[0].content).toBe("8.8.8.8");
    expect(mock.records[0].comment).toBe(recordMarker("record-0001"));
    expect(engine.snapshot().statuses["record-0001"].state).toBe("success");
    expect(engine.snapshot().job.changed).toBe(1);
  });

  it("supports A and AAAA records for the same domain", async () => {
    const storage = makeStorage();
    storage.saveSettings(settings());
    storage.saveRecords([
      rule({ id: "record-a", type: "A" }),
      rule({ id: "record-aaaa", type: "AAAA" }),
    ]);
    const mock = mockClient();
    const engine = new SyncEngine({
      storage,
      getNodes: async () => [
        {
          uuid: "node-0001",
          name: "HK1",
          ipv4: "8.8.8.8",
          ipv6: "2001:4860:4860::8888",
          online: true,
          group: "",
        },
      ],
      notify: async () => undefined,
      createClient: () => mock.client,
    });
    engine.start();
    await waitForIdle(engine);
    expect(mock.records.map((record) => record.type).sort()).toEqual(["A", "AAAA"]);
  });

  it("does not overwrite an unmanaged record unless adoption is explicit", async () => {
    const storage = makeStorage();
    storage.saveSettings(settings());
    storage.saveRecords([rule()]);
    const mock = mockClient([
      {
        id: "manual",
        type: "A",
        name: "home.example.com",
        content: "1.1.1.1",
        ttl: 1,
        proxied: false,
        comment: "",
      },
    ]);
    const engine = new SyncEngine({
      storage,
      getNodes: async () => [
        {
          uuid: "node-0001",
          name: "HK1",
          ipv4: "8.8.8.8",
          ipv6: "",
          online: true,
          group: "",
        },
      ],
      notify: async () => undefined,
      createClient: () => mock.client,
    });
    engine.start();
    await waitForIdle(engine);
    expect(mock.update).not.toHaveBeenCalled();
    expect(engine.snapshot().statuses["record-0001"].state).toBe("error");
  });

  it("skips offline nodes without deleting the existing record", async () => {
    const storage = makeStorage();
    storage.saveSettings(settings());
    storage.saveRecords([rule()]);
    const mock = mockClient([
      {
        id: "existing",
        type: "A",
        name: "home.example.com",
        content: "8.8.8.8",
        ttl: 1,
        proxied: false,
        comment: recordMarker("record-0001"),
      },
    ]);
    const engine = new SyncEngine({
      storage,
      getNodes: async () => [
        {
          uuid: "node-0001",
          name: "HK1",
          ipv4: "8.8.8.8",
          ipv6: "",
          online: false,
          group: "",
        },
      ],
      notify: async () => undefined,
      createClient: () => mock.client,
    });
    engine.start();
    await waitForIdle(engine);
    expect(mock.update).not.toHaveBeenCalled();
    expect(engine.snapshot().statuses["record-0001"].state).toBe("skipped");
    expect(engine.snapshot().job.skipped).toBe(1);
  });
});
