import * as fs from "node:fs";
import * as path from "node:path";
import {
  DdnsRecord,
  LogEntry,
  MAX_LOGS,
  RecordStatus,
  Settings,
} from "./types";
import { nowIso, stableId } from "./util";

const DEFAULT_SETTINGS: Settings = {
  version: 1,
  authMode: "token",
  token: "",
  email: "",
  apiKey: "",
  notify: false,
  paused: false,
  intervalMinutes: 1,
  updatedAt: "",
};

export class Storage {
  readonly baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  ensure(): void {
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  private file(name: string): string {
    return path.join(this.baseDir, name);
  }

  private readJson<T>(name: string, fallback: T): T {
    const file = this.file(name);
    if (!fs.existsSync(file)) return fallback;
    try {
      return JSON.parse(fs.readFileSync(file, "utf8")) as T;
    } catch (error) {
      console.error(`[ddns-plus] failed to read ${name}:`, error);
      return fallback;
    }
  }

  private writeJson(name: string, value: unknown, privateFile = false): void {
    this.ensure();
    const target = this.file(name);
    const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
    const serialized = JSON.stringify(value, null, 2);
    fs.writeFileSync(temp, serialized, { encoding: "utf8", mode: privateFile ? 0o600 : 0o644 });
    fs.renameSync(temp, target);
    if (privateFile) {
      try {
        fs.chmodSync(target, 0o600);
      } catch {
        // Some platforms do not expose POSIX modes.
      }
    }
  }

  loadSettings(): Settings {
    const raw = this.readJson<Partial<Settings>>("settings.json", {});
    return {
      ...DEFAULT_SETTINGS,
      ...raw,
      version: 1,
      authMode: raw.authMode === "key" ? "key" : "token",
      token: typeof raw.token === "string" ? raw.token : "",
      email: typeof raw.email === "string" ? raw.email : "",
      apiKey: typeof raw.apiKey === "string" ? raw.apiKey : "",
      notify: Boolean(raw.notify),
      paused: Boolean(raw.paused),
      intervalMinutes: Number(raw.intervalMinutes) || 1,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
    };
  }

  saveSettings(settings: Settings): void {
    this.writeJson("settings.json", settings, true);
  }

  loadRecords(): DdnsRecord[] {
    const raw = this.readJson<unknown>("records.json", []);
    if (!Array.isArray(raw)) return [];
    const records = raw.filter((record): record is DdnsRecord => {
      return (
        Boolean(record) &&
        typeof record === "object" &&
        typeof (record as DdnsRecord).id === "string" &&
        typeof (record as DdnsRecord).domain === "string" &&
        ((record as DdnsRecord).type === "A" || (record as DdnsRecord).type === "AAAA") &&
        typeof (record as DdnsRecord).nodeUuid === "string"
      );
    });
    let migrated = false;
    for (const record of records) {
      if (typeof record.groupId === "string" && /^[a-zA-Z0-9-]{8,64}$/.test(record.groupId)) {
        continue;
      }
      const legacyKey = [
        "legacy",
        record.nodeUuid,
        record.ttl,
        Boolean(record.proxied),
        Boolean(record.enabled),
        record.intervalMinutes,
        Boolean(record.adoptExisting),
      ].join("|");
      record.groupId = stableId(legacyKey);
      migrated = true;
    }
    if (migrated) this.saveRecords(records);
    return records;
  }

  saveRecords(records: DdnsRecord[]): void {
    this.writeJson("records.json", records);
  }

  loadStatuses(): Record<string, RecordStatus> {
    const raw = this.readJson<Record<string, RecordStatus>>("status.json", {});
    return raw && typeof raw === "object" ? raw : {};
  }

  saveStatuses(statuses: Record<string, RecordStatus>): void {
    this.writeJson("status.json", statuses, true);
  }

  loadLogs(): LogEntry[] {
    const raw = this.readJson<unknown>("logs.json", []);
    return Array.isArray(raw) ? (raw as LogEntry[]) : [];
  }

  appendLog(entry: Omit<LogEntry, "id" | "at"> & { id?: string; at?: string }): void {
    const logs = this.loadLogs();
    logs.push({
      ...entry,
      id: entry.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      at: entry.at || nowIso(),
    });
    this.writeJson("logs.json", logs.slice(-MAX_LOGS));
  }

  clearLogs(): void {
    this.writeJson("logs.json", []);
  }
}
