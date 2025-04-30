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

export const router = express.Router();

//Group/goal ------------------------ Bread
//Create goal.
// TODO: Måske booming måde at håndtere SearchParams
router.post("/", async (req: Request, res: Response) => {
	const parsedParams = getParsedSearchParams(
		GoalCreateRequestSchema.searchParams,
		req,
	);

	if (!parsedParams.groupId.success) {
		const error = "Request did not include a valid group id";
		console.log(`'POST' @ '/group/goal': ${error} - `, parsedParams);
		res.status(404).json({ error });
		return;
	}

	const parsedBody = v.safeParse(
		GoalCreateRequestSchema.requestBody,
		req.body,
	);

	if (!parsedBody.success) {
		const error = `Failed to parse input`;
		console.log(`'POST' @ 'group/goal': `, parsedBody.issues);
		res.status(400).json({ error });
		return;
	}

	if (
		parsedBody.output.type === GoalType.Individual &&
		!parsedParams.userId.success
	) {
		const error = "Request did not include a user uuid";
		console.log(`'POST' @ '/group/goal': ${error}`);
		res.status(404).json({ error });
		return;
	}

	const group = await GroupModel.findById(parsedParams.groupId.output);

	// Error if group does not exist
	if (!group) {
		const error = "Invalid group";
		console.log(`'POST' @ '/group/goal': ${error}`);
		res.status(404).json({ error });
		return;
	}

	// Error if user is not in group
	if (!group.userIds.includes(req.userId)) {
		const error = "User is not a member of the group";
		console.log(`'POST' @ '/group/goal': ${error}`);
		res.status(401).json({ error });
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
		const error = `Failed to parse response body at 'POST' for '/group/goal'`;
		console.log(error + ": ", parsedResponse.issues);
		res.status(500).json({ error });
		return;
	}

	res.status(200).json(parsedResponse.output);
});

//Delete goal.
router.delete("/", async (req: Request, res: Response) => {
	const parsedBody = v.safeParse(
		GoalDeleteRequestSchema.requestBody,
		req.body,
	);

	if (!parsedBody.success) {
		const error = "Failed to parse request body";
		console.log(`'DELETE' @ '/group/goal': ${error}`);
		res.status(404).json({ error });
		return;
	}

	const group = await GroupModel.findOne({
		goalIds: parsedBody.output.goalId,
	});

	if (!group) {
		const error = "Failed to find group";
		console.log(`'DELETE' @ '/group/goal': ${error}`);
		res.status(404).json({ error });
		return;
	}

	if (!group.userIds.includes(req.userId)) {
		const error = "User not in group";
		console.log(`'DELETE' @ '/group/goal': ${error}`);
		res.status(401).json({ error });
		return;
	}

	await GroupModel.updateOne(
		{ _id: group._id },
		{ $pull: { goalIds: parsedBody.output.goalId } },
	);

	await GoalModel.findByIdAndDelete(parsedBody.output.goalId);

	res.sendStatus(200);
});
