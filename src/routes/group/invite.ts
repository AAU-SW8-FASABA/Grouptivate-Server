import express, { type Request, type Response } from "express";
import * as v from "valibot";
import {
	InviteCreateRequestSchema,
	InviteDeleteRequestSchema,
	InviteGetRequestSchema,
	InviteRespondRequestSchema,
} from "../../../Grouptivate-API/schemas/Invite";
import { GoalType } from "../../../Grouptivate-API/schemas/Goal";
import InviteModel from "../../models/InviteModel";
import GroupModel from "../../models/GroupModel";
import {
	getGroupNameById,
	getNameById,
	getUserIdByName,
} from "../../helpers/userHelpers";
import { getParsedSearchParams } from "../../helpers/searchParamHelpers";
import UserModel from "../../models/UserModel";
import GoalModel from "../../models/GoalModel";
import { StatusCode } from "../../dbEnums";

export const router = express.Router();

//Group/invite ------------------
//Create a group invitation.
router.post("/", async (req: Request, res: Response) => {
	const parsedBody = v.safeParse(
		InviteCreateRequestSchema.requestBody,
		req.body,
	);

	if (!parsedBody.success) {
		const error = "Unable to parse the request body";
		console.log(`'POST' @ '/group/invite': ${error}`);
		res.status(StatusCode.BAD_REQUEST).json({ error });
		return;
	}

	const group = await GroupModel.findById(parsedBody.output.groupId);

	// Error if group does not exist
	if (!group) {
		const error = "Invalid group";
		console.log(`'POST' @ '/group/invite': ${error}`);
		res.status(StatusCode.BAD_REQUEST).json({ error });
		return;
	}

	// Error if user is not in group
	if (!group.userIds.includes(req.userId)) {
		const error = "User is not a member of the group";
		console.log(`'POST' @ '/group/invite': ${error}`);
		res.status(StatusCode.UNAUTHORIZED).json({ error });
		return;
	}

	const inviteeId = await getUserIdByName(parsedBody.output.inviteeName);

	if (!inviteeId) {
		const error = "This user does not exist";
		console.log(`'POST' @ '/group/invite': ${error}`);
		res.status(StatusCode.BAD_REQUEST).json({ error });
		return;
	}

	const invite = await InviteModel.findOne({
		groupId: group.id,
		inviteeId,
	});

	if (invite) {
		const error = "This user is already invited to this group";
		console.log(`'POST' @ '/group/invite': ${error}`);
		res.status(StatusCode.CONFLICT).json({ error });
		return;
	}

	await InviteModel.insertOne({
		groupId: parsedBody.output.groupId,
		inviteeId: inviteeId,
		inviterId: req.userId,
	});

	res.sendStatus(StatusCode.OK);
});

//Get group invitations.
router.get("/", async (req: Request, res: Response) => {
	const invites = await InviteModel.find({ inviteeId: req.userId });

	const response = await Promise.all(
		invites.map(async (invite) => {
			return {
				inviteId: invite.id,
				groupName: await getGroupNameById(invite.groupId),
				inviterName: await getNameById(invite.inviterId),
			};
		}),
	);

	const parsedResponse = v.safeParse(
		InviteGetRequestSchema.responseBody,
		response,
	);

	if (!parsedResponse.success) {
		const error = "Unable to parse response";
		console.log(
			`'GET' @ '/group/invite': ${error} - `,
			parsedResponse.issues,
		);
		res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ error });
		return;
	}

	res.status(StatusCode.OK).json(parsedResponse.output);
});

//Delete a group invitation.
router.delete("/group/invite", async (req: Request, res: Response) => {
	const parsedSearchParams = getParsedSearchParams(
		InviteDeleteRequestSchema.searchParams,
		req,
	);

	if (!parsedSearchParams.inviteId.success) {
		const error = "Request did not include a valid invite id";
		console.log(`'DELETE' @ '/group/invite/respond': ${error}`);
		res.status(StatusCode.NOT_FOUND).json({ error });
		return;
	}

	const invite = await InviteModel.findById(
		parsedSearchParams.inviteId.output,
	);

	if (!invite) {
		const error = "Invalid invite";
		console.log(`'DELETE' @ '/group/invite': ${error}`);
		res.status(StatusCode.NOT_FOUND).json({ error });
		return;
	}

	const group = await GroupModel.findById(invite.groupId);

	// Error if group does not exist
	if (!group) {
		const error = "Invalid group";
		console.log(`'DELETE' @ '/group/invite': ${error}`);
		res.status(StatusCode.NOT_FOUND).json({ error });
		return;
	}

	// Error if user is not in group
	if (!group.userIds.includes(req.userId)) {
		const error = "User is not a member of the group";
		console.log(`'DELETE' @ '/group/invite': ${error}`);
		res.status(StatusCode.UNAUTHORIZED).json({ error });
		return;
	}

	await InviteModel.findByIdAndDelete(invite.id);

	res.sendStatus(StatusCode.OK);
});

//group/invite/respond ---------------
//Respond to invite.
router.post("/respond", async (req: Request, res: Response) => {
	const parsedParams = getParsedSearchParams(
		InviteRespondRequestSchema.searchParams,
		req,
	);

	if (!parsedParams.inviteId.success) {
		const error = "Request did not include an invite id";
		console.log(`'GET' @ '/group/invite/respond': ${error}`);
		res.status(StatusCode.BAD_REQUEST).json({ error });
		return;
	}

	const parsedBody = v.safeParse(
		InviteRespondRequestSchema.requestBody,
		req.body,
	);

	if (!parsedBody.success) {
		const error = "Unable to parse the request body";
		console.log(`'POST' @ '/group/invite/respond': ${error}`);
		res.status(StatusCode.BAD_REQUEST).json({ error });
		return;
	}

	const invite = await InviteModel.findById(parsedParams.inviteId.output);

	if (!invite) {
		const error = "Invite does not exist";
		console.log(`'POST' @ '/group/invite/respond': ${error}`);
		res.status(StatusCode.NOT_FOUND).json({ error });
		return;
	}

	if (invite.inviteeId !== req.userId) {
		const error = "Invite is not for this user";
		console.log(`'POST' @ '/group/invite/respond': ${error}`);
		res.status(StatusCode.UNAUTHORIZED).json({ error });
		return;
	}

	// if accepted = join group + add userid: 0 to all group goal progress THEN delete invite
	if (parsedBody.output.accepted) {
		const group = await GroupModel.findById(invite.groupId);

		if (!group) {
			const error = "Group does not exist";
			console.log(`'POST' @ '/group/invite/respond': ${error}`);
			res.status(StatusCode.NOT_FOUND).json({ error });
			return;
		}

		const user = await UserModel.findById(req.userId);

		if (!user) {
			const error = "User does not exist";
			console.log(`'POST' @ '/group/invite/respond': ${error}`);
			res.status(StatusCode.NOT_FOUND).json({ error });
			return;
		}

		group.userIds.push(req.userId);
		await group.save();
		user.groupIds.push(invite.groupId);
		await user.save();

		for (const goalId of group.goalIds) {
			const goal = await GoalModel.findById(goalId);
			if (!goal || goal.type === GoalType.Individual) continue;

			goal.progress.set(req.userId, 0);
			goal.save();
		}
	}

	await InviteModel.findByIdAndDelete(parsedParams.inviteId.output);

	res.sendStatus(StatusCode.OK);
});
