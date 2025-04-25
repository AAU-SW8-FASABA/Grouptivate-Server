import {
    UserCreateRequestSchema,
    UserGetRequestSchema,
    LoginRequestSchema,
} from '../../Grouptivate-API/schemas/User';
import UserModel from '../models/UserModel';

import { parseInput, parseOutput } from '../schemaParsers';
import { insert, CollectionEnum, get, getUserByName } from '../db';
import type { Request, Response } from 'express';
import express from 'express';
import argon2 from 'argon2';
import crypto from 'node:crypto';
import * as v from 'valibot';

export const router = express.Router();

//User -----------------
//Create user
// router.post('/', async (req: Request, res: Response) => {
//     const result = parseInput(UserCreateRequestSchema, req, res);

//     if (result.success) {
//         const id = await insert(CollectionEnum.User, {
//             name: result.name,
//             password: await argon2.hash(result.password),
//             groups: [],
//             lastSync: new Date(),
//         });

//         const token = crypto.randomBytes(32).toString('hex');
//         await insert(CollectionEnum.Session, { token, id });

//         parseOutput(UserCreateRequestSchema, { token }, res);
//     }
// });

router.post('/', async (req: Request, res: Response) => {
    const parsedBody = v.safeParse(
        UserCreateRequestSchema.requestBody,
        req.body,
    );

    if (!parsedBody.success) {
        console.log(
            "Failed to parse 'post' request to '/user': ",
            parsedBody.issues,
        );
        res.status(401).send();
        return;
    }

    // Check if user with this name already exists
    const exists = await UserModel.findOne({ name: parsedBody.output.name });
    if (exists !== null) {
        console.log('User with this name already exists');
        res.status(409).send('User with this name already exists');
        return;
    }

    // Insert if possible
    const id = await UserModel.insertOne({
        name: parsedBody.output.name,
        password: await argon2.hash(parsedBody.output.password),
        groupIds: [],
        lastSync: new Date(0).toISOString(),
    });

    const token = crypto.randomBytes(32).toString('hex');

    await insert(CollectionEnum.Session, { token, userId: id });

    parseOutput(UserCreateRequestSchema, { token }, res);
});

// Check if user exists

//Get user information.
router.get('/', async (req: Request, res: Response) => {
    if (!req.sessionToken) {
        res.status(401).send('No session found');
        return;
    }

    const user = await get(CollectionEnum.User, req.sessionToken);
    if (user == null) {
        res.status(404).send('Failed to get user');
    } else {
        parseOutput(UserGetRequestSchema, user, res);
    }
});

router.post('/verify', async (req: Request, res: Response) => {
    res.cookie('session', req.sessionToken, {
        secure: true,
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days,
    });
});

router.post('/login', async (req: Request, res: Response) => {
    const result = parseInput(LoginRequestSchema, req, res);
    if (result.success) {
        const user = await getUserByName(result.name);
        if (user === null || user === undefined) {
            res.status(404).send('User not found');
            return;
        }

        const isPasswordCorrect = await argon2.verify(
            user.password,
            result.password,
        );
        if (!isPasswordCorrect) {
            res.status(401).send('Incorrect password');
            return;
        }

        const token = crypto.randomBytes(32).toString('hex');
        await insert(CollectionEnum.Session, { token, id: user._id });

        parseOutput(LoginRequestSchema, { token }, res);
    }
});

// //User/sync --------------
// //Post the information required by the GET request.
// router.post('/sync', async (req: Request, res: Response) => {
//     const parseRes = safeParse(UuidSchema, req.body.uuid);
//     if (parseRes.success) {
//         const id: string = parseRes.output;
//         const result = await update(CollectionEnum.User, id, {
//             $currentDate: {
//                 lastSync: true,
//             },
//         });
//         res.send(result);
//     } else {
//         res.status(400).send('failed to parse input');
//     }
// });

// //Get which information is required for the specified goals.
// router.get('/sync', async (req: Request, res: Response) => {
//     const userIdResult = safeParse(UuidSchema, req.body.user);
//     if (userIdResult.success) {
//         const userId = userIdResult.output; //new ObjectId(userIdResult.output)
//         console.log(userId);
//         const data = await db
//             .collection(CollectionEnum.Goal)
//             .find({ user: userId })
//             .project({ activity: 1, metric: 1, _id: 0 });
//         const goals = [];
//         for await (const doc of data) {
//             goals.push(doc);
//         }
//         res.send(JSON.stringify(goals));
//     } else {
//         res.status(400).send(userIdResult.issues);
//     }
// });
