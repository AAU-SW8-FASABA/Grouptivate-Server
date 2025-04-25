// API schema imports
import {
    UserCreateRequestSchema,
    UserGetRequestSchema,
} from '../../Grouptivate-API/schemas/User';
import { LoginRequestSchema } from '../../Grouptivate-API/schemas/Login';

// DB imports
import UserModel from '../models/UserModel';
import SessionModel from '../models/SessionModel';

// Other imports
import type { Request, Response } from 'express';
import express from 'express';
import argon2 from 'argon2';
import crypto from 'node:crypto';
import * as v from 'valibot';

export const router = express.Router();

async function isTokenUnique(token: string) {
    return (await SessionModel.findOne({ token })) === null;
}

router.post('/', async (req: Request, res: Response) => {
    const parsedBody = v.safeParse(
        UserCreateRequestSchema.requestBody,
        req.body,
    );

    if (!parsedBody.success) {
        const error = `Failed to parse input for 'post' request to '/user'`;
        console.log(error + ': ', parsedBody.issues);
        res.status(400).json({ error });
        return;
    }

    // Creates user if there is no existing user with that name
    const insertResult = await UserModel.updateOne(
        { name: parsedBody.output.name },
        {
            $setOnInsert: {
                name: parsedBody.output.name,
                password: await argon2.hash(parsedBody.output.password),
                groupIds: [],
                lastSync: new Date(0).toISOString(),
            },
        },
        { upsert: true },
    );

    // If the insert failed, the user already exists
    if (!insertResult.upsertedId) {
        res.status(409).send('User with this name already exists');
        return;
    }

    // Create token
    // TODO: Check if token exists
    let token: string;
    do {
        token = crypto.randomBytes(32).toString('hex');
    } while (await isTokenUnique(token));

    await SessionModel.insertOne({ token, userId: insertResult.upsertedId });

    const parsedResponse = v.safeParse(UserCreateRequestSchema.responseBody, {
        token,
    });

    if (!parsedResponse.success) {
        const error = `Failed to parse response body at 'POST' for '/user'`;
        console.log(error + ': ', parsedResponse.issues);
        res.status(500).json({ error });
        return;
    }

    res.status(200).json(parsedResponse.output);
});

//Get user information.
router.get('/', async (req: Request, res: Response) => {
    const user = await UserModel.findById(req.userId);

    // Check if a user was found
    if (!user) {
        const error = `User not found`;
        console.log(error);
        res.status(404).json({ error });
        return;
    }

    // Parse response body
    const parsedResponse = v.safeParse(UserGetRequestSchema.responseBody, {
        name: user.name,
        groups: user.groupIds,
    });

    if (!parsedResponse.success) {
        const error = `Failed to parse response body at 'GET' for '/user'`;
        console.log(error + ': ', parsedResponse.issues);
        res.status(500).json({ error });
        return;
    }

    // Send response
    res.status(200).json(parsedResponse.output);
});

// The session token has already been verified by the middleware
router.get('/verify', async (req: Request, res: Response) => {
    res.sendStatus(200);
});

router.post('/login', async (req: Request, res: Response) => {
    const parsedRequest = v.safeParse(LoginRequestSchema.requestBody, req.body);

    if (!parsedRequest.success) {
        const error = `Failed to parse body for 'POST' at '/login'`;
        console.log(error + ': ', parsedRequest.issues);
        res.status(404).json({ error });
        return;
    }

    const user = await UserModel.findOne({ name: parsedRequest.output.name });

    // Check if the user exist and the password is correct
    if (
        !user ||
        !(await argon2.verify(user.password, parsedRequest.output.password))
    ) {
        const error = 'Incorrect login information';
        console.log(`'post' @ '/login': ${error}`);
        res.status(401).json({ error });
        return;
    }

    let token: string;
    do {
        token = crypto.randomBytes(32).toString('hex');
    } while (await isTokenUnique(token));

    // Create or overwrite session token
    await SessionModel.updateOne(
        { userId: user._id },
        { $set: { token } },
        { upsert: true },
    );

    const parsedResponse = v.safeParse(LoginRequestSchema.responseBody, {
        token,
    });

    if (!parsedResponse.success) {
        const error = `Failed to parse response body at 'POST' for '/login'`;
        console.log(error + ': ', parsedResponse.issues);
        res.status(500).json({ error });
        return;
    }

    res.status(200).json(parsedResponse.output);
});
