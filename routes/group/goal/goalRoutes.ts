import { parseInput, parseOutput } from '../../../src/schemaParsers';
import {
    insert,
    collectionEnum,
    update,
    existFilter,
    getFilter,
    findOneFilter,
    remove,
    get
} from '../../../src/db';
import type { Request, Response } from 'express';
import {
    GroupGoalCreateRequestSchema,
    GoalDeleteRequestSchema,
    IndividualGoalCreateRequestSchema,
    GoalPatchRequestSchema,
} from '../../../Grouptivate-API/schemas/Goal';
import express from 'express';

export const router = express.Router();

//Group/goal ------------------------
//Create goal.
router.post('/', async (req: Request, res: Response) => {
    const parseRes = parseInput(GroupGoalCreateRequestSchema, req, res);
    if (parseRes.success) {
        if (
            await existFilter(collectionEnum.Group, {
                _id: parseRes.group,
                users: parseRes.user,
            })
        ) {
            const groupData =
                (await get(collectionEnum.Group, parseRes.group)) ?? [];
            const goalProgress = {};
            for (let user of groupData['users'])
                goalProgress[user.toString()] = 0;
            const groupGoal = {
                title: parseRes.title,
                activity: parseRes.activity,
                metric: parseRes.metric,
                target: parseRes.target,
                progress: goalProgress,
            };
            const goalId = (
                await insert(collectionEnum.Goal, groupGoal)
            ).toString();
            const response = {
                uuid: goalId,
            };
            update(collectionEnum.Group, parseRes.group, {
                $push: { goals: goalId },
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
            goals: goalId,
        });
        if (groupData == null) {
            res.status(404).send('group not found, or no access to group');
            return;
        }
        await update(collectionEnum.Group, groupData['_id'].toString(), {
            $pull: { goals: goalId },
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
                $push: { goals: goalId },
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
        const goals = parseRes.body.reduce((obj, item) => {
            obj[item.uuid] = item.progress;
            return obj;
        }, {});

        //This will drop any goals that the user should not have access to, but will do so silently
        const idObjArray = await (
            await getFilter(
                collectionEnum.Group,
                { users: parseRes.user, goals: { $in: Object.keys(goals) } },
                { _id: 0, goals: 1 },
            )
        ).toArray();

        const validGoalIds = idObjArray.reduce(
            (accumulator, value) => accumulator.concat(value.goals),
            [],
        );
        const goalObjArray = await (
            await getFilter(collectionEnum.Goal, { _id: { $in: validGoalIds } })
        ).toArray();

        for (const goal of goalObjArray) {
            if ('user' in goal) {
                //idividual goal
                update(collectionEnum.Goal, goal._id, {
                    $inc: { progress: goals[goal._id] },
                });
            } else {
                //group goal
                const field: string = 'progress.' + parseRes.user;
                update(collectionEnum.Goal, goal._id, {
                    $inc: { [field]: goals[goal._id] },
                });
            }
        }
        parseOutput(GoalPatchRequestSchema, {}, res);
    }
});
