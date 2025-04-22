import db from "./src/db"
import express, { response } from "express";
import type { Request, Response } from "express";
import { ObjectId, ReturnDocument, Timestamp, type Document, type WithId } from "mongodb";
import { error, group, timeStamp } from "node:console";
import {safeParse, parse, uuid, object}  from "valibot"
import {GroupSchema, type Group} from "./Grouptivate-API/schemas/Group"
import  {UserSchema, UserGetRequestSchema, UserCreateRequestSchema} from "./Grouptivate-API/schemas/User"
import { InviteSchema, type Invite } from "./Grouptivate-API/schemas/Invite";
import { GoalSchema, GroupGoalSchema, IndividualGoalSchema, type Goal, type GroupGoal, type IndividualGoal } from "./Grouptivate-API/schemas/Goal";
import { NameSchema } from "./Grouptivate-API/schemas/Name";
import { UuidSchema, type Uuid } from "./Grouptivate-API/schemas/Uuid";
import { Interval } from "./Grouptivate-API/schemas/Interval";
import type { RequestSchema, SearchParametersSchema } from "./Grouptivate-API/containers/Request";


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
        //const querya = "user: uuid};
        const invites = await collection.findOne({user: uuid})        
        return invites;
      default:
        throw error("OutOfBounds");
    }
    
  } catch (e) {
    console.log(e)
  }
}

async function update(_collection: collectionEnum, id: string, data: object) {
  
  const uuid = new ObjectId(id)
  const collection = db.collection(_collection);
  if ("uuid" in data)
    delete data["uuid"]
  collection.updateOne({'_id': uuid}, data)

}
async function updateFilter(_collection: collectionEnum, filter: object, data: object) {
  
  const collection = db.collection(_collection);
  if ("uuid" in data)
    delete data["uuid"]
  collection.updateOne(filter, data)

}

async function insert(_collection: collectionEnum, data: object) {
 
  const collection = db.collection(_collection);
  if ("uuid" in data)
    delete data["uuid"]
  const result = await collection.insertOne(data);
  return result.insertedId
 
}

async function remove(_collection: collectionEnum, filter: object) { //TODO: check om fejler

  if('_id' in filter){
    const idResult = safeParse(UuidSchema, filter["_id"])
    if(idResult.success){
      
      filter['_id'] =  new ObjectId(idResult.output)
    }
    else{
      return
    }
  }
  const collection = db.collection(_collection);
  collection.deleteMany(filter);

}

function convertObj(inputobj: WithId<Document>){
  let obj: Record<any,any> = inputobj
  obj.uuid = inputobj["_id"].toString()
  if("groups" in inputobj){
    for(const i in inputobj["groups"]){
      inputobj["groups"][i] = inputobj["groups"][i].toString()
    }
  }

  delete obj["_id"]
  // console.log(obj)

  return obj;
}

// function responseOk(){
//   return new Response(null, 
//     {
//       status: 200,
//       statusText: "Success"

//     }
//   )
// }

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", async (req: Request, res: Response) => {
   res.send("Hello to the one and one grouptivate")
});

function parseInput(inputSchema: RequestSchema<SearchParametersSchema, any, any>, req: Request){
  const parseRes = []
  const result: Record<string,any> = {}

  if(Object.keys(inputSchema.searchParams).length > 0){
    const paramSchema = inputSchema.searchParams
    for( const [key,value] of Object.entries(paramSchema)) {
      const parse = safeParse(value, {[key] :req.query[key]})
      parseRes.push(parse.success)
      Object.assign(result, parse.output)
    }
    result.success = !parseRes.every(res => {
      res === true
    })
  }
  else{
    const parse = safeParse(inputSchema.requestBody, req.body)
    result.success = parse.success
    Object.assign(result, parse.output)
  }

  return result
}


