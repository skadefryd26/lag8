import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config } from "dotenv";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { gameRouter } from "./features/vilkarsbingo/game-router.js";

// The backend runs from backend/, while the team's local secret belongs at the repository root.
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env.local") });

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json({ limit: "32kb" }));
app.use("/api/game", gameRouter);

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error(error);
  response.status(502).json({ error: "Bjarne klarte ikke å avsi dom akkurat nå. Prøv igjen etter en kaffepause." });
};

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Vilkårsbingo API lytter på http://localhost:${port}`);
});
