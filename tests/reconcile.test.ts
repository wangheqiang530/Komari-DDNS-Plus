import { describe, expect, it } from "vitest";
import { needsReconcile } from "../src/util";
import { RecordStatus } from "../src/types";

function status(lastReconciledAt?: string): RecordStatus {
  return { state: "success", lastCheckedAt: "", lastReconciledAt };
}

describe("reconcile scheduling", () => {
  it("is disabled when the interval is zero or invalid", () => {
    const old = "2000-01-01T00:00:00.000Z";
    expect(needsReconcile(status(old), 0, "record-0001")).toBe(false);
    expect(needsReconcile(status(old), -1, "record-0001")).toBe(false);
    expect(needsReconcile(status(old), Number.NaN, "record-0001")).toBe(false);
  });

  it("reconciles immediately when the record was never reconciled", () => {
    expect(needsReconcile(undefined, 1, "record-0001")).toBe(true);
    expect(needsReconcile(status(undefined), 1, "record-0001")).toBe(true);
  });

  it("reconciles when the stored timestamp is unparsable", () => {
    expect(needsReconcile(status("not-a-date"), 1, "record-0001")).toBe(true);
  });

  it("waits for the window to elapse", () => {
    const now = Date.parse("2026-01-01T12:00:00.000Z");
    const recent = new Date(now - 10 * 60 * 1000).toISOString();
    expect(needsReconcile(status(recent), 1, "record-0001", now)).toBe(false);
    const stale = new Date(now - 90 * 60 * 1000).toISOString();
    expect(needsReconcile(status(stale), 1, "record-0001", now)).toBe(true);
  });

  it("spreads records across a jitter window of about +/-10%", () => {
    const hours = 1;
    const windowMs = hours * 3600 * 1000;
    const now = Date.parse("2026-01-01T12:00:00.000Z");
    const ids = Array.from({ length: 200 }, (_v, index) => "record-" + index);
    const fireOffsets = ids.map((id) => {
      // 二分查找每条记录的触发时刻，用来观察抖动分布。
      let low = 0;
      let high = windowMs * 1.5;
      for (let step = 0; step < 40; step++) {
        const mid = (low + high) / 2;
        if (needsReconcile(status(new Date(now - mid).toISOString()), hours, id, now)) high = mid;
        else low = mid;
      }
      return (low + high) / 2;
    });
    const min = Math.min(...fireOffsets);
    const max = Math.max(...fireOffsets);
    expect(min).toBeGreaterThan(windowMs * 0.85);
    expect(max).toBeLessThan(windowMs * 1.15);
    // 必须真的错峰：不能所有记录落在同一个时刻。
    expect(max - min).toBeGreaterThan(windowMs * 0.1);
  });
});
