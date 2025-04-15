import { MongoClient } from "mongodb";
console.log(process.env.ATLAS_URI)
const connectionString = process.env.ATLAS_URI || "";

const client = new MongoClient(connectionString);

let conn = client;
try {
  conn = await client.connect();
} catch(e) {
  console.error(e);
}

let db = conn.db("Grouptivate");

export default db;