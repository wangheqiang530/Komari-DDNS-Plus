import { describe, expect, it } from "vitest";
import {
  normalizeRecord,
  normalizeSettings,
  normalizeTtl,
  parseDomains,
  publicSettings,
  resolveCredentials,
} from "../src/util";

describe("domain and settings validation", () => {
  it("normalizes and deduplicates batch domains", () => {
    expect(parseDomains("Home.Example.com.\nV6.example.com, home.example.com")).toEqual([
      "home.example.com",
      "v6.example.com",
    ]);
  });

  it("accepts wildcard domains but rejects URLs and empty labels", () => {
    expect(parseDomains("*.example.com")).toEqual(["*.example.com"]);
    expect(() => parseDomains("https://example.com")).toThrow();
    expect(() => parseDomains("bad..example.com")).toThrow();
  });

  it("never exposes saved secrets", () => {
    const settings = normalizeSettings({
      authMode: "token",
      token: "t".repeat(40),
      intervalMinutes: 1,
      notify: true,
    });
    const exposed = publicSettings(settings);
    expect(exposed.hasToken).toBe(true);
    expect(exposed.compareMode).toBe("local");
    expect(exposed).not.toHaveProperty("token");
    expect(JSON.stringify(exposed)).not.toContain("t".repeat(40));
  });

  it("preserves the saved key when the email is unchanged", () => {
    const previous = normalizeSettings({
      authMode: "key",
      email: "admin@example.com",
      apiKey: "k".repeat(37),
      intervalMinutes: 5,
    });
    const next = normalizeSettings(
      {
        authMode: "key",
        email: "admin@example.com",
        apiKey: "",
        intervalMinutes: 5,
      },
      previous,
    );
    expect(next.apiKey).toBe(previous.apiKey);
  });

  it("requires a new key when switching the email", () => {
    const previous = normalizeSettings({
      authMode: "key",
      email: "admin@example.com",
      apiKey: "k".repeat(37),
      intervalMinutes: 5,
    });
    expect(() =>
      normalizeSettings(
        {
          authMode: "key",
          email: "other@example.com",
          apiKey: "",
          intervalMinutes: 5,
        },
        previous,
      ),
    ).toThrow(/必须同时填写/);
  });

  it("resolves transient credentials without leaking them", () => {
    const saved = normalizeSettings({
      authMode: "token",
      token: "t".repeat(40),
      intervalMinutes: 1,
    });
    expect(
      resolveCredentials({ authMode: "token", token: "" }, saved).token,
    ).toBe(saved.token);
  });

  it("forces auto TTL for proxied records", () => {
    expect(normalizeTtl(3600, true)).toBe(1);
    expect(() => normalizeTtl(42, false)).toThrow();
  });

  it("normalizes a complete DNS rule", () => {
    const record = normalizeRecord({
      id: "record-0001",
      domain: "Home.Example.com.",
      type: "A",
      nodeUuid: "node-0001",
      ttl: 60,
      proxied: false,
      enabled: true,
      intervalMinutes: 1,
      adoptExisting: false,
    });
    expect(record.domain).toBe("home.example.com");
    expect(record.type).toBe("A");
    expect(record.ttl).toBe(60);
  });

  it("rejects string booleans instead of coercing them", () => {
    expect(() =>
      normalizeSettings({
        authMode: "token",
        token: "t".repeat(40),
        notify: "false",
      }),
    ).toThrow(/通知开关/);
    expect(() =>
      normalizeRecord({
        id: "record-0001",
        domain: "home.example.com",
        type: "A",
        nodeUuid: "node-0001",
        ttl: 1,
        proxied: "false",
        enabled: true,
        intervalMinutes: 1,
        adoptExisting: false,
      }),
    ).toThrow(/代理开关/);
  });

  it("validates the IP comparison mode", () => {
    const settings = normalizeSettings({
      authMode: "token",
      token: "t".repeat(40),
      compareMode: "cloudflare",
    });
    expect(settings.compareMode).toBe("cloudflare");
    expect(() =>
      normalizeSettings({
        authMode: "token",
        token: "t".repeat(40),
        compareMode: "dns",
      }),
    ).toThrow(/对比方式/);
  });
});
