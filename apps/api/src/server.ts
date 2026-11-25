import "./env.js"; // must be first — loads .env before anything reads process.env
import { buildApp } from "./app.js";
import { initEmailFromEnv } from "./email.js";

const port = Number(process.env.PORT ?? 3000);
const app = buildApp();

app.log.info(`email transport: ${initEmailFromEnv()}`);

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
