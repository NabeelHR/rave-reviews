// Email transport seam. Dev default is the console transport: the magic link is
// printed to the server log so the whole auth flow works with no vendor, no cost,
// and no secrets. Production transports (Gmail SMTP / Resend) slot in behind the
// same `sendEmail` signature, selected from env at boot (RR-35).
import nodemailer from "nodemailer";

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

// Minimal shape of a nodemailer transporter — injectable for tests.
export interface SmtpMailer {
  sendMail(opts: { from: string; to: string; subject: string; text: string }): Promise<unknown>;
}

// Production transport, free path: the user's own Gmail over Google SMTP with an
// App Password. Genuinely sent by Google (DKIM-signed), so deliverability beats
// any third-party relay claiming a gmail.com from-address.
export function gmailTransport(
  user: string,
  appPassword: string,
  mailer?: SmtpMailer,
): EmailTransport {
  const smtp: SmtpMailer =
    mailer ??
    nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass: appPassword },
    });
  return {
    async send(email) {
      await smtp.sendMail({
        from: `Rave Reviews <${user}>`,
        to: email.to,
        subject: email.subject,
        text: email.text,
      });
    },
  };
}

let transport: EmailTransport = consoleTransport;

// Lets the deploy task (or tests) swap in a real transport without touching callers.
export function setEmailTransport(t: EmailTransport) {
  transport = t;
}

// Select the transport from env at boot. Precedence:
//   1. RESEND_API_KEY + EMAIL_FROM        → Resend (custom-domain path)
//   2. GMAIL_USER + GMAIL_APP_PASSWORD    → Gmail SMTP (free path)
//   3. neither                            → console (dev default)
// Returns a label for the boot log.
export function initEmailFromEnv(): string {
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (resendKey && from) {
    setEmailTransport(resendTransport(resendKey, from));
    return `resend (from: ${from})`;
  }
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (gmailUser && gmailPass) {
    setEmailTransport(gmailTransport(gmailUser, gmailPass));
    return `gmail smtp (from: ${gmailUser})`;
  }
  setEmailTransport(consoleTransport);
  return "console (magic links print to the server log)";
}

export function sendEmail(email: Email): Promise<void> {
  return transport.send(email);
}
