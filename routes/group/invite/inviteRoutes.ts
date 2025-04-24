import { parseInput, parseOutput } from '../../../src/schemaParsers';
import {
    insert,
    collectionEnum,
    update,
    getFilter,
    remove,
    get,
    updateFilter,
} from '../../../src/db';
import type { Request, Response } from 'express';
import {
    InviteCreateRequestSchema,
    InviteGetRequestSchema,
    InviteRespondRequestSchema,
} from '../../../Grouptivate-API/schemas/Invite';
import express from 'express';

export const router = express.Router();

//Group/invite ------------------
//Create a group invitation.
router.post('/', async (req: Request, res: Response) => {
    const result = parseInput(InviteCreateRequestSchema, req, res);
    if (result.success) {
        await insert(collectionEnum.Invite, {
            group: result.group,
            invited: result.invited,
            inviter: result.user,
        });

        parseOutput(InviteCreateRequestSchema, {}, res);
    }
});

//Get group invitations.
router.get('/', async (req: Request, res: Response) => {
    const parseRes = parseInput(InviteGetRequestSchema, req, res);
    if (parseRes.success) {
        const userId = parseRes.user;
        const data = await (
            await getFilter(
                collectionEnum.Invite,
                { invited: userId },
                { invited: 0 },
            )
        ).toArray();
        parseOutput(InviteGetRequestSchema, data, res);
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
router.post('/respond', async (req: Request, res: Response) => {
    const inviteResponse = parseInput(InviteRespondRequestSchema, req, res);
    if (inviteResponse.success) {
        const inviteId = inviteResponse.invite;
        if (inviteResponse.accepted == true) {
            const userId = inviteResponse.user;
            const inviteData = await get(collectionEnum.Invite, inviteId);
            if (inviteData == null) {
                res.status(404).send('Invite not found');
                return;
            }
            const groupData = await get(collectionEnum.Group, inviteData['group'])
            if (groupData == null){
                res.status(404).send('Group not found');
                return;
            }
            const field = "progress." + userId
            update(collectionEnum.Group, inviteData['group'], {
                $push: { users: userId },
            });
            updateFilter(collectionEnum.Goal, {
                _id: {$in: groupData['goals']},
                user: {$exists : false},
            },{
                $set: {[field]: 0}
            })
            update(collectionEnum.User, userId, {
                $push: { groups: inviteData['group'] },
            });
        }
        await remove(collectionEnum.Invite, { _id: inviteId });
        parseOutput(InviteRespondRequestSchema, {}, res);
    }
});
