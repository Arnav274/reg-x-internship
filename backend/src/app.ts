import express from "express";
import { env } from "./config/env";

const app = express();

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

const port = Number(env.PORT);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
