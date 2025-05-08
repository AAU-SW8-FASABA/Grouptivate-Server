import { type Request } from "express";

export default function logRequest(req: Request, ...messages: any[]) {
	const prettyMessages = messages.reduce<any[]>((acc, curr, index) => {
		acc.push(curr);
		if (index < acc.length - 1) {
			acc.push(" - ");
		}
		return acc;
	}, []);
	console.log(
		`❌ [${new Date(Date.now()).toLocaleString()}] ${req.method} @ ${req.originalUrl} - ${req.ip}:`,
		...prettyMessages,
	);
}
