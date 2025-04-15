import db from "./src/db"
import express from "express";
import type { Request, Response } from "express";
import { ObjectId, type Document, type WithId } from "mongodb";
import { error } from "node:console";
import {parse}  from "valibot"
import {GroupSchema, type Group} from "./Grouptivate-API/schemas/Group"
import  {UserSchema} from "./Grouptivate-API/schemas/User"
import type { Invite } from "./Grouptivate-API/schemas/Invite";
import type { Goal } from "./Grouptivate-API/schemas/Goal";
import { NameSchema } from "./Grouptivate-API/schemas/Name";
import { UuidSchema } from "./Grouptivate-API/schemas/Uuid";
import type { Key } from "node:readline";

enum collectionEnum {Goal = "Goal", Group = "Group", User = "User", Invite = "Invite" }

async function get(_collection: collectionEnum, id: string) {
  try {
    const uuid = new ObjectId(id)
    const collection = db.collection(_collection);
    switch (_collection){
      case collectionEnum.Goal:
        console.log("Not implemented");
        return ;
      case collectionEnum.Group:
      case collectionEnum.User:
        const query = { _id: uuid};
        const res = await collection.findOne(query)
        return res;
      case collectionEnum.Invite:
        console.log("not implemented")
        return ;
      default:
        throw error("OutOfBounds");
    }
    
  } catch (e) {
    console.log(e)
  }
}

async function insert(_collection: collectionEnum, data: JSON) {
  try{
    const collection = db.collection(_collection);
    collection.insertOne(data);

  } catch (e) {
    console.log(e)
  }
}

async function remove(_collection: collectionEnum, data: object) {
  try{
    const collection = db.collection(_collection);
    collection.deleteMany(data);

  } catch (e) {
    console.log(e)
  }
}

function convertObj(inputobj: WithId<Document>){
  let obj: Record<any,any> = inputobj
  obj.uuid = inputobj["_id"]
  delete obj["_id"]
  console.log(obj)

  return obj;
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", async (req: Request, res: Response) => {
   res.send("Hello to the one and one grouptivate")
});

//User -----------------
//Create user
app.post("/user", async (req: Request, res: Response) => {
  try{
    parse(NameSchema ,req.body.name)
    
   } catch(e) {
    console.log(e)
    res.send(e)
    return
   }
   req.body["groups"] = []
  insert(collectionEnum.User, req.body)
  // await db.collection(collectionEnum.User).insertOne(req.body)
  
  res.send("Post")
});
//Get user information.
app.get("/user", async (req: Request, res: Response) => {
  try{
    const id:string = req.body.uuid
    parse(UuidSchema,id)
    console.log(id)
    const result = await get(collectionEnum.User, id);
    if(result== null){
      throw new Error("Failed to get user");
      
    }
    else
      res.send(convertObj(result))
  } catch (e){
    res.send(e)
  }

});

//User/sync --------------
//Post the information required by the GET request.
app.post("/user/sync", async (req: Request, res: Response) => {

});
//Get which information is required for the specified goals.
app.get("/user/sync", async (req: Request, res: Response) => {

});

//Group ------------------
//Create group.
app.post("/group", async (req: Request, res: Response) => {

});
//Get group info.
app.get("/group", async (req: Request, res: Response) => {

});
//Delete group.
app.delete("/group", async (req: Request, res: Response) => {

});

//Group/invite ------------------
//Create a group invitation.
app.post("/group/invite", async (req: Request, res: Response) => {

});
//Get group invitations.
app.get("/group/invite", async (req: Request, res: Response) => {

});
//Delete a group invitation.
app.delete("/group/invite", async (req: Request, res: Response) => {

});

//group/invite/respond ---------------
//Respond to invite.
app.post("/group/invite/respond", async (req: Request, res: Response) => {

});

//group/remove ----------------------
//Remove user from group.
app.post("/group/remove", async (req: Request, res: Response) => {
  try{
    const user:string = parse(UuidSchema,req.body.user)
    const group:string = parse(UuidSchema,req.body.group)
    let groupObjMby = await get(collectionEnum.Group, group);
    const groupobj:Group = parse(GroupSchema,groupObjMby)
    groupobj.users.splice(groupobj.users.indexOf(user))
    db.collection(collectionEnum.Group).updateOne({uuid: group}, groupobj)
    // res.send(result)
  } catch (e){
    res.send(e)
  }
});

//Group/goal ------------------------
//Create goal.
app.post("/group/goal", async (req: Request, res: Response) => {

});
//Delete goal.
app.delete("/group/goal", async (req: Request, res: Response) => {
  try{
    const id:string = req.body.uuid
    parse(UuidSchema,id)
    await remove(collectionEnum.Group, req.body);
    await remove(collectionEnum.Goal, {"group": id})
    // res.send(result)
  } catch (e){
    res.send(e)
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});