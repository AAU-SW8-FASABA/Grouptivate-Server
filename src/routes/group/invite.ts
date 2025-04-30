import express, { type Request, type Response } from 'express';
import * as v from 'valibot';
import {
    InviteCreateRequestSchema,
    InviteGetRequestSchema,
    InviteRespondRequestSchema,
} from '../../../Grouptivate-API/schemas/Invite';
import { GoalType } from '../../../Grouptivate-API/schemas/Goal';
import InviteModel from '../../models/InviteModel';
import GroupModel from '../../models/GroupModel';
import {
    getGroupNameById,
    getNameById,
    getUserIdByName,
} from '../../helpers/userHelpers';
import { getParsedSearchParams } from '../../helpers/searchParamHelpers';
import UserModel from '../../models/UserModel';
import GoalModel from '../../models/GoalModel';

export const router = express.Router();

//Group/invite ------------------
//Create a group invitation.
// TODO: Only one invite
router.post('/', async (req: Request, res: Response) => {
    const parsedBody = v.safeParse(
        InviteCreateRequestSchema.requestBody,
        req.body,
    );

    if (!parsedBody.success) {
        const error = 'Unable to parse the request body';
        console.log(`'post' @ '/group/invite': ${error}`);
        res.status(404).json({ error });
        return;
    }

    const group = await GroupModel.findById(parsedBody.output.groupId);

    // Error if group does not exist
    if (!group) {
        const error = 'Invalid group';
        console.log(`'post' @ '/group/invite': ${error}`);
        res.status(404).json({ error });
        return;
    }

    // Error if user is not in group
    if (!group.userIds.includes(req.userId)) {
        const error = 'User is not a member of the group';
        console.log(`'post' @ '/group/invite': ${error}`);
        res.status(401).json({ error });
        return;
    }

    const inviteeId = await getUserIdByName(parsedBody.output.inviteeName);

    if (!inviteeId) {
        const error = 'This username does not exist';
        console.log(`'post' @ '/group/invite': ${error}`);
        res.status(401).json({ error });
        return;
    }

    await InviteModel.insertOne({
        groupId: parsedBody.output.groupId,
        inviteeId: inviteeId,
        inviterId: req.userId,
    });

    res.sendStatus(200);
});

//Get group invitations.
router.get('/', async (req: Request, res: Response) => {
    const invites = await InviteModel.find({ inviteeId: req.userId });

    const response = await Promise.all(
        invites.map(async (invite) => {
            return {
                inviteId: invite.id,
                groupName: await getGroupNameById(invite.groupId),
                inviterName: await getNameById(invite.inviterId),
            };
        }),
    );

    const parsedResponse = v.safeParse(
        InviteGetRequestSchema.responseBody,
        response,
    );

    if (!parsedResponse.success) {
        const error = 'Unable to parse response';
        console.log(
            `'GET' @ '/group/invite': ${error} - ${parsedResponse.issues}`,
        );
        res.status(500).json({ error });
        return;
    }

    res.status(200).json(parsedResponse.output);
});

//TODO: Why is this no longer needed?
//Delete a group invitation.
//No longer needed, old implementation is part of post/group/invite/respond
/*
  router.delete("/group/invite", async (req: Request, res: Response) => {
    const inviteIdResult = safeParse(UuidSchema,req.body.uuid)
    if(inviteIdResult.success){
      const inviteuuid = new ObjectId(inviteIdResult.output)
      const result = await remove(CollectionEnum.Invite, {_id: inviteuuid})
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
    const parsedParams = getParsedSearchParams(
        InviteRespondRequestSchema.searchParams,
        req,
    );

    if (!parsedParams.invite.success) {
        const error = 'Request did not include an invite id';
        console.log(`'GET' @ '/group/invite/respond': ${error}`);
        res.status(404).json({ error });
        return;
    }

    const parsedBody = v.safeParse(
        InviteRespondRequestSchema.requestBody,
        req.body,
    );

    if (!parsedBody.success) {
        const error = 'Unable to parse the request body';
        console.log(`'post' @ '/group/invite/respond': ${error}`);
        res.status(404).json({ error });
        return;
    }

    const invite = await InviteModel.findById(parsedParams.invite.output);

    if (!invite) {
        const error = 'Invite does not exist';
        console.log(`'post' @ '/group/invite/respond': ${error}`);
        res.status(400).json({ error });
        return;
    }

    if (invite.inviteeId !== req.userId) {
        const error = 'Invite is not for this user';
        console.log(`'post' @ '/group/invite/respond': ${error}`);
        res.status(400).json({ error });
        return;
    }

    // if accepted = join group + add userid: 0 to all group goal progress THEN delete invite
    if (parsedBody.output.accepted) {
        const group = await GroupModel.findById(invite.groupId);

        if (!group) {
            const error = 'Group does not exist';
            console.log(`'post' @ '/group/invite/respond': ${error}`);
            res.status(400).json({ error });
            return;
        }

        const user = await UserModel.findById(req.userId);

        if (!user) {
            const error = 'User does not exist';
            console.log(`'post' @ '/group/invite/respond': ${error}`);
            res.status(400).json({ error });
            return;
        }

        group.userIds.push(req.userId);
        await group.save();
        user.groupIds.push(invite.groupId);
        await user.save();

        for (const goalId of group.goalIds) {
            const goal = await GoalModel.findById(goalId);
            if (!goal || goal.type === GoalType.Individual) continue;

            goal.progress.set(req.userId, 0);
            goal.save();
        }
    }

    await InviteModel.findByIdAndDelete(parsedParams.invite.output);

    // const inviteResponse = parseInput(InviteRespondRequestSchema, req, res);
    // if (inviteResponse.success) {
    //     const inviteId = inviteResponse.invite;
    //     if (inviteResponse.accepted == true) {
    //         const userId = inviteResponse.user;
    //         const groupData = await get(CollectionEnum.Invite, inviteId);
    //         if (groupData == null) {
    //             res.status(404).send('Invite not found');
    //             return;
    //         }
    //         update(CollectionEnum.Group, groupData['group'], {
    //             $push: { users: userId },
    //         });
    //         update(CollectionEnum.User, userId, {
    //             $push: { groups: groupData['group'] },
    //         });
    //         console.log(
    //             'added group:' + groupData['group'] + '. To user:' + userId,
    //         );
    //     }
    //     await remove(CollectionEnum.Invite, { _id: inviteId });
    //     parseOutput(InviteRespondRequestSchema, {}, res);
    // }
});
