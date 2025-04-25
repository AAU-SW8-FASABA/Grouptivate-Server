import {
    GroupCreateRequestSchema,
    GroupGetRequestSchema,
    GroupRemoveRequestSchema,
} from '../../Grouptivate-API/schemas/Group';

import GroupModel from '../models/GroupModel';
import GroupGoalModel from '../models/GroupGoalModel';
import IndividualGoalModel from '../models/IndividualGoalModel';
import UserModel from '../models/UserModel';

import MG from 'mongoose';
import express, { type Request, type Response } from 'express';
import * as v from 'valibot';

import { router as inviteRouter } from './group/invite';
import { router as goalRouter } from './group/goal';

import { getParsedSearchParams } from '../helpers/searchParamHelpers';
import { getUsernamesFromIds } from '../helpers/userHelpers';

export const router = express.Router();

router.use('/invite', inviteRouter);
router.use('/goal', goalRouter);

router.post('/', async (req: Request, res: Response) => {
    const parsedBody = v.safeParse(
        GroupCreateRequestSchema.requestBody,
        req.body,
    );

    if (!parsedBody.success) {
        const error = 'Unable to parse the request body';
        console.log(`'post' @ '/group': ${error}`);
        res.status(404).json({ error });
        return;
    }

    // Inserts a group
    const group = await GroupModel.insertOne({
        name: parsedBody.output.name,
        interval: parsedBody.output.interval,
        userIds: [req.userId],
        goalIds: [],
        streak: 0,
    });

    // Insert group in user's db entry
    await UserModel.updateOne(
        { _id: new MG.Types.ObjectId(req.userId) },
        { $push: { groupIds: group._id } },
    );

    // Create response object
    const parsedResponse = v.safeParse(GroupCreateRequestSchema.responseBody, {
        uuid: group._id,
    });

    if (!parsedResponse.success) {
        const error = 'Unable to parse response body';
        console.log(`'post' @ '/group': ${error}`);
        res.status(500).json({ error });
        return;
    }

    res.status(200).json(parsedResponse.output);
});

// Get group info.
router.get('/', async (req: Request, res: Response) => {
    const parsedParams = getParsedSearchParams(
        GroupGetRequestSchema.searchParams,
        req,
    );

    if (!parsedParams.uuid.success) {
        const error = 'Request did not include a valid uuid';
        console.log(`'GET' @ '/group': ${error}`);
        res.status(404).json({ error });
        return;
    }

    const group = await GroupModel.findOne({
        _id: new MG.Types.ObjectId(parsedParams.uuid.output),
    });

    // Error if group does not exist
    if (!group) {
        const error = 'Invalid group';
        console.log(`'GET' @ '/group': ${error}`);
        res.status(404).json({ error });
        return;
    }

    // Error if user is not in group
    if (!group.userIds.includes(req.userId)) {
        const error = 'User is not a member of the group';
        console.log(`'GET' @ '/group': ${error}`);
        res.status(401).json({ error });
        return;
    }

    // Fetch goals
    const goalObjectIDs = group.goalIds.map((v) => new MG.Types.ObjectId(v));
    const groupGoals = await GroupGoalModel.find({
        _id: { $in: goalObjectIDs },
    });
    const individualGoals = await IndividualGoalModel.find({
        _id: { $in: goalObjectIDs },
    });

    const userNames = await getUsernamesFromIds(group.userIds);
    if (!userNames) {
        const error = 'User does not exist';
        console.log(`'GET' @ '/group': ${error}`);
        res.status(500).json({ error });
    }

    // Create Response object
    const parsedResponse = v.safeParse(GroupGetRequestSchema.responseBody, {
        name: group.name,
        users: userNames,
        interval: group.interval,
        goals: [
            ...groupGoals.map((elem) => {
                return {
                    uuid: elem._id,
                    title: elem.title,
                    activity: elem.activity,
                    metric: elem.metric,
                    target: elem.target,
                    progress: elem.progress,
                };
            }),
            ...individualGoals.map((elem) => {
                return {
                    uuid: elem._id,
                    title: elem.title,
                    activity: elem.activity,
                    metric: elem.metric,
                    target: elem.target,
                    user: elem.userId,
                    progress: elem.progress,
                };
            }),
        ],
        streak: group.streak,
    });

    if (!parsedResponse.success) {
        const error = 'Unable to parse response';
        console.log(`'GET' @ '/group': ${error} - ${parsedResponse.issues}`);
        res.status(500).json({ error });
        return;
    }

    res.status(200).json(parsedResponse.output);
});

//group/remove ----------------------
//Remove user from group.
router.post('/remove', async (req: Request, res: Response) => {
    const parsedBody = v.safeParse(
        GroupRemoveRequestSchema.requestBody,
        req.body,
    );

    if (!parsedBody.success) {
        const error = 'Unable to parse the request body';
        console.log(`'post' @ '/group/remove': ${error}`);
        res.status(500).json({ error });
        return;
    }

    const group = await GroupModel.findOne({
        _id: new MG.Types.ObjectId(parsedBody.output.group),
        userIds: {
            $in: [parsedBody.output.user],
        },
    });

    if (!group) {
        const error = 'Requesting user is not a member of this group';
        console.log(`'post' @ '/group/remove': ${error}`);
        res.status(500).json({ error });
        return;
    }

    await GroupModel.updateOne(
        { _id: new MG.Types.ObjectId(parsedBody.output.group) },
        { $pull: { userIds: parsedBody.output.user } },
    );

    await UserModel.updateOne(
        { _id: new MG.Types.ObjectId(parsedBody.output.user) },
        { $pull: { groupIds: parsedBody.output.group } },
    );

    if (group?.userIds.length === 0) {
        const objectIDs = group.goalIds.map((v) => new MG.Types.ObjectId(v));
        await Promise.all([
            GroupGoalModel.deleteMany({ _id: { $in: objectIDs } }),
            IndividualGoalModel.deleteMany({ _id: { $in: objectIDs } }),
            GroupModel.findByIdAndDelete(group._id),
        ]);
    }

    res.sendStatus(200);
});
