import express from "express";
import { env, allowedOrigins, devAuthEnabled } from "./config/env";
import ticketsRoute from "./routes/tickets.route";
import classifyRoute from "./routes/classify.route";
import devAuthRoute from "./routes/devAuth.route";
import { errorHandler } from "./middleware/errorHandler.middleware";

const app = express();

// Scoped to a configured allowlist (never "*"), so the header is only ever
// sent back to origins this deployment actually trusts.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/v1/tickets", ticketsRoute);
app.use("/api/v1/tickets", classifyRoute);

// Mounted only when explicitly enabled, so a deployment with the flag off has
// no route to this at all and the URL 404s like any other unknown path. The
// alternative, always mounting it and returning 403 from inside the handler,
// would leave a live token-issuing endpoint in production whose safety rests on
// one correct comparison inside a request handler.
if (devAuthEnabled) {
  console.warn(
    "DEV_AUTH_ENABLED is true: POST /api/v1/dev/token will issue signed tokens without authentication. Never enable this in a deployed environment."
  );
  app.use("/api/v1/dev", devAuthRoute);
}

// Last in the chain, after every route, because Express only reaches an error
// handler that is registered downstream of whatever failed. Anything thrown or
// rejected in the routes above arrives here instead of at Express's default
// handler, which answers a JSON API with an HTML page.
app.use(errorHandler);

const port = Number(env.PORT);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
