import db from "./src/db"
import express, { response } from "express";
import type { Request, Response } from "express";
import { ObjectId, ReturnDocument, Timestamp, type Document, type WithId } from "mongodb";
import { error, group, timeStamp } from "node:console";
import {safeParse, parse, uuid, object}  from "valibot"
import {GroupSchema, type Group} from "./Grouptivate-API/schemas/Group"
import  {UserSchema} from "./Grouptivate-API/schemas/User"
import { InviteSchema, type Invite } from "./Grouptivate-API/schemas/Invite";
import { GoalSchema, GroupGoalSchema, IndividualGoalSchema, type Goal, type GroupGoal, type IndividualGoal } from "./Grouptivate-API/schemas/Goal";
import { NameSchema } from "./Grouptivate-API/schemas/Name";
import { UuidSchema, type Uuid } from "./Grouptivate-API/schemas/Uuid";
import { Interval } from "./Grouptivate-API/schemas/Interval";


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
  obj.uuid = inputobj["_id"]
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

//User -----------------
//Create user
app.post("/user", async (req: Request, res: Response) => {
  
  const result = safeParse(NameSchema ,req.body.name)
    
  if(result.success){
    req.body["groups"] = []
    insert(collectionEnum.User, {
      name: result.output,
      groups: [],
      lastSync: new Date()
    })
    res.send("Success")
  }
  else{
    console.log(result.issues)
    res.status(400).send(result.issues)
    return

  }
});
//Get user information.
app.get("/user", async (req: Request, res: Response) => {
  const idResult = safeParse(UuidSchema,req.body.uuid)
  if(idResult.success){
    const id = idResult.output
    const result = await get(collectionEnum.User, id);
    if(result== null){
      res.status(404).send("Failed to get user");  
    }
    else
      res.send(convertObj(result))
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
//Delete group.
app.delete("/group", async (req: Request, res: Response) => {
  const idResult = safeParse(UuidSchema, req.body.groupId)
  if(idResult.success){
    console.log(idResult.output)
    const group = await get(collectionEnum.Group, idResult.output)
    if(group?.users == null)
      res.status(404).send("Failed to find group")
    else{
      let idArr: ObjectId[] = [] 
      for(const user of group.users)
        idArr.push(new ObjectId(user))

      updateFilter(collectionEnum.User, 
        {_id: {$in: idArr}}, 
        {$pull: {groups: new ObjectId(idResult.output)} 
      } )
      const result = await remove(collectionEnum.Group, {_id: idResult.output})
      res.send(result)
    }
  }
  else{
    res.status(400).send("Failed to parse input")
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
    const userid:Uuid = userIdResult.output

    const data = await db.collection(collectionEnum.Invite).find({user: userid})
    if (data == null){
      res.send("no invites found")
      return
    }
    const dataArray: Invite[] = []
    for await (const doc of data){
      const invite:Invite = parse(InviteSchema, doc)
      dataArray.push(invite)
    }
    res.send(JSON.stringify(dataArray))
  }
});
//Delete a group invitation.
app.delete("/group/invite", async (req: Request, res: Response) => {
  try{
    const inviteId = parse(UuidSchema,req.body.uuid)
    const inviteuuid = new ObjectId(inviteId)
    const result = await remove(collectionEnum.Invite, {_id: inviteuuid})
    res.send(result)
  } catch(error){
    res.send(error)
  }
});

//group/invite/respond ---------------
//Respond to invite.
app.post("/group/invite/respond", async (req: Request, res: Response) => {
  const userIdResult = safeParse(UuidSchema, req.body.user)
  const groupIdResult = safeParse(UuidSchema, req.body.group)
  const inviteIdResult = safeParse(UuidSchema, req.body.uuid)
  if(userIdResult.success && groupIdResult.success && inviteIdResult.success){
    const userId = userIdResult.output
    const groupId = groupIdResult.output
    const inviteId = inviteIdResult.output
    update(collectionEnum.Group, groupId, { $push: {users: new ObjectId(userId)}})
    update(collectionEnum.User, userId, { $push: {groups: new ObjectId(userId)}})
    const result = await remove(collectionEnum.Invite, {_id: inviteId})
    res.send(result)
  }
  else{
    res.status(400).send("Failed to parse input")
  }
});

//group/remove ----------------------
//Remove user from group.
app.post("/group/remove", async (req: Request, res: Response) => {
  try{
    const user:string = parse(UuidSchema,req.body.user)
    const group:string = parse(UuidSchema,req.body.group)

    update(collectionEnum.Group, group, 
      {$pull: {users: new ObjectId(user)} 
    })
    update(collectionEnum.User,  user, 
      {$pull: {groups: new ObjectId(group)} 
    })
    res.send("Success")
  } catch (e){
    res.send(e)
  }
});

//Group/goal ------------------------
//Create goal.
app.post("/group/goal", async (req: Request, res: Response) => {
  try{
    if("user" in req.body){
      const goal:IndividualGoal = parse(IndividualGoalSchema,req.body)
      await insert(collectionEnum.Goal,goal)
    } else {
      const goal:GroupGoal = parse(GroupGoalSchema,req.body)
      await insert(collectionEnum.Goal,goal)
    }
    res.send("Success")
  } catch (error){
    res.send(error)
  }
});
//Delete goal. TODO: do we want this to remove all goals? det er det den gør lige nu :)
app.delete("/group/goal", async (req: Request, res: Response) => {

  const idResult = safeParse(UuidSchema,req.body.uuid)
  if(idResult.success){
    const id:string = idResult.output
    
    // await remove(collectionEnum.Group, req.body); //skal være en update på goal array og ikke slette gruppen
    await remove(collectionEnum.Goal, {"group": id})
    res.send("success")
  }
  else{
    res.status(400).send("Failed to parse input")
  }
  
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});