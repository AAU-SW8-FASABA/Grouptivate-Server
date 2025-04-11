import db from "./src/db"
import express from "express";
import type { Request, Response } from "express";
import { TIMEOUT } from "node:dns";



async function run() {
  try {

    const movies = db.collection('movies');

    // Query for a movie that has the title 'Back to the Future'
    const query = { title: 'Back to the Future' };
    const movie = await movies.findOne(query);

    return movie
  } finally {

  }
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", async (req: Request, res: Response) => {
   let result = await run().catch(console.dir)
   console.log(result)
    res.send(result);
});

//User -----------------
//Create user
app.post("/user", async (req: Request, res: Response) => {
  let result = await run().catch(console.dir)
  console.log(result)
   res.send(result);
});
//Get user information.
app.get("/user", async (req: Request, res: Response) => {
  let result = await run().catch(console.dir)
  console.log(result)
   res.send(result);
});

//User/sync --------------
//Post the information required by the GET request.
app.post("/user/sync", async (req: Request, res: Response) => {
  let result = await run().catch(console.dir)
  console.log(result)
   res.send(result);
});
//Get which information is required for the specified goals.
app.get("/user/sync", async (req: Request, res: Response) => {
  let result = await run().catch(console.dir)
  console.log(result)
   res.send(result);
});

//Group ------------------
//Create group.
app.post("/group", async (req: Request, res: Response) => {
  let result = await run().catch(console.dir)
  console.log(result)
   res.send(result);
});
//Get group info.
app.get("/group", async (req: Request, res: Response) => {
  let result = await run().catch(console.dir)
  console.log(result)
   res.send(result);
});
//Delete group.
app.delete("/group", async (req: Request, res: Response) => {
  let result = await run().catch(console.dir)
  console.log(result)
   res.send(result);
});

//Group/invite ------------------
//Create a group invitation.
app.post("/group/invite", async (req: Request, res: Response) => {
  let result = await run().catch(console.dir)
  console.log(result)
   res.send(result);
});
//Get group invitations.
app.get("/group/invite", async (req: Request, res: Response) => {
  let result = await run().catch(console.dir)
  console.log(result)
   res.send(result);
});
//Delete a group invitation.
app.delete("/group/invite", async (req: Request, res: Response) => {
  let result = await run().catch(console.dir)
  console.log(result)
   res.send(result);
});

//group/invite/respond ---------------
//Respond to invite.
app.post("/group/invite/respond", async (req: Request, res: Response) => {
  let result = await run().catch(console.dir)
  console.log(result)
   res.send(result);
});

//group/remove ----------------------
//Remove user from group.
app.post("/group/remove", async (req: Request, res: Response) => {
  let result = await run().catch(console.dir)
  console.log(result)
   res.send(result);
});

//Group/goal ------------------------
//Create goal.
app.post("/group/goal", async (req: Request, res: Response) => {
  let result = await run().catch(console.dir)
  console.log(result)
   res.send(result);
});
//Delete goal.
app.delete("/group/goal", async (req: Request, res: Response) => {
  let result = await run().catch(console.dir)
  console.log(result)
   res.send(result);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});