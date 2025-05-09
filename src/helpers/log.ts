import { type Request } from "express";
import cluster from "node:cluster";

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
}
