import * as fs from "node:fs";
import * as path from "node:path";
import {
  DdnsRecord,
  LogEntry,
  MAX_LOGS,
  RecordStatus,
  RECONCILE_DEFAULT_HOURS,
  RECONCILE_MAX_HOURS,
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
  compareMode: "local",
  intervalMinutes: 1,
  reconcileHours: RECONCILE_DEFAULT_HOURS,
  updatedAt: "",
};

const LOG_FLUSH_DELAY_MS = 100;

export class Storage {
  readonly baseDir: string;
  private logCache: LogEntry[] | null = null;
  private logTimer: ReturnType<typeof setTimeout> | null = null;
  private issues: string[] = [];

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  ensure(): void {
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  private file(name: string): string {
    return path.join(this.baseDir, name);
  }

  /**
   * 读取 JSON 文件。解析失败时把原文件另存为 <name>.corrupt-<ts> 备份，
   * 避免后续保存把用户数据静默覆盖成默认值。
   */
  private readJson<T>(name: string, fallback: T): T {
    const file = this.file(name);
    if (!fs.existsSync(file)) return fallback;
    let text: string;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch (error) {
      this.recordIssue(name, "读取失败", error);
      return fallback;
    }
    if (!text.trim()) return fallback;
    try {
      return JSON.parse(text) as T;
    } catch (error) {
      this.recordIssue(name, "内容损坏", error, text);
      return fallback;
    }
  }

  private recordIssue(name: string, reason: string, error: unknown, content?: string): void {
    const detail = error instanceof Error ? error.message : String(error);
    let backupNote = "";
    if (content !== undefined) {
      try {
        const backup = this.file(`${name}.corrupt-${Date.now()}`);
        fs.writeFileSync(backup, content, { encoding: "utf8", mode: 0o600 });
        backupNote = `，原文件已备份为 ${path.basename(backup)}`;
      } catch {
        backupNote = "，备份失败";
      }
    }
    const message = `${name} ${reason}：${detail}${backupNote}`;
    this.issues.push(message);
    console.error(`[ddns-plus] ${message}`);
  }

  /** 取出并清空本次进程内记录到的存储异常，供上层写日志。 */
  drainIssues(): string[] {
    if (!this.issues.length) return [];
    const pending = this.issues;
    this.issues = [];
    return pending;
  }

  private writeJson(name: string, value: unknown, privateFile = false): void {
    this.ensure();
    const target = this.file(name);
    const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
    const serialized = JSON.stringify(value, null, 2);
    const mode = privateFile ? 0o600 : 0o644;
    const handle = fs.openSync(temp, "w", mode);
    try {
      fs.writeFileSync(handle, serialized, { encoding: "utf8" });
      fs.fsyncSync(handle);
    } finally {
      fs.closeSync(handle);
    }
    fs.renameSync(temp, target);
    if (privateFile) {
      try {
        fs.chmodSync(target, 0o600);
      } catch {
        // Some platforms do not expose POSIX modes.
      }
    }
    try {
      const dirHandle = fs.openSync(this.baseDir, "r");
      try {
        fs.fsyncSync(dirHandle);
      } finally {
        fs.closeSync(dirHandle);
      }
    } catch {
      // Directory fsync is not supported everywhere.
    }
  }

  loadSettings(): Settings {
    const raw = this.readJson<Partial<Settings>>("settings.json", {});
    const reconcile = Number(raw.reconcileHours);
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
      compareMode: raw.compareMode === "cloudflare" ? "cloudflare" : "local",
      intervalMinutes: Number(raw.intervalMinutes) || 1,
      reconcileHours:
        Number.isFinite(reconcile) && reconcile >= 0 && reconcile <= RECONCILE_MAX_HOURS
          ? reconcile
          : RECONCILE_DEFAULT_HOURS,
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

  private logs(): LogEntry[] {
    if (this.logCache === null) {
      const raw = this.readJson<unknown>("logs.json", []);
      this.logCache = Array.isArray(raw) ? (raw as LogEntry[]) : [];
    }
    return this.logCache;
  }

  loadLogs(): LogEntry[] {
    return this.logs().slice();
  }

  appendLog(entry: Omit<LogEntry, "id" | "at"> & { id?: string; at?: string }): void {
    const logs = this.logs();
    logs.push({
      ...entry,
      id: entry.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      at: entry.at || nowIso(),
    });
    if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS);
    if (this.logTimer) return;
    this.logTimer = setTimeout(() => {
      this.logTimer = null;
      this.flushLogs();
    }, LOG_FLUSH_DELAY_MS);
    const timer = this.logTimer as unknown as { unref?: () => void };
    if (typeof timer.unref === "function") timer.unref();
  }

  /** 立即把内存中的日志写入磁盘（批量写入前的合并点）。 */
  flushLogs(): void {
    if (this.logTimer) {
      clearTimeout(this.logTimer);
      this.logTimer = null;
    }
    if (this.logCache === null) return;
    this.writeJson("logs.json", this.logCache);
  }

  clearLogs(): void {
    if (this.logTimer) {
      clearTimeout(this.logTimer);
      this.logTimer = null;
    }
    this.logCache = [];
    this.writeJson("logs.json", []);
  }
}
