import type { RequestHandler } from "express";
import SessionModel from "./models/SessionModel";
import { StatusCode } from "./dbEnums";
import cluster from "node:cluster";
import winston, { format } from "winston";

const logger = winston.createLogger({
	level: "info",
	format: format.printf(({ message }) => String(message)),
	transports: [new winston.transports.File({ filename: "requests.log" })],
});

export const authMiddleware: RequestHandler = async (req, res, next) => {
	if (
		[
			{ path: "/", method: "GET" },
			{ path: "/", method: "HEAD" },
			{ path: "/user", method: "POST" },
			{ path: "/user/login", method: "POST" },
		].some(
			(route) => route.path === req.path && route.method === req.method,
		)
	) {
		next();
		return;
	}

	const token = req.headers.authorization?.split(" ")[1];
	if (!token) {
		res.status(StatusCode.UNAUTHORIZED).json({
			message: "Missing Authorization Token",
		});
		return;
	}

	const session = await SessionModel.findOne({ token });
	if (!session) {
		res.status(StatusCode.UNAUTHORIZED).json({
			message: "No active session",
		});
		return;
	}

	req.userId = session.userId;
	next();
};

export const cacheMiddleware: RequestHandler = async (req, res, next) => {
	res.set("Cache-Control", ["private"]);
	next();
};

export const logMiddleware: RequestHandler = (req, res, next) => {
	console.log(
		`📭 [${new Date(Date.now()).toLocaleString()} - ${cluster.isWorker ? cluster.worker?.id : 0}] ${req.method} @ ${req.originalUrl} - ${req.ip}:`,
	);
	logger.info(
		`📭 [${new Date(Date.now()).toLocaleString()} - ${cluster.isWorker ? cluster.worker?.id : 0}] ${req.method} @ ${req.originalUrl} - ${req.ip}:`,
	);
	next();
};
