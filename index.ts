import express, { response } from "express";
import type { Request, Response } from "express";
import { parseInput, parseOutput } from "./src/schemaParsers";
import {router as userRoutes} from "./routes/user/userRoutes"
import {router as groupRoutes} from "./routes/group/groupRoutes"



const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", async (req: Request, res: Response) => {
   res.send("Hello to the one and one grouptivate")
});
app.use("/user", userRoutes)
app.use("/group", groupRoutes)


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});