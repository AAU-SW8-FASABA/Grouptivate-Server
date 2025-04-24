import { parseInput, parseOutput } from '../../../src/schemaParsers';
import {
    insert,
    collectionEnum,
    update,
    existFilter,
    getFilter,
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

export const router = express.Router();

//Group/goal ------------------------
//Create goal.
router.post('/', async (req: Request, res: Response) => {
    const parseRes = parseInput(GroupGoalCreateRequestSchema, req, res);
    if (parseRes.success) {
        const group = {
            title: parseRes.title,
            activity: parseRes.activity,
            metric: parseRes.metric,
            target: parseRes.target,
            group: parseRes.group,
            progress: [],
        };
        if (
            await existFilter(collectionEnum.Group, {
                _id: parseRes.group,
                users: parseRes.user,
            })
        ) {
            const response = {
                uuid: (await insert(collectionEnum.Goal, group)).toString(),
            };
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
        console.log(parseRes);
        const userId = parseRes.user;
        const goalId = parseRes.uuid;

        //Check if user should be able to delete goalId
        const groupObjArray = await (
            await getFilter(collectionEnum.Group, { users: userId }, { _id: 1 })
        ).toArray();
        const groupIdArray: Array<string> = [];
        for (const object of groupObjArray) {
            groupIdArray.push(object._id.toString());
        }
        remove(collectionEnum.Goal, {
            group: { $in: groupIdArray },
            _id: goalId,
        });

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
            const response = {
                uuid: (
                    await insert(collectionEnum.Goal, individualGoal)
                ).toString(),
            };
            parseOutput(IndividualGoalCreateRequestSchema, response, res);
        } else {
            res.status(401).send('Not a member of group');
        }
    }
});

router.delete('/individual', async (req: Request, res: Response) => {
    const parseRes = parseInput(GoalDeleteRequestSchema, req, res);
    if (parseRes.success) {
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

        //This will drop any goals that the user should not have acces to, but will do so silently
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
