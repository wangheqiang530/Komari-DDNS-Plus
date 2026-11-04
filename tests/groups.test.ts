import { describe, expect, it } from "vitest";
import { groupRecords } from "../src/groups";
import { DdnsRecord } from "../src/types";

function record(overrides: Partial<DdnsRecord>): DdnsRecord {
  return {
    id: "record-0001",
    groupId: "group-0001",
    domain: "home.example.com",
    type: "A",
    nodeUuid: "node-0001",
    ttl: 1,
    proxied: false,
    enabled: true,
    intervalMinutes: 1,
    adoptExisting: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("rule groups", () => {
  it("groups A and AAAA targets into one dual-stack node rule", () => {
    const groups = groupRecords([
      record({ id: "record-a", type: "A" }),
      record({ id: "record-aaaa", type: "AAAA" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].mode).toBe("dual");
    expect(groups[0].domains).toEqual(["home.example.com"]);
    expect(groups[0].recordIds).toEqual(["record-a", "record-aaaa"]);
  });

  it("allows the same node to own multiple independent groups", () => {
    const groups = groupRecords([
      record({ id: "record-v4", groupId: "group-v4", type: "A" }),
      record({ id: "record-v6", groupId: "group-v6", type: "AAAA" }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.mode).sort()).toEqual(["v4", "v6"]);
  });
});
