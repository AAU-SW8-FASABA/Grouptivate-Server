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
		`${req.method} @ ${req.path} - ${req.ips[0]}: `,
		...prettyMessages,
	);
}
