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

let connectionString;

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

await createServer(connectionString);
