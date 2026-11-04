import { describe, expect, it } from "vitest";
import { expandBatch } from "../src/batch";

describe("batch expansion", () => {
  it("expands nodes, domains and dual-stack records", () => {
    const records = expandBatch(
      {
        nodeUuids: ["node-a", "node-b"],
        domains: ["a.example.com", "b.example.com"],
        mode: "dual",
        ttl: 300,
        proxied: false,
        intervalMinutes: 5,
        enabled: true,
        adoptExisting: false,
      },
      1,
    );
    expect(records).toHaveLength(8);
    expect(records.filter((record) => record.type === "A")).toHaveLength(4);
    expect(records.filter((record) => record.type === "AAAA")).toHaveLength(4);
    expect(new Set(records.map((record) => record.id)).size).toBe(8);
  });

  it("forces auto TTL when proxied", () => {
    const [record] = expandBatch(
      {
        nodeUuids: ["node-a"],
        domains: ["a.example.com"],
        mode: "v4",
        ttl: 3600,
        proxied: true,
        intervalMinutes: 1,
        enabled: true,
        adoptExisting: true,
      },
      5,
    );
    expect(record.ttl).toBe(1);
    expect(record.adoptExisting).toBe(true);
  });
});
