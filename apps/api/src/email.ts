// Email transport seam. RR-3 ships with a console transport: the magic link is
// printed to the server log so the whole auth flow works with no vendor, no cost,
// and no secrets. A real provider (Resend / Gmail SMTP) slots in behind this same
// `sendEmail` signature during the deploy task — see docs/open-questions.md.

export type Email = {
  to: string;
  subject: string;
  text: string;
};

export interface EmailTransport {
  send(email: Email): Promise<void>;
}

// Default transport: log to stdout. Intentionally loud so the link is easy to find.
export const consoleTransport: EmailTransport = {
  async send(email) {
    // biome-ignore lint/suspicious/noConsole: this IS the transport in dev.
    console.log(
      `\n──────── EMAIL (console transport) ────────\n` +
        `to:      ${email.to}\n` +
        `subject: ${email.subject}\n\n` +
        `${email.text}\n` +
        `───────────────────────────────────────────\n`,
    );
  },
};

// Production transport: Resend over plain HTTP — no SDK dependency, Node's
// global fetch is enough. Errors throw so a failed send is loudly visible.
export function resendTransport(
  apiKey: string,
  from: string,
  fetchFn: typeof fetch = fetch,
): EmailTransport {
  return {
    async send(email) {
      const res = await fetchFn("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to: email.to, subject: email.subject, text: email.text }),
      });
      if (!res.ok) {
        throw new Error(`resend send failed: ${res.status} ${await res.text()}`);
      }
    },
  };
}

let transport: EmailTransport = consoleTransport;

// Lets the deploy task (or tests) swap in a real transport without touching callers.
export function setEmailTransport(t: EmailTransport) {
  transport = t;
}

// Select the transport from env at boot. RESEND_API_KEY + EMAIL_FROM → Resend;
// otherwise the console transport (dev default). Returns a label for the boot log.
export function initEmailFromEnv(): string {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (apiKey && from) {
    setEmailTransport(resendTransport(apiKey, from));
    return `resend (from: ${from})`;
  }
  setEmailTransport(consoleTransport);
  return "console (magic links print to the server log)";
}

export function sendEmail(email: Email): Promise<void> {
  return transport.send(email);
}
