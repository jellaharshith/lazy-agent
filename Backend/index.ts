import './loadEnv';

import express from 'express';
import cors from 'cors';

import needsRouter from './routes/needs';
import resourcesRouter from './routes/resources';
import matchesRouter from './routes/matches';

const app = express();

const parsedPort = process.env.PORT ? Number(process.env.PORT) : NaN;
const listenPort = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 0;

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.status(200).json({
    ok: true,
    name: 'Intent Commons API',
    health: '/health',
    api: {
      needs: '/api/needs',
      resources: '/api/resources',
      matches: '/api/matches',
    },
  });
});

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use('/api/needs', needsRouter);
app.use('/api/resources', resourcesRouter);
app.use('/api/matches', matchesRouter);

const server = app.listen(listenPort, () => {
  const addr = server.address();
  const port = addr && typeof addr === 'object' ? addr.port : listenPort;
  console.log(`Server listening on http://localhost:${port}`);
});
