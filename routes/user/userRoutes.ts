import { safeParse } from "valibot";
import { UserCreateRequestSchema, UserGetRequestSchema } from "../../Grouptivate-API/schemas/User";
import { UuidSchema } from "../../Grouptivate-API/schemas/Uuid";
import { parseInput, parseOutput } from "../../src/schemaParsers";
import db, { insert, collectionEnum, update, get } from "../../src/db";
import type {Request, Response} from "express"
import express from "express"


export const router = express.Router();

//User -----------------
//Create user
router.post("/", async (req: Request, res: Response) => {
  
  const result = parseInput(UserCreateRequestSchema, req, res)
    
  if(result.success){
    const id = await insert(collectionEnum.User, {
      name: result.name,
      groups: [],
      lastSync: new Date()
    })
    const response = {
      uuid: id.toString()
    }
    parseOutput(UserCreateRequestSchema, response, res)
  }

});

//Get user information.
router.get("/", async (req: Request, res: Response) => {

  const parseRes = parseInput(UserGetRequestSchema, req, res)
  if(parseRes.success){
    const id = parseRes.uuid
    const user = await get(collectionEnum.User, id);
    if(user== null){
      res.status(404).send("Failed to get user");  
    }
    else{
      parseOutput(UserGetRequestSchema, user, res)
    }
  }

});

//User/sync --------------
//Post the information required by the GET request.
router.post("/sync", async (req: Request, res: Response) => {
    const parseRes = safeParse(UuidSchema,req.body.uuid)
    if(parseRes.success){
      const id:string = parseRes.output
      const result = await update(collectionEnum.User, id, {
        $currentDate: {
          lastSync: true
        }
      });
      res.send(result)
    }
    else{
      res.status(400).send("failed to parse input")
    }
});

//Get which information is required for the specified goals.
router.get("/sync", async (req: Request, res: Response) => {
  const userIdResult = safeParse(UuidSchema,req.body.user)
  if(userIdResult.success){
    const userId = userIdResult.output//new ObjectId(userIdResult.output)
    console.log(userId)
    const data = await db.collection(collectionEnum.Goal).find({user:userId}).project({activity: 1,metric: 1, _id:0 })
    const goals = []
    for await (const doc of data){
      goals.push(doc)
    }
    res.send(JSON.stringify(goals))
  }
  else{
    res.status(400).send(userIdResult.issues)
  }
});