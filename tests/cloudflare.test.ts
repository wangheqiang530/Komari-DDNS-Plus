import { describe, expect, it, vi } from "vitest";
import { CloudflareError, createCloudflareClient } from "../src/cloudflare";

function jsonResponse(value: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", ...(headers || {}) },
  });
}

describe("Cloudflare client", () => {
  it("uses Bearer authentication for API tokens", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({ success: true, result: { status: "active" } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          result: [{ id: "zone-1", name: "example.com", status: "active" }],
          result_info: { total_pages: 1 },
        }),
      );
    const client = createCloudflareClient(
      {
        authMode: "token",
        token: "t".repeat(40),
        email: "",
        apiKey: "",
      },
      fetcher,
    );
    const result = await client.test();
    expect(result.zoneCount).toBe(1);
    const headers = fetcher.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer " + "t".repeat(40));
  });

  it("uses email and X-Auth-Key for Global API Keys", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ success: true, result: { id: "user-1" } }))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          result: [],
          result_info: { total_pages: 1 },
        }),
      );
    const client = createCloudflareClient(
      {
        authMode: "key",
        token: "",
        email: "admin@example.com",
        apiKey: "k".repeat(37),
      },
      fetcher,
    );
    await client.test();
    const headers = fetcher.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["X-Auth-Email"]).toBe("admin@example.com");
    expect(headers["X-Auth-Key"]).toBe("k".repeat(37));
  });

  it("maps Cloudflare 6003 to a credential format error", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse(
        {
          success: false,
          errors: [{ code: 6003, message: "Invalid request headers" }],
        },
        400,
      ),
    );
    const client = createCloudflareClient(
      {
        authMode: "token",
        token: "t".repeat(40),
        email: "",
        apiKey: "",
      },
      fetcher,
    );
    const error = await client.test().catch((caught) => caught);
    expect(error).toBeInstanceOf(CloudflareError);
    expect(error).toMatchObject({
      name: "CloudflareError",
      status: 400,
      code: 6003,
    });
  });

  it("selects the longest matching zone", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        success: true,
        result: [
          { id: "zone-root", name: "example.com", status: "active" },
          { id: "zone-sub", name: "sub.example.com", status: "active" },
        ],
        result_info: { total_pages: 1 },
      }),
    );
    const client = createCloudflareClient(
      {
        authMode: "token",
        token: "t".repeat(40),
        email: "",
        apiKey: "",
      },
      fetcher,
    );
    const zone = await client.zoneFor("home.sub.example.com");
    expect(zone.id).toBe("zone-sub");
  });
});
