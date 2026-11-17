import { afterEach, describe, expect, it } from "vitest";
import { initEmailFromEnv, resendTransport } from "../src/email.js";

// Unit tests — no network, no DB. The fetch is injected.

function fakeFetch(status: number, body = "") {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init: init! });
    return new Response(body, { status });
  }) as typeof fetch;
  return { fn, calls };
}

describe("resendTransport", () => {
  it("POSTs the email to Resend with auth and the from address", async () => {
    const { fn, calls } = fakeFetch(200);
    const t = resendTransport("key-123", "Rave Reviews <login@rave.reviews>", fn);
    await t.send({ to: "friend@x.io", subject: "hi", text: "link here" });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://api.resend.com/emails");
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer key-123");
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      from: "Rave Reviews <login@rave.reviews>",
      to: "friend@x.io",
      subject: "hi",
      text: "link here",
    });
  });

  it("throws on a non-2xx response so failures are visible", async () => {
    const { fn } = fakeFetch(422, "invalid from");
    const t = resendTransport("key-123", "bad", fn);
    await expect(t.send({ to: "a@x.io", subject: "s", text: "t" })).rejects.toThrow(
      /resend send failed: 422/,
    );
  });
});

describe("initEmailFromEnv", () => {
  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    initEmailFromEnv(); // restore the console default for other tests
  });

  it("selects Resend when both env vars are set", () => {
    process.env.RESEND_API_KEY = "key";
    process.env.EMAIL_FROM = "login@rave.reviews";
    expect(initEmailFromEnv()).toMatch(/^resend/);
  });

  it("falls back to console when either var is missing", () => {
    process.env.RESEND_API_KEY = "key";
    expect(initEmailFromEnv()).toMatch(/^console/);
  });
});
