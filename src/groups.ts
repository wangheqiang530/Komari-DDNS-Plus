import { DdnsRecord, RuleGroup } from "./types";

export function groupRecords(records: DdnsRecord[]): RuleGroup[] {
  const grouped = new Map<string, DdnsRecord[]>();
  for (const record of records) {
    const key = record.groupId || record.id;
    const items = grouped.get(key) || [];
    items.push(record);
    grouped.set(key, items);
  }

  const result: RuleGroup[] = [];
  for (const [id, items] of grouped) {
    const first = items[0];
    if (!first) continue;
    const domains: string[] = [];
    const seenDomains = new Set<string>();
    const types = new Set<string>();
    for (const item of items) {
      if (!seenDomains.has(item.domain)) {
        seenDomains.add(item.domain);
        domains.push(item.domain);
      }
      types.add(item.type);
    }
    const mode = types.has("A") && types.has("AAAA") ? "dual" : types.has("AAAA") ? "v6" : "v4";
    const createdAt = items.reduce(
      (oldest, item) => (item.createdAt && item.createdAt < oldest ? item.createdAt : oldest),
      first.createdAt || "",
    );
    const updatedAt = items.reduce(
      (newest, item) => (item.updatedAt && item.updatedAt > newest ? item.updatedAt : newest),
      first.updatedAt || "",
    );
    result.push({
      id,
      nodeUuid: first.nodeUuid,
      domains,
      mode,
      ttl: first.ttl,
      proxied: first.proxied,
      enabled: first.enabled,
      intervalMinutes: first.intervalMinutes,
      adoptExisting: first.adoptExisting,
      recordIds: items.map((item) => item.id),
      createdAt,
      updatedAt,
    });
  }
  return result.sort((left, right) => {
    const node = left.nodeUuid.localeCompare(right.nodeUuid);
    return node || left.createdAt.localeCompare(right.createdAt);
  });
}

export function recordsForGroup(records: DdnsRecord[], groupId: string): DdnsRecord[] {
  return records.filter((record) => record.groupId === groupId);
}
