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
} from '../../../Grouptivate-API/schemas/Goal';
import GroupModel from '../../models/GroupGoalModel';
import GroupGoalModel from '../../models/GroupGoalModel';
import IndividualGoalModel from '../../models/IndividualGoalModel';

export const router = express.Router();

//Group/goal ------------------------ Bread
//Create goal.
router.post('/', async (req: Request, res: Response) => {
    const parsedBody = v.safeParse(
        GoalCreateRequestSchema.requestBody,
        req.body,
    );

    if (!parsedBody.success) {
        const error = `Failed to parse input for 'post' request to '/goal'`;
        console.log(error + ': ', parsedBody.issues);
        res.status(400).json({ error });
        return;
    }

    const group = GroupModel.findById(parsedBody.output.activity);

    // const parseRes = parseInput(GroupGoalCreateRequestSchema, req, res);
    // if (parseRes.success) {
    //     const group = {
    //         title: parseRes.title,
    //         activity: parseRes.activity,
    //         metric: parseRes.metric,
    //         target: parseRes.target,
    //         group: parseRes.group,
    //         progress: [],
    //     };
    //     if (
    //         await existFilter(CollectionEnum.Group, {
    //             _id: parseRes.group,
    //             users: parseRes.user,
    //         })
    //     ) {
    //         const response = {
    //             // TODO: Fix individual goals
    //             uuid: (
    //                 await insert(CollectionEnum.GroupGoal, group)
    //             ).toString(),
    //         };
    //         parseOutput(GroupGoalCreateRequestSchema, response, res);
    //     } else {
    //         res.status(401).send('Not a member of group');
    //     }
    // }
});

//Delete goal.
router.delete('/', async (req: Request, res: Response) => {
    // const parseRes = parseInput(GoalDeleteRequestSchema, req, res);
    // if (parseRes.success) {
    //     console.log(parseRes);
    //     const userId = parseRes.user;
    //     const goalId = parseRes.uuid;
    //     //Check if user should be able to delete goalId
    //     const groupObjArray = await (
    //         await getFilter(CollectionEnum.Group, { users: userId }, { _id: 1 })
    //     ).toArray();
    //     const groupIdArray: Array<string> = [];
    //     for (const object of groupObjArray) {
    //         groupIdArray.push(object._id.toString());
    //     }
    //     //TODO: Fix individual goals
    //     remove(CollectionEnum.GroupGoal, {
    //         group: { $in: groupIdArray },
    //         _id: goalId,
    //     });
    //     parseOutput(GoalDeleteRequestSchema, {}, res);
    // }
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
