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

function setCookie(res: Response, token: string) {
    res.cookie('Authorization', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
    });
}

//TODO: sendError helper? MAYBE (maybe even custom safeParse call that also logs and s)

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

    // Check if a user with this name already exists
    const exists = await UserModel.findOne({ name: parsedBody.output.name });
    if (exists !== null) {
        res.status(409).send('User with this name already exists');
        return;
    }

    // Insert user
    const id = await UserModel.insertOne({
        name: parsedBody.output.name,
        password: await argon2.hash(parsedBody.output.password),
        groupIds: [],
        lastSync: new Date(0).toISOString(),
    });

    // Create token
    const token = crypto.randomBytes(32).toString('hex');
    await SessionModel.insertOne({ token, userId: id });

    // Set Authorization cookie
    setCookie(res, token);

    // Send response
    res.sendStatus(200);
});

//Get user information.
router.get('/', async (req: Request, res: Response) => {
    const user = await UserModel.findOne({ _id: req.userId });

    // Check if a user was found
    if (!user) {
        const error = `User not found`;
        console.log(error);
        res.status(404).json({ error });
        return;
    }

    // Parse response body
    const parsedOutput = v.safeParse(UserGetRequestSchema.responseBody, {
        uuid: user._id,
        name: user.name,
        groups: user.groupIds,
    });

    if (!parsedOutput.success) {
        const error = `Failed to parse response body at 'GET' for '/user'`;
        console.log(error + ': ', parsedOutput.issues);
        res.status(500).json({ error });
        return;
    }

    // Send response
    res.status(200).json(parsedOutput.output);
});

// The session token has already been verified by the middleware
router.post('/verify', async (req: Request, res: Response) => {
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

    //TODO: Is this a correct way to generate session tokens?
    const token = crypto.randomBytes(32).toString('hex');
    await SessionModel.insertOne({ token, userId: user._id });

    // Set Authorization cookie
    setCookie(res, token);

    // Send response
    res.sendStatus(200);
});
