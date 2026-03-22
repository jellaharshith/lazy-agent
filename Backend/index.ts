import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

import "./config/gemini";
import "./config/openai";

import express from "express";
import cors from "cors";

import needsRouter from "./routes/needs";
import resourcesRouter from "./routes/resources";
import matchesRouter from "./routes/matches";
import aiRouter from "./routes/ai";
import intakeRouter from "./routes/intake";
import myResourcesRouter from "./routes/myResources";
import reservationsRouter from "./routes/reservations";
import mySeekerRouter from "./routes/mySeeker";
import dashboardRouter from "./routes/dashboard";
import voiceRouter from "./routes/voice";
import geocodeRouter from "./routes/geocode";
import bedrockTestRouter from "./routes/bedrockTest";
import s3TestRouter from "./routes/s3Test";

const app = express();

const parsedPort = process.env.PORT ? Number(process.env.PORT) : NaN;
const listenPort = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 0;

// Browser clients (local Frontend on any port, etc.): reflect Origin; preflight handled by cors
app.use(cors({ origin: true }));
app.use(express.json());

app.get("/test-env", (_req, res) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY?.trim());
  res.status(200).json({
    gemini: hasKey ? "loaded" : "missing",
  });
});

app.get("/", (_req, res) => {
  res.status(200).json({
    ok: true,
    name: "Intent Commons API",
    health: "/health",
    api: {
      needs: "/api/needs",
      resources: "/api/resources",
      matches: "/api/matches",
      ai: "/api/ai",
      aiPing: "/api/ai/ping",
      intake: "/api/intake",
      myResources: "/api/my/resources",
      reservations: "/api/reservations",
      myReservations: "/api/my/reservations",
      dashboardLive: "/api/dashboard/live",
      voiceTestCall: "POST /api/voice/test-call",
    },
  });
});

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use("/api/needs", needsRouter);
app.use("/api/resources", resourcesRouter);
app.use("/api/matches", matchesRouter);

app.use("/api/ai", aiRouter);
app.use("/api/ai", bedrockTestRouter);
app.use("/api/intake", intakeRouter);
app.use("/api/my/resources", myResourcesRouter);
app.use("/api/reservations", reservationsRouter);
app.use("/api/my", mySeekerRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/voice", voiceRouter);
app.use("/api/geocode", geocodeRouter);
app.use("/api/aws", s3TestRouter);

const server = app.listen(listenPort, () => {
  const addr = server.address();
  const port = addr && typeof addr === "object" ? addr.port : listenPort;
  console.log(`Server listening on http://localhost:${port}`);
});
