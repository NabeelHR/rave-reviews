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

let transport: EmailTransport = consoleTransport;

// Lets the deploy task (or tests) swap in a real transport without touching callers.
export function setEmailTransport(t: EmailTransport) {
  transport = t;
}

export function sendEmail(email: Email): Promise<void> {
  return transport.send(email);
}
