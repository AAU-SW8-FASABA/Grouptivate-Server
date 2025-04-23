import db from "./src/db"
import express, { response } from "express";
import type { Request, Response } from "express";
import { ObjectId, ReturnDocument, Timestamp, type Document, type WithId } from "mongodb";
import { error, group, timeStamp } from "node:console";
import {safeParse, parse, uuid, object}  from "valibot"
import {GroupCreateRequestSchema, GroupGetRequestSchema, GroupRemoveRequestSchema, GroupSchema, type Group} from "./Grouptivate-API/schemas/Group"
import  {UserSchema, UserGetRequestSchema, UserCreateRequestSchema} from "./Grouptivate-API/schemas/User"
import { InviteCreateRequestSchema, InviteGetRequestSchema, InviteRespondRequestSchema, InviteSchema, type Invite } from "./Grouptivate-API/schemas/Invite";
import { GoalSchema, GroupGoalSchema, IndividualGoalSchema, type Goal, type GroupGoal, type IndividualGoal } from "./Grouptivate-API/schemas/Goal";
import { NameSchema } from "./Grouptivate-API/schemas/Name";
import { UuidSchema, type Uuid } from "./Grouptivate-API/schemas/Uuid";
import { Interval } from "./Grouptivate-API/schemas/Interval";
import type { RequestSchema, SearchParametersSchema } from "./Grouptivate-API/containers/Request";
import { json } from "node:stream/consumers";


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
  if("users" in inputobj){
    for(const i in inputobj["users"]){
      inputobj["users"][i] = inputobj["users"][i].toString()
    }
  }

  delete obj["_id"]
  // console.log(obj)

  return obj;
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", async (req: Request, res: Response) => {
   res.send("Hello to the one and one grouptivate")
});

function parseInput(inputSchema: RequestSchema<SearchParametersSchema, any, any>, req: Request, res: Response){
  const parseRes = []
  const result: Record<string,any> = {
    issues: []
  }
  if(Object.keys(inputSchema.searchParams).length > 0){
    const paramSchema = inputSchema.searchParams
    for( const [key,value] of Object.entries(paramSchema)) {
      // console.log("Param:")
      // console.log({[key] :req.query[key]})
      const parse = safeParse(value, req.query[key])
      parseRes.push(parse.success)
      if(!parse.success){
        console.log("Param error")
        console.log(paramSchema)
        console.log(req.query)
        result.issues.concat(parse.issues)
      }
      result[key] = parse.output
    }

    result.success = parseRes.every(v => v === true)

  }
  if(inputSchema?.requestBody && Object.keys(inputSchema?.requestBody).length > 0){
    const parseBody = safeParse(inputSchema.requestBody, req.body)
    result.success = parseBody.success && (result?.success ?? true)
    if(!result.success)
      result.issues.concat(parseBody.issues)
    Object.assign(result, parseBody.output)
  }
  if(!result.success){
    res.status(400).send(result.issues)
  }
  return result
}


function parseOutput(schema: RequestSchema<SearchParametersSchema, any, any>, data: WithId<Document> | object, res: Response){
  if(schema.responseBody){
    if("_id" in data) 
      data = convertObj(data)
    const parseRes = safeParse(schema.responseBody, data)
    if(parseRes.success){
      // console.log(parseRes.output)
      return res.send(parseRes.output)
    }
    else{
      console.log(data)
      return res.status(401).send(parseRes.issues)
    }
  }
  return res.status(200).send("No responseBody")
}

//User -----------------
//Create user
app.post("/user", async (req: Request, res: Response) => {
  
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
app.get("/user", async (req: Request, res: Response) => {

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
app.post("/user/sync", async (req: Request, res: Response) => {
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
  const parseRes = parseInput(GroupCreateRequestSchema, req, res)
  if(parseRes.success){
    const mockObj = {
      name: parseRes.name,
      users: [parseRes.user],
      interval: parseRes.interval,
      streak: 0
    }
    //Create group
    const groupId = await insert(collectionEnum.Group, mockObj)
  
    //Add group to user table
    if (groupId == null)
      res.status(500).send("Failed to insert")
    else{
      update(collectionEnum.User, parseRes.uuid, {
        $push: {groups: new ObjectId(groupId)}
      })
      parseOutput(GroupCreateRequestSchema, {uuid: groupId.toString()}, res)
    }
  }
});

//Get group info.
app.get("/group", async (req: Request, res: Response) => {
  const parseRes = parseInput(GroupGetRequestSchema, req, res)
  if(parseRes.success){
    const data = await get(collectionEnum.Group, parseRes.uuid)
    if (data == null){
      res.status(404).send("group not found")
      return
    }
    parseOutput(GroupGetRequestSchema, data, res)
    // res.send(convertObj(data))
  }
});

//Delete group. TODO: this feature should be changed. A groups should be removed if the last user leaves it 
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
  const result = parseInput(InviteCreateRequestSchema,req, res)
  if(result.success){
    const id = await insert(collectionEnum.Invite, {
      group: result.group,
      invited: result.invited,
      invitee: result.user
    })
    const response = {
    }
    parseOutput(InviteCreateRequestSchema, response, res)
  }
});

//Get group invitations.
app.get("/group/invite", async (req: Request, res: Response) => {
  const getResult = parseInput(InviteGetRequestSchema, req, res)
  if(getResult.success){
    const userId = getResult.user
    const data = await db.collection(collectionEnum.Invite).find({invited: userId})
    if (data == null){
      res.status(404).send("no invites found")
      return
    }
    
    res.send(JSON.stringify(data))
    //parseOutput(InviteGetRequestSchema, data, res)
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
//app.post("/group/invite/respond", async (req: Request, res: Response) => {
//  const inviteResponse = parseInput(InviteRespondRequestSchema, req, res)
//  if(inviteResponse.success){
//    if(inviteResponse.responseBool == true){
//      const userId = inviteResponse.user
//      const inviteId = inviteResponse.invite
//
//      const groupId = 
//      update(collectionEnum.Group, groupIdResult.output, {
//        $push: {users: new ObjectId(userId)}
//      })
//      update(collectionEnum.User, userId, {
//        $push: {groups: new ObjectId(userId)}
//      })
//    }
//    const result = await remove(collectionEnum.Invite, {_id: inviteIdResult.output})
//    res.send(result)
//  }
//  else{
//    res.status(400).send("Failed to parse input")
//  }
//});

//group/remove ----------------------
//Remove user from group.
app.post("/group/remove", async (req: Request, res: Response) => {
  const parseRes = parseInput(GroupRemoveRequestSchema, req, res)
  if(parseRes.success){
    const groupId = parseRes.group
    const userId = parseRes.user
    update(collectionEnum.Group, groupId, {
      $pull: {users: userId} 
    })
    remove(collectionEnum.Group, {users : {$size: 0}})
    update(collectionEnum.User,  userId, {
      $pull: {groups: groupId} 
    })
    parseOutput(GroupRemoveRequestSchema, {},res)
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