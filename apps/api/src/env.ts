// Load the repo-root .env for local dev. Imported first in server.ts so vars are
// set before anything reads them. In production, real env vars are already present
// and this is a harmless no-op if the file is absent.
try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url));
} catch {
  // no .env file — rely on the ambient environment
}
