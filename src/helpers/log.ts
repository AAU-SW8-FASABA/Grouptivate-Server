import { type Request } from "express";
import cluster from "node:cluster";
import winston, { format } from "winston";

const logger = winston.createLogger({
	level: "error",
	format: format.combine(
		format((data) => {
			if (data.details) {
				data.message += " " + JSON.stringify(data.details);
			}
			return data;
		})(),
		format.printf(({ message }) => String(message)),
	),
	transports: [new winston.transports.File({ filename: "errors.log" })],
});

export default function logRequest(req: Request, ...messages: any[]) {
	const prettyMessages = messages.reduce<any[]>((acc, curr, index) => {
		acc.push(curr);
		if (index < acc.length - 1) {
			acc.push(" - ");
		}
		return acc;
	}, []);
	console.log(
		`❌ [${new Date(Date.now()).toLocaleString()} - ${cluster.isWorker ? cluster.worker?.id : 0}] ${req.method} @ ${req.originalUrl} - ${req.ip}:`,
		...prettyMessages,
	);
	logger.error(
		`❌ [${new Date(Date.now()).toLocaleString()} - ${cluster.isWorker ? cluster.worker?.id : 0}] ${req.method} @ ${req.originalUrl} - ${req.ip}:`,
		{ details: prettyMessages },
	);
}
