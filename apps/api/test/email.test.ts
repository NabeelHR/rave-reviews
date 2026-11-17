import { afterEach, describe, expect, it } from "vitest";
import { gmailTransport, initEmailFromEnv, resendTransport } from "../src/email.js";
import type { SmtpMailer } from "../src/email.js";

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

describe("gmailTransport", () => {
  it("sends via the injected SMTP mailer with a friendly from", async () => {
    const calls: Parameters<SmtpMailer["sendMail"]>[0][] = [];
    const mailer: SmtpMailer = {
      async sendMail(opts) {
        calls.push(opts);
      },
    };
    const t = gmailTransport("nabeel@gmail.com", "app-password", mailer);
    await t.send({ to: "friend@x.io", subject: "hi", text: "link here" });

    expect(calls).toEqual([
      {
        from: "Rave Reviews <nabeel@gmail.com>",
        to: "friend@x.io",
        subject: "hi",
        text: "link here",
      },
    ]);
  });

  it("propagates SMTP failures so they are visible", async () => {
    const mailer: SmtpMailer = {
      async sendMail() {
        throw new Error("535 bad credentials");
      },
    };
    const t = gmailTransport("u@gmail.com", "wrong", mailer);
    await expect(t.send({ to: "a@x.io", subject: "s", text: "t" })).rejects.toThrow(/535/);
  });
});

describe("initEmailFromEnv", () => {
  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    initEmailFromEnv(); // restore the console default for other tests
  });

  it("selects Resend when both resend vars are set", () => {
    process.env.RESEND_API_KEY = "key";
    process.env.EMAIL_FROM = "login@rave.reviews";
    expect(initEmailFromEnv()).toMatch(/^resend/);
  });

  it("selects Gmail SMTP when gmail vars are set and resend is not", () => {
    process.env.GMAIL_USER = "nabeel@gmail.com";
    process.env.GMAIL_APP_PASSWORD = "app-password";
    expect(initEmailFromEnv()).toMatch(/^gmail smtp/);
  });

  it("prefers Resend over Gmail when both are configured", () => {
    process.env.RESEND_API_KEY = "key";
    process.env.EMAIL_FROM = "login@rave.reviews";
    process.env.GMAIL_USER = "nabeel@gmail.com";
    process.env.GMAIL_APP_PASSWORD = "app-password";
    expect(initEmailFromEnv()).toMatch(/^resend/);
  });

  it("falls back to console when configs are incomplete", () => {
    process.env.RESEND_API_KEY = "key"; // missing EMAIL_FROM
    process.env.GMAIL_USER = "nabeel@gmail.com"; // missing GMAIL_APP_PASSWORD
    expect(initEmailFromEnv()).toMatch(/^console/);
  });
});
