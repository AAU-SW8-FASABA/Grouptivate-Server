import express, { type Request, type Response } from "express";
import cors from "cors";
import { authMiddleware } from "./middleware";
import MG from "mongoose";

import { router as userRouter } from "./routes/user";
import { router as groupRouter } from "./routes/group";

export async function createServer(mongoUri: string) {
	try {
		await MG.connect(mongoUri, { dbName: "Grouptivate" });
		console.log("Connected to MongoDB");
	} catch (e) {
		console.log(`Error connecting to MongoDB: ${e}`);
		throw e;
	}

	const app = express();
	const PORT = process.env.PORT || 3000;

	app.use(cors());
	app.use(express.json());
	app.use(authMiddleware);

	app.get("/", (req: Request, res: Response) => {
		res.send("Hello to the one and only Grouptivate");
	});
	app.use("/user", userRouter);
	app.use("/group", groupRouter);

	const server = app.listen(PORT, () => {
		console.log(`Server is running on port ${PORT}`);
	});

	process.on("SIGINT", async () => {
		server.close();
		await MG.disconnect();
		process.exit(0);
	});

	return async () => {
		server.close();
		await MG.disconnect();
	};
}
