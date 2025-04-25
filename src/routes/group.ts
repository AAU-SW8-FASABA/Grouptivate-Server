import { parseInput, parseOutput } from '../schemaParsers';
import { insert, CollectionEnum, update, getFilter, remove, get } from '../db';
import type { Request, Response } from 'express';
import {
    GroupCreateRequestSchema,
    GroupGetRequestSchema,
    GroupRemoveRequestSchema,
} from '../../../Grouptivate-API/schemas/Group';
import { router as inviteRouter } from './group/invite';
import { router as goalRouter } from './group/goal';
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
        const groupId = await insert(CollectionEnum.Group, mockObj);

        //Add group to user table
        if (groupId == null) res.status(500).send('Failed to insert');
        else {
            update(CollectionEnum.User, parseRes.uuid, {
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
        const data = await get(CollectionEnum.Group, parseRes.uuid);
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
        update(CollectionEnum.Group, groupId, {
            $pull: { users: userId },
        });
        update(CollectionEnum.User, userId, {
            $pull: { groups: groupId },
        });
        parseOutput(GroupRemoveRequestSchema, {}, res);

        const emptyGroups = await getFilter(
            CollectionEnum.Group,
            { users: { $size: 0 } },
            { _id: 1 },
        );
        for (const group of await emptyGroups.toArray()) {
            //TODO: Fix individual goals
            remove(CollectionEnum.GroupGoal, { group: group._id.toString() });
            remove(CollectionEnum.Group, { _id: group._id.toString() });
            console.log(group._id);
        }
    }
});
