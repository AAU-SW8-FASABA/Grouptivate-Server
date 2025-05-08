import cluster from "node:cluster";
import { availableParallelism } from "node:os";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { createServer, setupLocalMongoDB } from "./src/server";

const argv = yargs(hideBin(process.argv))
	.option("local", {
		type: "boolean",
		description: "Use local MongoDB instance",
		default: false,
	})
	.help().argv as unknown as { local: boolean };

let connectionString: string | undefined;

// Proof of concept, no need for overkill, uses 1 for local testing, and up to 2 for Atlas
const numCPUs = argv.local ? 1 : Math.min(availableParallelism(), 2);

if (argv.local) {
	const mongodb = await setupLocalMongoDB();
	connectionString = mongodb.getUri();

	process.on("SIGINT", async () => {
		await mongodb.stop();
	});
} else {
	connectionString = process.env.ATLAS_URI;
	if (!connectionString) {
		throw new Error("ATLAS_URI is not set");
	}
}

if (cluster.isPrimary) {
	console.log(`Spawning ${numCPUs} workers...`);
	for (let i = 0; i < numCPUs; i++) {
		cluster.fork();
	}

	cluster.on("exit", (worker, code, signal) => {
		console.log(
			`Worker with PID: '${worker.process.pid}' died with code: '${code}' and signal: '${signal}'`,
		);
		cluster.fork();
	});
} else {
	console.log(`Worker with PID: '${process.pid}' starting server...`);
	await createServer(connectionString);
}
