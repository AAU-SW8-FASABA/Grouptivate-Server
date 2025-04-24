import { parseInput, parseOutput } from '../../../src/schemaParsers';
import {
    insert,
    collectionEnum,
    update,
    existFilter,
    getFilter,
    findOneFilter,
    remove,
    get,
} from '../../../src/db';
import type { Request, Response } from 'express';
import {
    GroupGoalCreateRequestSchema,
    GoalDeleteRequestSchema,
    IndividualGoalCreateRequestSchema,
    GoalPatchRequestSchema,
    GroupGoalSchema,
} from '../../../Grouptivate-API/schemas/Goal';
import express from 'express';
import { safeParse } from 'valibot';
import { GroupSchema } from '../../../Grouptivate-API/schemas/Group';
import { ObjectId } from 'mongodb';

export const router = express.Router();

//Group/goal ------------------------
//Create goal.
router.post('/', async (req: Request, res: Response) => {
    const parseRes = parseInput(GroupGoalCreateRequestSchema, req, res);
    if (parseRes.success) {
        const groupGoal = {
            title: parseRes.title,
            activity: parseRes.activity,
            metric: parseRes.metric,
            target: parseRes.target,
            progress: [],
        };
        if (
            await existFilter(collectionEnum.Group, {
                _id: parseRes.group,
                users: parseRes.user,
            })
        ) {
            const goalId = (
                await insert(collectionEnum.Goal, groupGoal)
            ).toString();
            const response = {
                uuid: goalId,
            };
            update(collectionEnum.Group, parseRes.group, {
                $push: { goals: new ObjectId(goalId) },
            });
            parseOutput(GroupGoalCreateRequestSchema, response, res);
        } else {
            res.status(401).send('Not a member of group');
        }
    }
});

//Delete goal.
router.delete('/', async (req: Request, res: Response) => {
    const parseRes = parseInput(GoalDeleteRequestSchema, req, res);
    if (parseRes.success) {
        const userId = parseRes.user;
        const goalId = parseRes.uuid;

        const groupData = await findOneFilter(collectionEnum.Group, {
            users: userId,
            goals: new ObjectId(goalId),
        });
        if (groupData == null) {
            res.status(404).send('group not found, or no access to group');
            return;
        }
        await update(collectionEnum.Group, groupData['_id'].toString(), {
            $pull: { goals: new ObjectId(goalId) },
        });
        await remove(collectionEnum.Goal, { _id: goalId });
        parseOutput(GoalDeleteRequestSchema, {}, res);
    }
});

//Create individual goal
router.post('/individual', async (req: Request, res: Response) => {
    const parseRes = parseInput(IndividualGoalCreateRequestSchema, req, res);
    if (parseRes.success) {
        const individualGoal = {
            title: parseRes.title,
            activity: parseRes.activity,
            metric: parseRes.metric,
            target: parseRes.target,
            user: parseRes.user,
            progress: 0,
        };
        if (
            await existFilter(collectionEnum.Group, {
                _id: parseRes.group,
                users: parseRes.createruuid,
            })
        ) {
            const goalId = (
                await insert(collectionEnum.Goal, individualGoal)
            ).toString();
            const response = {
                uuid: goalId,
            };
            update(collectionEnum.Group, parseRes.group, {
                $push: { goals: new ObjectId(goalId) },
            });
            parseOutput(IndividualGoalCreateRequestSchema, response, res);
        } else {
            res.status(401).send('Not a member of group');
        }
    }
});

//Patch goal
router.patch('/', async (req: Request, res: Response) => {
    const parseRes = parseInput(GoalPatchRequestSchema, req, res);
    if (parseRes.success) {
        //check if group or individual
        console.log(parseRes);
        if (safeParse(GroupGoalSchema, parseRes).success) {
            console.log('Group!');
        } else if (safeParse(GroupSchema, parseRes).success) {
            console.log('Individual!');
        } else {
            console.log(':(');
            //Should not be possible
        }
    }
});
