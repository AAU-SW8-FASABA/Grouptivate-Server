import { parseInput, parseOutput } from '../../src/schemaParsers';
import {
    insert,
    collectionEnum,
    update,
    getFilter,
    remove,
    get,
} from '../../src/db';
import type { Request, Response } from 'express';
import {
    GroupCreateRequestSchema,
    GroupGetRequestSchema,
    GroupRemoveRequestSchema,
} from '../../Grouptivate-API/schemas/Group';
import { router as inviteRouter } from './invite/inviteRoutes';
import { router as goalRouter } from './goal/goalRoutes';
import express from 'express';

export const router = express.Router();

router.use('/invite', inviteRouter);
router.use('/goal', goalRouter);

router.post('/', async (req: Request, res: Response) => {
    const parseRes = parseInput(GroupCreateRequestSchema, req, res);
    if (parseRes.success) {
        const mockObj = {
            name: parseRes.name,
            users: [parseRes.user],
            interval: parseRes.interval,
            goals: [],
            streak: 0,
        };
        //Create group
        const groupId = await insert(collectionEnum.Group, mockObj);

        //Add group to user table
        if (groupId == null) res.status(500).send('Failed to insert');
        else {
            update(collectionEnum.User, parseRes.uuid, {
                $push: { groups: groupId },
            });
            parseOutput(
                GroupCreateRequestSchema,
                { uuid: groupId.toString() },
                res,
            );
        }
    }
});

//Get group info.
router.get('/', async (req: Request, res: Response) => {
    const parseRes = parseInput(GroupGetRequestSchema, req, res);
    if (parseRes.success) {
        const data = await get(collectionEnum.Group, parseRes.uuid);
        if (data == null) {
            res.status(404).send('group not found');
            return;
        }
        parseOutput(GroupGetRequestSchema, data, res);
        // res.send(convertObj(data))
    }
});

//group/remove ----------------------
//Remove user from group.
router.post('/remove', async (req: Request, res: Response) => {
    const parseRes = parseInput(GroupRemoveRequestSchema, req, res);
    if (parseRes.success) {
        const groupId = parseRes.group;
        const userId = parseRes.user;
        update(collectionEnum.Group, groupId, {
            $pull: { users: userId },
        });
        update(collectionEnum.User, userId, {
            $pull: { groups: groupId },
        });
        parseOutput(GroupRemoveRequestSchema, {}, res);

        const emptyGroups = await getFilter(
            collectionEnum.Group,
            { users: { $size: 0 } },
            { _id: 1, goals: 1 },
        );
        for (const group of await emptyGroups.toArray()) {
            await remove(collectionEnum.Group, { _id: group._id });
            remove(collectionEnum.Goal, { _id: { $in: group.goals } });
        }
    }
});
