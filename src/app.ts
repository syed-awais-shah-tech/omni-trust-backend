import express, { Application, Request, Response } from 'express';

const app: Application = express();

app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'OmniTrust backend is healthy',
    timestamp: new Date().toISOString()
  });
});

export default app;
