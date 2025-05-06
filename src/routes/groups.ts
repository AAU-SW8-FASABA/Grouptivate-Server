import express, { type Request, type Response } from "express";
import * as v from "valibot";

import GroupModel from "../models/GroupModel";
import GoalModel from "../models/GoalModel";
import { GroupsGetRequestSchema } from "../../Grouptivate-API/schemas/Group";
import { getUserMap } from "../helpers/userHelpers";
import { StatusCode } from "../dbEnums";
import logRequest from "../helpers/log";

export const router = express.Router();

// Get all groups info.
router.get("/", async (req: Request, res: Response) => {
	const groups = await GroupModel.find({ userIds: req.userId });

	const formattedGroups = await Promise.all(
		groups.map(async (group) => {
			const [userMap, goals] = await Promise.all([
				getUserMap(group.userIds),
				GoalModel.find({
					_id: { $in: group.goalIds },
				}),
			]);

			if (userMap.size === 0) {
				logRequest(req, `skipping ${group.id} due to no users`);
				return null;
			}

			return {
				groupId: group.id,
				groupName: group.name,
				users: Object.fromEntries(userMap),
				interval: group.interval,
				goals: goals.map((goal) => {
					return {
						goalId: goal.id,
						title: goal.title,
						type: goal.type,
						activity: goal.activity,
						metric: goal.metric,
						target: goal.target,
						progress: Object.fromEntries(goal.progress),
					};
				}),
				streak: group.streak,
			};
		}),
	);

	if (formattedGroups.some((group) => group === null)) {
		const error = "One or more groups had 0 users, and are thus invalid";
		logRequest(req, error);
		res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ error });
		return;
	}

	const parsedResponse = v.safeParse(
		GroupsGetRequestSchema.responseBody,
		formattedGroups,
	);

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
