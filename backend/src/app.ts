import express from "express";
import { env, allowedOrigins } from "./config/env";
import ticketsRoute from "./routes/tickets.route";

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

const port = Number(env.PORT);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
