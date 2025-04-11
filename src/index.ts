import { MongoClient } from 'mongodb'
import db from "./db"
import express from "express";
import type { Request, Response } from "express";
import { TIMEOUT } from "node:dns";

// Replace the uri string with your connection string.
// const uri = "mongodb+srv://Thrane:bMqVT8FxUR-4.3X@cluster0.xfdy0br.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// const client = new MongoClient(uri);

async function run() {
  try {
    //client ?? new MongoClient(uri)
    // console.log(client)
    // await client.connect();
    //     console.log("Successfully connected to Atlas");
    // const database = client.db('sample_mflix');
    const movies = db.collection('movies');

    // Query for a movie that has the title 'Back to the Future'
    const query = { title: 'Back to the Future' };
    const movie = await movies.findOne(query);
    
    // console.log(movie);
    return movie
    // console.log("bong")
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
// run().catch(console.dir);

// run().catch(console.dir);

console.log("hello world")

console.log(process.env.ATLAS_URI)



const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", async (req: Request, res: Response) => {
   let result = await run().catch(console.dir)
   console.log(result)
    res.send(result);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});