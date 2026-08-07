import express from "express";
import { env } from "./config/env";
import ticketsRoute from "./routes/tickets.route";

const app = express();

// Scoped to the Vite dev server's origin (not "*"), so the header is only
// ever sent back to the frontend this project actually serves.
const DEV_FRONTEND_ORIGIN = "http://localhost:5173";

app.use((req, res, next) => {
  if (req.headers.origin === DEV_FRONTEND_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", DEV_FRONTEND_ORIGIN);
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
