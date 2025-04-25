import type { RequestHandler, Request } from 'express';
import { getSessionFromToken } from './db';

export const authMiddleware: RequestHandler = async (req, res, next) => {
    if (
        [
            { path: '/', method: 'GET' },
            { path: '/user', method: 'POST' },
            { path: '/user/login', method: 'POST' },
        ].some(
            (route) => route.path === req.path && route.method === req.method,
        )
    ) {
        next();
        return;
    }

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        res.status(401).json({ message: 'Missing Authorization Token' });
        return;
    }

    const session = await getSessionFromToken(token);
    if (!session) {
        res.status(401).json({ message: 'No active session' });
        return;
    }

    req.sessionToken = session.id;
    next();
};
