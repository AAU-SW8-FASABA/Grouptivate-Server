import express, { type Request, type Response } from "express";
import * as v from "valibot";
import {
	GoalDeleteRequestSchema,
	GoalCreateRequestSchema,
	GoalPatchRequestSchema,
	GoalType,
} from "../../../Grouptivate-API/schemas/Goal";
import GroupModel from "../../models/GroupModel";
import GoalModel from "../../models/GoalModel";
import { getParsedSearchParams } from "../../helpers/searchParamHelpers";
import { StatusCode } from "../../dbEnums";
import logRequest from "../../helpers/log";

export const router = express.Router();

//Group/goal ------------------------
//Create goal.
router.post("/", async (req: Request, res: Response) => {
	const parsedParams = getParsedSearchParams(
		GoalCreateRequestSchema.searchParams,
		req,
	);

	if (!parsedParams.groupId.success) {
		const error = "Request did not include a valid group id";
		logRequest(req, `${error}`, parsedParams);
		res.status(StatusCode.BAD_REQUEST).json({ error });
		return;
	}

	const parsedBody = v.safeParse(
		GoalCreateRequestSchema.requestBody,
		req.body,
	);

	if (!parsedBody.success) {
		const error = `Failed to parse input`;
		logRequest(req, `${error}`, parsedBody.issues);
		res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ error });
		return;
	}

	if (
		parsedBody.output.type === GoalType.Individual &&
		!parsedParams.userId.success
	) {
		const error = "Request did not include a user id";
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

	// Insert new goal with progress being { 'userId': 0 } for all users, or a singular user for individual goals
	const goal = await GoalModel.insertOne({
		type: parsedBody.output.type,
		title: parsedBody.output.title,
		activity: parsedBody.output.activity,
		metric: parsedBody.output.metric,
		target: parsedBody.output.target,
		progress:
			parsedBody.output.type === GoalType.Individual &&
			parsedParams.userId.success
				? {
						[parsedParams.userId.output]: 0,
					}
				: Object.fromEntries(
						group.userIds.map((userId) => [userId, 0]),
					),
	});

	// Update the group to have the goal in goalIds
	await GroupModel.findByIdAndUpdate(parsedParams.groupId.output, {
		$push: { goalIds: goal._id },
	});

	// Parse response body
	const parsedResponse = v.safeParse(GoalCreateRequestSchema.responseBody, {
		goalId: goal.id,
	});

	if (!parsedResponse.success) {
		const error = `Failed to parse response body`;
		logRequest(req, `${error}`, parsedResponse.issues);
		res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ error });
		return;
	}

	res.status(StatusCode.CREATED).json(parsedResponse.output);
});

//Delete goal.
router.delete("/", async (req: Request, res: Response) => {
	const parsedBody = v.safeParse(
		GoalDeleteRequestSchema.requestBody,
		req.body,
	);

	if (!parsedBody.success) {
		const error = "Failed to parse request body";
		logRequest(req, `${error}`, parsedBody.issues);
		res.status(StatusCode.BAD_REQUEST).json({ error });
		return;
	}

	const group = await GroupModel.findOne({
		goalIds: parsedBody.output.goalId,
	});

	if (!group) {
		const error = "Failed to find group";
		logRequest(req, error);
		res.status(StatusCode.NOT_FOUND).json({ error });
		return;
	}

	if (!group.userIds.includes(req.userId)) {
		const error = "User not in group";
		logRequest(req, error);
		res.status(StatusCode.FORBIDDEN).json({ error });
		return;
	}

	await GroupModel.updateOne(
		{ _id: group._id },
		{ $pull: { goalIds: parsedBody.output.goalId } },
	);

	await GoalModel.findByIdAndDelete(parsedBody.output.goalId);

	res.sendStatus(StatusCode.NO_CONTENT);
});

router.patch("/", async (req: Request, res: Response) => {
	const parsedBody = v.safeParse(
		GoalPatchRequestSchema.requestBody,
		req.body,
	);

	if (!parsedBody.success) {
		const error = "Failed to parse request body";
		logRequest(req, `${error}`, parsedBody.issues);
		res.status(StatusCode.BAD_REQUEST).json({ error });
		return;
	}

	// Check if the user is part of the given groups
	const goalIds = parsedBody.output.map((elem) => elem.goalId);
	const groups = await GroupModel.find({
		goalIds: { $in: goalIds },
	});

	const userIsPartOfAllGroups = groups.every((group) =>
		group.userIds.includes(req.userId),
	);

	if (!userIsPartOfAllGroups) {
		const error = "User is not part of all corresponding groups";
		logRequest(req, error);
		res.status(StatusCode.FORBIDDEN).json({ error });
		return;
	}

	// Check if all goals exist
	const goals = await GoalModel.find({
		_id: { $in: goalIds },
	});

	if (goals.length !== goalIds.length) {
		const error = "List contains invalid goals";
		logRequest(req, error);
		res.status(StatusCode.NOT_FOUND).json({ error });
		return;
	}

	// Make sure that the user does not attempt to update an individual goal that does not belong to them
	for (const goal of goals) {
		if (goal.type === GoalType.Group) continue;
		if (goal.progress.get(req.userId) === undefined) {
			const error =
				"User attempted to patch an individual goal that do not belong to them";
			logRequest(req, error);
			res.status(StatusCode.FORBIDDEN).json({ error });
			return;
		}
	}

	// Update the given goals
	const progressUpdates = parsedBody.output.map(async (progressUpdate) => {
		return await GoalModel.findByIdAndUpdate(progressUpdate.goalId, {
			[`progress.${req.userId}`]: progressUpdate.progress,
		});
	});

	await Promise.all(progressUpdates);

	res.sendStatus(StatusCode.OK);
});
