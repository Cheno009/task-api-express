import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { getDatabaseStatus } from '../services/database.service.js';
export const getHealth = (_req: Request, res: Response): void => {
res.status(200).json({
data: {
status: 'up',
version: env.APP_VERSION,
environment: env.NODE_ENV
}
});
};
export const getDatabaseHealth = (_req: Request, res: Response): void => {
const data = getDatabaseStatus();
res.status(data.status === 'up' ? 200 : 503).json({ data });
};