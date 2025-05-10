import { type Request } from "express";
import cluster from "node:cluster";
import winston, { format } from "winston";

export const logger = winston.createLogger({
	format: format.combine(
		format((data) => {
			if (data.details) {
				data.message += " " + JSON.stringify(data.details, null, 2);
			}
			return data;
		})(),
		format.printf(({ message }) => String(message)),
	),
	transports: [
		new winston.transports.Console(),
		new winston.transports.File({
			filename: "log/errors.log",
			level: "error",
		}),
		new winston.transports.File({
			filename: "log/all.log",
			level: "info",
		}),
	],
});

export default function logRequest(req: Request, ...messages: any[]) {
	const prettyMessages = messages.reduce<any[]>((acc, curr, index) => {
		acc.push(curr);
		if (index < acc.length - 1) {
			acc.push(" - ");
		}
		return acc;
	}, []);
	logger.error(
		`❌ [${new Date(Date.now()).toLocaleString()} - ${cluster.isWorker ? cluster.worker?.id : 0}] ${req.method} @ ${req.originalUrl} - ${req.ip}:`,
		{ details: prettyMessages },
	);
}
