import express from "express";
import { env } from "./config/env";
import ticketsRoute from "./routes/tickets.route";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/v1/tickets", ticketsRoute);

const port = Number(env.PORT);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
