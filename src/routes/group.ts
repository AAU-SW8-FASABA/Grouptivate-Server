import {
	GroupCreateRequestSchema,
	GroupGetRequestSchema,
	GroupRemoveRequestSchema,
} from "../../Grouptivate-API/schemas/Group";

import GroupModel from "../models/GroupModel";
import GoalModel from "../models/GoalModel";
import UserModel from "../models/UserModel";

import express, { type Request, type Response } from "express";
import * as v from "valibot";

import { router as inviteRouter } from "./group/invite";
import { router as goalRouter } from "./group/goal";

import { getParsedSearchParams } from "../helpers/searchParamHelpers";
import { getUserMap, getUserIdByName } from "../helpers/userHelpers";
import { GoalType } from "../../Grouptivate-API/schemas/Goal";
import { StatusCode } from "../dbEnums";
import logRequest from "../helpers/log";

export const router = express.Router();

router.use("/invite", inviteRouter);
router.use("/goal", goalRouter);

// TODO: Increment streak

router.post("/", async (req: Request, res: Response) => {
	const parsedBody = v.safeParse(
		GroupCreateRequestSchema.requestBody,
		req.body,
	);

	if (!parsedBody.success) {
		const error = "Unable to parse the request body";
		logRequest(
			req,
			`${error}`,
			parsedBody.issues.map((issue) => issue.message),
		);
		res.status(StatusCode.BAD_REQUEST).json({ error });
		return;
	}

	// Inserts a group
	const group = await GroupModel.insertOne({
		name: parsedBody.output.groupName,
		interval: parsedBody.output.interval,
		userIds: [req.userId],
		goalIds: [],
		streak: 0,
	});

	// Insert group in user's db entry
	await UserModel.updateOne(
		{ _id: req.userId },
		{ $push: { groupIds: group._id } },
	);

	// Create response object
	const parsedResponse = v.safeParse(GroupCreateRequestSchema.responseBody, {
		groupId: group.id,
	});

	if (!parsedResponse.success) {
		const error = "Unable to parse response body";
		logRequest(
			req,
			`${error}`,
			parsedResponse.issues.map((issue) => issue.message),
		);
		res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ error });
		return;
	}

	res.status(StatusCode.CREATED).json(parsedResponse.output);
});

// Get group info.
router.get("/", async (req: Request, res: Response) => {
	const parsedParams = getParsedSearchParams(
		GroupGetRequestSchema.searchParams,
		req,
	);

	if (!parsedParams.groupId.success) {
		const error = "Request did not include a valid groupId";
		logRequest(req, error);
		res.status(StatusCode.BAD_REQUEST).json({ error });
		return;
	}

	const group = await GroupModel.findById(parsedParams.groupId.output);

	// Error if group does not exist
	if (!group) {
		const error = "Invalid group";
		logRequest(req, error);
		res.status(StatusCode.NOT_FOUND).json({ error });
		return;
	}

	// Error if user is not in group
	if (!group.userIds.includes(req.userId)) {
		const error = "User is not a member of the group";
		logRequest(req, error);
		res.status(StatusCode.FORBIDDEN).json({ error });
		return;
	}

	// Fetch goals
	const goals = await GoalModel.find({
		_id: { $in: group.goalIds },
	});

	const userMap = await getUserMap(group.userIds);
	if (userMap.size === 0) {
		const error = "User IDs do not exist in this group";
		logRequest(req, error);
		res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ error });
		return;
	}

	// Create Response object
	const parsedResponse = v.safeParse(GroupGetRequestSchema.responseBody, {
		groupName: group.name,
		users: Object.fromEntries(userMap),
		interval: group.interval,
		goals: goals.map((elem) => {
			return {
				goalId: elem.id,
				title: elem.title,
				type: elem.type,
				activity: elem.activity,
				metric: elem.metric,
				target: elem.target,
				progress: Object.fromEntries(elem.progress),
			};
		}),
		streak: group.streak,
	});

	if (!parsedResponse.success) {
		const error = "Unable to parse response";
		logRequest(
			req,
			`${error}`,
			parsedResponse.issues.map((issue) => issue.message),
		);
		res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ error });
		return;
	}

	res.status(StatusCode.OK).json(parsedResponse.output);
});

//group/remove ----------------------
//Remove user from group.
router.post("/remove", async (req: Request, res: Response) => {
	const parsedBody = v.safeParse(
		GroupRemoveRequestSchema.requestBody,
		req.body,
	);

	if (!parsedBody.success) {
		const error = "Unable to parse the request body";
		logRequest(req, error);
		res.status(StatusCode.BAD_REQUEST).json({ error });
		return;
	}

	const group = await GroupModel.findById(parsedBody.output.groupId);

	if (!group) {
		const error = "Group does not exist";
		logRequest(req, error);
		res.status(StatusCode.NOT_FOUND).json({ error });
		return;
	}

	if (!group.userIds.includes(req.userId)) {
		const error = "Requesting user is not a member of this group";
		logRequest(req, error);
		res.status(StatusCode.FORBIDDEN).json({ error });
		return;
	}

	await GroupModel.updateOne(
		{ _id: parsedBody.output.groupId },
		{ $pull: { userIds: parsedBody.output.userId } },
	);

	await UserModel.updateOne(
		{ _id: parsedBody.output.userId },
		{ $pull: { groupIds: parsedBody.output.groupId } },
	);

	// Delete group if it is empty else update progress
	if (group.userIds.length - 1 === 0) {
		await Promise.all([
			GoalModel.deleteMany({ _id: { $in: group.goalIds } }),
			GroupModel.findByIdAndDelete(group._id),
		]);
	} else {
		const goals = await GoalModel.find({
			_id: {
				$in: group.goalIds,
			},
		});

		let promises = goals.map(async (goal) => {
			if (goal.type === GoalType.Individual) {
				// Remove goal from group
				await GroupModel.findByIdAndUpdate(group._id, {
					$pull: { goalIds: goal._id },
				});
				await GoalModel.findByIdAndDelete(goal._id);
			} else {
				// Remove progress from group goal
				await GoalModel.findByIdAndUpdate(goal._id, {
					$unset: { [`progress.${parsedBody.output.userId}`]: "" },
				});
			}
		});

		await Promise.all(promises);
	}

	res.sendStatus(StatusCode.OK);
});
