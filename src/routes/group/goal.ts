import express, { type Request, type Response } from 'express';
import * as v from 'valibot';
import MG from 'mongoose';
import { parseInput, parseOutput } from '../../schemaParsers';
import {
    insert,
    CollectionEnum,
    update,
    existFilter,
    getFilter,
    remove,
    get,
} from '../../db';
import {
    GoalDeleteRequestSchema,
    GoalCreateRequestSchema,
    GoalPatchRequestSchema,
    GoalType,
} from '../../../Grouptivate-API/schemas/Goal';
import GroupModel from '../../models/GroupModel';
import GoalModel from '../../models/GoalModel';
import { getParsedSearchParams } from '../../helpers/searchParamHelpers';

export const router = express.Router();

//Group/goal ------------------------ Bread
//Create goal.
router.post('/', async (req: Request, res: Response) => {
    const parsedParams = getParsedSearchParams(
        GoalCreateRequestSchema.searchParams,
        req,
    );

    if (!parsedParams.group.success) {
        const error = 'Request did not include a valid group id';
        console.log(`'GET' @ '/group': ${error}`);
        res.status(404).json({ error });
        return;
    }

    const parsedBody = v.safeParse(
        GoalCreateRequestSchema.requestBody,
        req.body,
    );

    if (!parsedBody.success) {
        const error = `Failed to parse input`;
        console.log(`'post' @ 'group/goal': `, parsedBody.issues);
        res.status(400).json({ error });
        return;
    }

    if (
        parsedBody.output.type === GoalType.Individual &&
        !parsedParams.user.success
    ) {
        const error = 'Request did not include a user uuid';
        console.log(`'GET' @ '/group': ${error}`);
        res.status(404).json({ error });
        return;
    }

    const group = await GroupModel.findById(parsedParams.group.output);

    // Error if group does not exist
    if (!group) {
        const error = 'Invalid group';
        console.log(`'GET' @ '/group/goal': ${error}`);
        res.status(404).json({ error });
        return;
    }

    // Error if user is not in group
    if (!group.userIds.includes(req.userId)) {
        const error = 'User is not a member of the group';
        console.log(`'GET' @ '/group/goal': ${error}`);
        res.status(401).json({ error });
        return;
    }

    // Insert new goal with progress being { 'userId': 0 } for all users, or a singular user for individual goals
    const goal = await GoalModel.insertOne({
        type: parsedBody.output.type,
        title: parsedBody.output.title,
        activity: parsedBody.output.activity,
        metric: parsedBody.output.metric,
        target: parsedBody.output.target,
        progress:
            parsedBody.output.type === GoalType.Individual &&
            parsedParams.user.success
                ? {
                      [parsedParams.user.output]: 0,
                  }
                : Object.fromEntries(
                      group.userIds.map((userId) => [userId, 0]),
                  ),
    });

    // Update the group to have the goal in goalIds
    await GroupModel.findByIdAndUpdate(parsedParams.group.output, {
        $push: { goalIds: goal._id },
    });

    // Parse response body
    const parsedResponse = v.safeParse(GoalCreateRequestSchema.responseBody, {
        uuid: goal._id,
    });

    if (!parsedResponse.success) {
        const error = `Failed to parse response body at 'POST' for '/group/goal'`;
        console.log(error + ': ', parsedResponse.issues);
        res.status(500).json({ error });
        return;
    }

    res.status(200).json(parsedResponse.output);
});

//Delete goal.
router.delete('/', async (req: Request, res: Response) => {
    const parsedBody = v.safeParse(
        GoalDeleteRequestSchema.requestBody,
        req.body,
    );

    if (!parsedBody.success) {
        const error = 'Failed to parse request body';
        console.log(`'delete' @ '/group/goal': ${error}`);
        res.status(404).json({ error });
        return;
    }

    const group = await GroupModel.findOne({ goalIds: parsedBody.output.uuid });

    if (!group) {
        const error = 'Failed to find group';
        console.log(`'delete' @ '/group/goal': ${error}`);
        res.status(404).json({ error });
        return;
    }

    if (!group.userIds.includes(req.userId)) {
        const error = 'User not in group';
        console.log(`'delete' @ '/group/goal': ${error}`);
        res.status(401).json({ error });
        return;
    }

    await GroupModel.updateOne(
        { _id: group._id },
        { $pull: { goalIds: parsedBody.output.uuid } },
    );

    await GoalModel.findByIdAndDelete(parsedBody.output.uuid);

    res.sendStatus(200);
});

//Create individual goal
// router.post('/individual', async (req: Request, res: Response) => {
//     const parseRes = parseInput(IndividualGoalCreateRequestSchema, req, res);
//     if (parseRes.success) {
//         const individualGoal = {
//             title: parseRes.title,
//             activity: parseRes.activity,
//             metric: parseRes.metric,
//             target: parseRes.target,
//             user: parseRes.user,
//             progress: 0,
//         };
//         if (
//             await existFilter(CollectionEnum.Group, {
//                 _id: parseRes.group,
//                 users: parseRes.createruuid,
//             })
//         ) {
//             const response = {
//                 //TODO: Fix individual goals
//                 uuid: (
//                     await insert(CollectionEnum.GroupGoal, individualGoal)
//                 ).toString(),
//             };
//             parseOutput(IndividualGoalCreateRequestSchema, response, res);
//         } else {
//             res.status(401).send('Not a member of group');
//         }
//     }
// });

// router.delete('/individual', async (req: Request, res: Response) => {
//     const parseRes = parseInput(GoalDeleteRequestSchema, req, res);
//     if (parseRes.success) {
//     }
// });

// //Patch goal
// router.patch('/', async (req: Request, res: Response) => {
//     const parseRes = parseInput(GoalPatchRequestSchema, req, res);
//     if (parseRes.success) {
//         //check if group or individual
//         console.log(parseRes);
//         if (safeParse(GroupGoalSchema, parseRes).success) {
//             console.log('Group!');
//         } else if (safeParse(GroupSchema, parseRes).success) {
//             console.log('Individual!');
//         } else {
//             console.log(':(');
//             //Should not be possible
//         }
//     }
// });
