import { BatchInput, DdnsRecord } from "./types";
import { makeId, normalizeRecord, nowIso } from "./util";

export function expandBatch(input: BatchInput, settingsInterval: number): DdnsRecord[] {
  const types: Array<"A" | "AAAA"> =
    input.mode === "v4" ? ["A"] : input.mode === "v6" ? ["AAAA"] : ["A", "AAAA"];
  const records: DdnsRecord[] = [];
  const at = nowIso();
  for (const nodeUuid of input.nodeUuids) {
    for (const domain of input.domains) {
      for (const type of types) {
        records.push(
          normalizeRecord({
            id: makeId(),
            domain,
            type,
            nodeUuid,
            ttl: input.ttl,
            proxied: input.proxied,
            enabled: input.enabled,
            intervalMinutes: input.intervalMinutes || settingsInterval,
            adoptExisting: input.adoptExisting,
            createdAt: at,
            updatedAt: at,
          }),
        );
      }
    }
  }
  return records;
}
