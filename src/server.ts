import express, { type Request, type Response } from "express";
import cors from "cors";
import { authMiddleware, cacheMiddleware } from "./middleware";

import { MongoMemoryServer } from "mongodb-memory-server";
import MG from "mongoose";

import { router as userRouter } from "./routes/user";
import { router as groupRouter } from "./routes/group";
import { router as groupsRouter } from "./routes/groups";

import configureStreakJobs from "./jobs/streakJob";

export async function createServer(
	mongoUri: string,
	testMode: boolean = false,
) {
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
	app.use(cacheMiddleware);

	app.get("/", (req: Request, res: Response) => {
		res.send("Hello to the one and only Grouptivate");
	});
	app.use("/user", userRouter);
	app.use("/group", groupRouter);
	app.use("/groups", groupsRouter);

	const server = app.listen(PORT, () => {
		console.log(`Server is running on port ${PORT}`);
		if (!testMode) {
			console.log(`Configured Cron Jobs`);
			configureStreakJobs();
			console.log(`Configured Cron Jobs`);
		}
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

export async function setupLocalMongoDB(): Promise<MongoMemoryServer> {
	return await MongoMemoryServer.create({
		instance: { dbName: "Grouptivate" },
	});
}
