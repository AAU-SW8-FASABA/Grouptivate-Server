import { parseInput, parseOutput } from "../schemaParsers";
import db, { insert, collectionEnum, update, existFilter, getFilter, remove, get } from "../src/db";
import type {Request, Response} from "express"
import { GroupGoalCreateRequestSchema, GoalDeleteRequestSchema } from "../Grouptivate-API/schemas/Goal";
import { GroupCreateRequestSchema, GroupGetRequestSchema, GroupRemoveRequestSchema } from "../Grouptivate-API/schemas/Group";
import { InviteCreateRequestSchema, InviteGetRequestSchema, InviteRespondRequestSchema } from "../Grouptivate-API/schemas/Invite";
import express from "express"

export const router = express.Router();

router.post("/", async (req: Request, res: Response) => {
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
          $push: {groups: groupId}
        })
        parseOutput(GroupCreateRequestSchema, {uuid: groupId.toString()}, res)
      }
    }
  });
  
  //Get group info.
  router.get("/", async (req: Request, res: Response) => {
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
  
  //Group/invite ------------------
  //Create a group invitation.
  router.post("/invite", async (req: Request, res: Response) => {
    const result = parseInput(InviteCreateRequestSchema,req, res)
    if(result.success){
      const id = await insert(collectionEnum.Invite, {
        group: result.group,
        invited: result.invited,
        inviter: result.user
      })
      const response = {
      }
      parseOutput(InviteCreateRequestSchema, response, res)
    }
  });
  
  //Get group invitations.
  router.get("/invite", async (req: Request, res: Response) => {
    const parseRes = parseInput(InviteGetRequestSchema, req, res)
    if(parseRes.success){
      const userId = parseRes.user
      const data = await (await getFilter(collectionEnum.Invite, {invited: userId}, {invited: 0})).toArray()
      parseOutput(InviteGetRequestSchema, data, res)
    }
  });
  
  //Delete a group invitation. 
  //No longer needed, old implementation is part of post/group/invite/respond
  /*
  router.delete("/group/invite", async (req: Request, res: Response) => {
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
  router.post("/invite/respond", async (req: Request, res: Response) => {
    const inviteResponse = parseInput(InviteRespondRequestSchema, req, res)
    if(inviteResponse.success){
      const inviteId = inviteResponse.invite
      if(inviteResponse.accepted == true){
        const userId = inviteResponse.user
        const groupData = await get(collectionEnum.Invite, inviteId)
        if (groupData == null){
          res.status(404).send("Invite not found")
          return
        }
        update(collectionEnum.Group, groupData['group'], {
          $push: {users: userId}
        })
        update(collectionEnum.User, userId, {
          $push: {groups: groupData['group']}
        })
        console.log("added group:" + groupData['group'] + ". To user:" + userId)
      }
      await remove(collectionEnum.Invite, {_id: inviteId})
      parseOutput(InviteRespondRequestSchema, {}, res)
    }
  });
  
  
  //group/remove ----------------------
  //Remove user from group.
  router.post("/remove", async (req: Request, res: Response) => {
    const parseRes = parseInput(GroupRemoveRequestSchema, req, res)
    if(parseRes.success){
      const groupId = parseRes.group
      const userId = parseRes.user
      update(collectionEnum.Group, groupId, {
        $pull: {users: userId} 
      })
      update(collectionEnum.User,  userId, {
        $pull: {groups: groupId} 
      })
      parseOutput(GroupRemoveRequestSchema, {},res)
  
      const emptyGroups = await getFilter(collectionEnum.Group, {users : {$size: 0}}, {_id: 1})
      for(const group of await emptyGroups.toArray()){
        remove(collectionEnum.Goal, {group: group._id.toString()})
        remove(collectionEnum.Group, {_id: group._id.toString()})
        console.log(group._id)
      }
    }
  });
  
  //Group/goal ------------------------
  //Create goal.
  router.post("/goal", async (req: Request, res: Response) => {
    const parseRes = parseInput(GroupGoalCreateRequestSchema, req, res)
    if(parseRes.success){
      const group = {
        title: parseRes.title,
        activity: parseRes.activity,
        metric: parseRes.metric,
        target: parseRes.target,
        group: parseRes.group,
        progress: []
      }
      if(await existFilter(collectionEnum.Group, {_id: parseRes.group, users: parseRes.user})){
        const response = {
          uuid: (await insert(collectionEnum.Goal, group)).toString()
        }
        parseOutput(GroupGoalCreateRequestSchema, response, res)
      }
      else{
        res.status(401).send("Not a member of group")
      }
      
    }
  
  });
  
  //Delete goal.
  router.delete("/goal", async (req: Request, res: Response) => {
    const parseRes = parseInput(GoalDeleteRequestSchema, req, res)
    if(parseRes.success){
      console.log(parseRes)
      const userId = parseRes.user
      const goalId = parseRes.uuid
  
      //Check if user should be able to delete goalId
      const groupObjArray = await (await getFilter(collectionEnum.Group, {users: userId}, {_id: 1})).toArray()
      const groupIdArray = []
      for(const object of groupObjArray){
        groupIdArray.push(object._id.toString())
      }
      remove(collectionEnum.Goal, {group: {$in: groupIdArray}, _id: goalId})
  
      parseOutput(GoalDeleteRequestSchema, {}, res)
    }
  });
  