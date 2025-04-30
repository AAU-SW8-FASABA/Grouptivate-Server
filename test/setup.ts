import { MongoMemoryServer } from "mongodb-memory-server";
import { createServer } from "../src/server";

let mongoServer: MongoMemoryServer | undefined;
let serverStopFunc: () => Promise<void> | undefined;

// Start database and server
export async function start() {
	mongoServer = await MongoMemoryServer.create({
		instance: { dbName: "Grouptivate" },
	});
	if (!mongoServer) return;
	serverStopFunc = await createServer(mongoServer.getUri());
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
