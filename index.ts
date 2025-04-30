import { createServer } from "./src/server";

const connectionString = process.env.ATLAS_URI;

if (!connectionString) {
	throw new Error("ATLAS_URI is not set");
}

try {
	createServer(connectionString);
} catch (e) {
	console.error(`Failed to start server: ${e}`);
}
