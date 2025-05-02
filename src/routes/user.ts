// API schema imports
import {
	UserCreateRequestSchema,
	UserGetRequestSchema,
} from "../../Grouptivate-API/schemas/User";
import { LoginRequestSchema } from "../../Grouptivate-API/schemas/Login";

// DB imports
import { GoalType } from "../../Grouptivate-API/schemas/Goal";
import UserModel from "../models/UserModel";
import GoalModel from "../models/GoalModel";
import SessionModel from "../models/SessionModel";

// Other imports
import type { Request, Response } from "express";
import express from "express";
import argon2 from "argon2";
import crypto from "node:crypto";
import * as v from "valibot";
import { StatusCode } from "../dbEnums";
import logRequest from "../helpers/log";

export const router = express.Router();

async function isTokenUnique(token: string) {
	return (await SessionModel.findOne({ token })) == null;
}

router.post("/", async (req: Request, res: Response) => {
	const parsedBody = v.safeParse(
		UserCreateRequestSchema.requestBody,
		req.body,
	);

	if (!parsedBody.success) {
		const error = `Failed to parse input'`;
		logRequest(req, error);
		res.status(StatusCode.BAD_REQUEST).json({ error });
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
		const error = "User with this name already exists";
		logRequest(req, error);
		res.status(StatusCode.CONFLICT).json({
			error,
		});
		return;
	}

	// Create token
	let token: string;
	do {
		token = crypto.randomBytes(32).toString("hex");
	} while (!(await isTokenUnique(token)));

	await SessionModel.insertOne({
		token,
		userId: insertResult.upsertedId.toString(),
	});

	const parsedResponse = v.safeParse(UserCreateRequestSchema.responseBody, {
		token,
		userId: insertResult.upsertedId.toString(),
	});

	if (!parsedResponse.success) {
		const error = `Failed to parse response body'`;
		logRequest(req, `${error}`, parsedResponse.issues);
		res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ error });
		return;
	}

	res.status(StatusCode.CREATED).json(parsedResponse.output);
});

// Get user information.
router.get("/", async (req: Request, res: Response) => {
	const user = await UserModel.findById(req.userId);

	// Check if a user was found
	if (!user) {
		const error = `User not found`;
		logRequest(req, error);
		res.status(StatusCode.NOT_FOUND).json({ error });
		return;
	}

	const goals = await GoalModel.find({
		type: GoalType.Individual,
		[`progress.${req.userId}`]: { $exists: true },
	});

	// Parse response body
	const parsedResponse = v.safeParse(UserGetRequestSchema.responseBody, {
		userId: user.id,
		name: user.name,
		groups: user.groupIds,
		goals: goals.map((goal) => {
			return {
				goalId: goal.id,
				type: goal.type,
				title: goal.title,
				activity: goal.activity,
				metric: goal.metric,
				target: goal.target,
				progress: Object.fromEntries(goal.progress),
			};
		}),
	});

	if (!parsedResponse.success) {
		const error = `Failed to parse response body`;
		logRequest(req, `${error}`, parsedResponse.issues);
		res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ error });
		return;
	}

	// Send response
	res.status(StatusCode.OK).json(parsedResponse.output);
});

// The session token has already been verified by the middleware
router.post("/verify", async (req: Request, res: Response) => {
	res.sendStatus(StatusCode.OK);
});

router.post("/login", async (req: Request, res: Response) => {
	const parsedRequest = v.safeParse(LoginRequestSchema.requestBody, req.body);

	if (!parsedRequest.success) {
		const error = `Failed to parse request body`;
		logRequest(req, error);
		res.status(StatusCode.BAD_REQUEST).json({
			error: parsedRequest.issues,
		});
		return;
	}

	const user = await UserModel.findOne({ name: parsedRequest.output.name });

	// Check if the user exist and the password is correct
	if (
		!user ||
		!(await argon2.verify(user.password, parsedRequest.output.password))
	) {
		const error = "Incorrect login information";
		logRequest(req, error);
		res.status(StatusCode.UNAUTHORIZED).json({ error });
		return;
	}

	let token: string;
	do {
		token = crypto.randomBytes(32).toString("hex");
	} while (!(await isTokenUnique(token)));

	// Create or overwrite session token
	await SessionModel.updateOne(
		{ userId: user._id },
		{ $set: { token } },
		{ upsert: true },
	);

	const parsedResponse = v.safeParse(LoginRequestSchema.responseBody, {
		token,
		userId: user.id,
	});

	if (!parsedResponse.success) {
		const error = `Failed to parse response body`;
		logRequest(req, `${error}`, parsedResponse.issues);
		res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ error });
		return;
	}

	res.status(StatusCode.OK).json(parsedResponse.output);
});
