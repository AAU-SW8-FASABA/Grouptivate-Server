import { MongoMemoryServer } from "mongodb-memory-server";
import MG from "mongoose";
import { createServer, setupLocalMongoDB } from "../src/server";

let mongoServer: MongoMemoryServer | undefined;
let serverStopFunc: () => Promise<void> | undefined;

// Start database and server
export async function start() {
	mongoServer = await setupLocalMongoDB();
	serverStopFunc = await createServer(mongoServer.getUri(), true);
}

// Stop database and server
export async function end() {
	if (serverStopFunc) {
		await serverStopFunc();
	}

	if (mongoServer) {
		await mongoServer.stop();
	}
}

export async function clearDatabase() {
	await MG.connection.dropDatabase();
}