function parseOutput(schema: RequestSchema<SearchParametersSchema, any, any>, data: WithId<Document> | object, res: Response){
  if(schema.responseBody){
    if("_id" in data) 
      data = convertObj(data)
    const parseRes = safeParse(schema.responseBody, data)
    if(parseRes.success){
      console.log("it got there")
      console.log(parseRes.output)
      return res.send(parseRes.output)
    }
    else{
      return res.status(400).send(parseRes.issues)
    }
  }
  return res.status(400).send("Failed to read schema")
}

//User -----------------
//Create user
app.post("/user", async (req: Request, res: Response) => {
  
  const result = parseInput(UserCreateRequestSchema ,req)
    
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
  else{
    res.status(400).send(result.issues)
  }
});

//Get user information.
app.get("/user", async (req: Request, res: Response) => {

  const parseRes = parseInput(UserGetRequestSchema, req)
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
  else{
    res.status(400).send("Failed to parse input")
  }

});

//User/sync --------------
//Post the information required by the GET request.
app.post("/user/sync", async (req: Request, res: Response) => {
    const parseRes = safeParse(UuidSchema,req.body.uuid)
    console.log("hit")
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
app.get("/user/sync", async (req: Request, res: Response) => {
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

//Group ------------------
  // uuid: UuidSchema,
  // name: NameSchema,
  // users: v.pipe(v.array(UuidSchema), v.minLength(1)),
  // interval: IntervalSchema,
  // streak: PositiveNumberSchema,
//Create group.
app.post("/group", async (req: Request, res: Response) => {
  const groupNameResult = safeParse(NameSchema, req.body.group)
  const userIdResult = safeParse(UuidSchema, req.body.user) //might change
  if(groupNameResult.success && userIdResult.success){
    const groupName = groupNameResult.output
    const userId = userIdResult.output
    const mockObj = {
      name: groupName,
      users: [new ObjectId(userId)],
      interval: Interval.Weekly,
      streak: 0
    }
    //Create group
    const groupId = await insert(collectionEnum.Group, mockObj)
  
    //Add group to user table
    if (groupId == null)
      res.status(500).send("Failed to insert")
    else{
      update(collectionEnum.User, userId, {
        $push: {groups: new ObjectId(groupId)}
      })
      res.send(groupId)
    }
  }
  else{
    res.status(400).send("Failed to parse input")
  }
});

//Get group info.
app.get("/group", async (req: Request, res: Response) => {
  const groupIdResult = safeParse(UuidSchema, req.body.group)
  if(groupIdResult.success){
    const groupId = groupIdResult.output
    const data = await get(collectionEnum.Group, groupId)
    if (data == null){
      res.status(404).send("group not found")
      return
    }
    res.send(convertObj(data))
  }
  else{
    res.status(400).send("Failed to parse input")
  }
});

//Delete group. TODO: this feature should be removed. A groups should be removed if the last user leaves it 
app.delete("/group", async (req: Request, res: Response) => {
  const idResult = safeParse(UuidSchema, req.body.groupId)
  if(idResult.success){
    const id = idResult.output
    const group = await get(collectionEnum.Group, idResult.output)
    if(group?.users == null)
      res.status(404).send("Failed to find group")
    else{
      let idArr: ObjectId[] = [] 
      for(const user of group.users){
        idArr.push(new ObjectId(user))
      }
      updateFilter(collectionEnum.User, 
        {_id: {$in: idArr}}, 
        {$pull: {groups: new ObjectId(idResult.output)} 
      })
      remove(collectionEnum.Group, {_id: id})
      remove(collectionEnum.Goal, {group: id})
      res.send()
    }
  }
  else{
    res.status(400).send(idResult.issues)
  }
});

//Group/invite ------------------
//Create a group invitation.
app.post("/group/invite", async (req: Request, res: Response) => {
  const inviteResult = safeParse(InviteSchema,req.body)
  if(inviteResult.success){
    const invObj: Object = {
      user: new ObjectId(inviteResult.output.user),
      group: new ObjectId(inviteResult.output.group)
    }
    await insert(collectionEnum.Invite, invObj)
    res.send("success")
  }
  else{
    res.status(400).send(inviteResult.issues)
  }
});

//Get group invitations.
app.get("/group/invite", async (req: Request, res: Response) => {
  const userIdResult = safeParse(UuidSchema,req.body.user)
  if(userIdResult.success){
    const userId:Uuid = userIdResult.output
    const data = await db.collection(collectionEnum.Invite).find({user: userId})
    if (data == null){
      res.status(404).send("no invites found")
      return
    }
    const dataArray: Invite[] = []
    for await (const doc of data){
      const invite:Invite = parse(InviteSchema, doc)
      dataArray.push(invite)
    }
    res.send(JSON.stringify(dataArray))
  } 
  else{
    res.status(400).send("Failed to parse input")
  }
});

//Delete a group invitation. 
//No longer needed, old implementation is part of post/group/invite/respond
/*
app.delete("/group/invite", async (req: Request, res: Response) => {
  const inviteIdResult = safeParse(UuidSchema,req.body.uuid)
  if(inviteIdResult.success){
    const inviteuuid = new ObjectId(inviteIdResult.output)
    const result = await remove(collectionEnum.Invite, {_id: inviteuuid})
    res.send(result)
  } 
  else{
    res.status(400).send("Failed to parse input")
  }
});
*/

//group/invite/respond ---------------
//Respond to invite. 
app.post("/group/invite/respond", async (req: Request, res: Response) => {
  const userIdResult = safeParse(UuidSchema, req.body.user)
  const groupIdResult = safeParse(UuidSchema, req.body.group)
  const inviteIdResult = safeParse(UuidSchema, req.body.uuid)
  if(userIdResult.success && groupIdResult.success && inviteIdResult.success){
    if(req.body.respond == "Y"){
      const userId = userIdResult.output
      update(collectionEnum.Group, groupIdResult.output, {
        $push: {users: new ObjectId(userId)}
      })
      update(collectionEnum.User, userId, {
        $push: {groups: new ObjectId(userId)}
      })
    }
    const result = await remove(collectionEnum.Invite, {_id: inviteIdResult.output})
    res.send(result)
  }
  else{
    res.status(400).send("Failed to parse input")
  }
});

//group/remove ----------------------
//Remove user from group.
app.post("/group/remove", async (req: Request, res: Response) => {
  const userIdResult = safeParse(UuidSchema,req.body.user)
  const groupIdResult = safeParse(UuidSchema,req.body.group)
  if(userIdResult.success && groupIdResult.success){
    const userId = userIdResult.output
    const groupId = groupIdResult.output
    update(collectionEnum.Group, groupId, {
      $pull: {users: new ObjectId(userId)} 
    })
    update(collectionEnum.User,  userId, {
      $pull: {groups: new ObjectId(groupId)} 
    })
    res.send("Success")
  }    
  else{
    res.status(400).send("Failed to parse input")
  }
});

//Group/goal ------------------------
//Create goal.
app.post("/group/goal", async (req: Request, res: Response) => {
  const indiGoalIdResult = safeParse(IndividualGoalSchema, req.body)
  const groupGoalIdResult = safeParse(GroupGoalSchema, req.body) 
  if(indiGoalIdResult.success){
    const goal = indiGoalIdResult.output
    const result = await insert(collectionEnum.Goal,goal)
    res.send(result)
  } else if(groupGoalIdResult.success){
    const goal = groupGoalIdResult.output
    const result = await insert(collectionEnum.Goal,goal)
    res.send(result)
  } 
  else{
    res.status(400).send("Failed to parse input")
  }
});

//Delete goal.
app.delete("/group/goal", async (req: Request, res: Response) => {
  const goalIdResult = safeParse(UuidSchema,req.body.uuid)
  if(goalIdResult.success){
    const goalId = goalIdResult.output
    const result = await remove(collectionEnum.Goal, {_id: goalId})
    res.send(result)
  }
  else{
    res.status(400).send("Failed to parse input")
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});