import assert from "node:assert";
import { test, before, beforeEach, after } from "node:test";
import { start, end, clearDatabase } from "./setup";
import { fetchApi, RequestMethod } from "./fetch";
import { Interval } from "../Grouptivate-API/schemas/Interval";
import {
	InviteGetRequestSchema,
	InviteDeleteRequestSchema,
	InviteRespondRequestSchema,
} from "../Grouptivate-API/schemas/Invite";
import InviteModel from "../src/models/InviteModel";
import GoalModel from "../src/models/GoalModel";
import GroupModel from "../src/models/GroupModel";
import {
	createGoal,
	createGroup,
	createUser,
	inviteAcceptFlow,
	inviteDeclineFlow,
	invite,
} from "./helpers";
import { StatusCode } from "../src/dbEnums";
import { GoalType } from "../Grouptivate-API/schemas/Goal";
import { SportActivity } from "../Grouptivate-API/schemas/Activity";
import { Metric } from "../Grouptivate-API/schemas/Metric";

before(async () => {
	await start();
});

beforeEach(async () => {
	await clearDatabase();
});

after(async () => {
	await end();
});

test("POST @ group/invite: can create an invitation", async (t) => {
	const userName1 = "testUser1";
	const user1 = await createUser(t, userName1);
	if (!user1) return;

	const userName2 = "testUser2";
	const user2 = await createUser(t, userName2);
	if (!user2) return;

	const group = await createGroup(t, user1.token);
	if (!group) return;

	const inviteSuccess = await invite(t, user2, user1, group.groupId);
	if (!inviteSuccess) return;

	const invites = await InviteModel.find();

	assert(invites.length === 1, "An invite was not created");
	assert(
		invites[0].groupId === group.groupId,
		"The invite has the wrong groupId",
	);
	assert(invites[0].inviteeId === user2.userId, "The wrong user was invited");
	assert(
		invites[0].inviterId === user1.userId,
		"The wrong user is the inviter",
	);
});

test("GET @ group/invite: can get group invitations", async (t) => {
	const userName1 = "testUser1";
	const user1 = await createUser(t, userName1);
	if (!user1) return;

	const userName2 = "testUser2";
	const user2 = await createUser(t, userName2);
	if (!user2) return;

	const group = await createGroup(t, user1.token);
	if (!group) return;

	const inviteSuccess = await invite(t, user2, user1, group.groupId);
	if (!inviteSuccess) return;

	const [getInvitesResponse, getInvitesBody] = await fetchApi({
		path: "/group/invite",
		method: RequestMethod.GET,
		schema: InviteGetRequestSchema,
		token: user2.token,
		searchParams: {},
		requestBody: undefined,
	});

	assert(getInvitesBody.success, "Parsing did not succeed");
	assert(
		getInvitesResponse.status === StatusCode.OK,
		"Incorrect status code",
	);

	assert(
		getInvitesBody.output.length === 1,
		"Not invited to exactly 1 group",
	);
	assert(
		getInvitesBody.output[0].groupName === group.name,
		"Invited group has incorrect group name",
	);
	assert(
		getInvitesBody.output[0].inviterName === userName1,
		"Invited by the wrong user",
	);
});

test("DELETE @ group/invite: can delete an invitation", async (t) => {
	const userName1 = "testUser1";
	const user1 = await createUser(t, userName1);
	if (!user1) return;

	const userName2 = "testUser2";
	const user2 = await createUser(t, userName2);
	if (!user2) return;

	const group = await createGroup(t, user1.token);
	if (!group) return;

	const inviteSuccess = await invite(t, user2, user1, group.groupId);
	if (!inviteSuccess) return;

	const invitesBeforeDelete = await InviteModel.find();

	const [deleteInvitesResponse] = await fetchApi({
		path: "/group/invite",
		method: RequestMethod.DELETE,
		schema: InviteDeleteRequestSchema,
		token: user1.token,
		searchParams: { inviteId: invitesBeforeDelete[0].id },
		requestBody: undefined,
	});

	assert(
		deleteInvitesResponse.status === StatusCode.NO_CONTENT,
		"Incorrect status code",
	);

	const invites = await InviteModel.find();

	assert(invites.length === 0, "The invite was not deleted");
});

test("DELETE @ group/invite: user outside of group cannot delete an invitation", async (t) => {
	const userName1 = "testUser1";
	const user1 = await createUser(t, userName1);
	if (!user1) return;

	const userName2 = "testUser2";
	const user2 = await createUser(t, userName2);
	if (!user2) return;

	const group = await createGroup(t, user1.token);
	if (!group) return;

	const inviteSuccess = await invite(t, user2, user1, group.groupId);
	if (!inviteSuccess) return;

	const invitesBeforeDelete = await InviteModel.find();

	const [deleteInvitesResponse] = await fetchApi({
		path: "/group/invite",
		method: RequestMethod.DELETE,
		schema: InviteDeleteRequestSchema,
		token: user2.token,
		searchParams: { inviteId: invitesBeforeDelete[0].id },
		requestBody: undefined,
	});

	assert(
		deleteInvitesResponse.status === StatusCode.FORBIDDEN,
		"Incorrect status code",
	);

	const invites = await InviteModel.find();

	assert(invites.length === 1, "The invite was deleted");
});

test("POST @ group/invite/respond: can accept an invitation and be in existing group goals", async (t) => {
	const userName1 = "testUser1";
	const user1 = await createUser(t, userName1);
	if (!user1) return;

	const userName2 = "testUser2";
	const user2 = await createUser(t, userName2);
	if (!user2) return;

	const group = await createGroup(t, user1.token);
	if (!group) return;

	const goal = await createGoal({
		t,
		groupId: group.groupId,
		userId: user1.userId,
		type: GoalType.Group,
		title: "testGoalTitle",
		activity: SportActivity.Frisbee,
		metric: Metric.Count,
		target: 5,
		token: user1.token,
	});
	if (!goal) return;

	const inviteSuccess = await inviteAcceptFlow(
		t,
		user2,
		user1,
		group.groupId,
	);
	if (!inviteSuccess) return;

	const goals = await GoalModel.find();

	assert(goals.length === 1, "There is not exactly 1 goal");
	assert(
		goals[0].progress.get(user1.userId) === 0,
		"User 1 does not have 0 progress in the group goal",
	);
	assert(
		goals[0].progress.get(user2.userId) === 0,
		"User 2 does not have 0 progress in the group goal",
	);
});

test("POST @ group/invite/respond: can decline an invitation and not be in the group", async (t) => {
	const userName1 = "testUser1";
	const user1 = await createUser(t, userName1);
	if (!user1) return;

	const userName2 = "testUser2";
	const user2 = await createUser(t, userName2);
	if (!user2) return;

	const group = await createGroup(t, user1.token);
	if (!group) return;

	const goal = await createGoal({
		t,
		groupId: group.groupId,
		userId: user1.userId,
		type: GoalType.Group,
		title: "testGoalTitle",
		activity: SportActivity.Frisbee,
		metric: Metric.Count,
		target: 5,
		token: user1.token,
	});
	if (!goal) return;

	const inviteSuccess = await inviteDeclineFlow(
		t,
		{ userName: userName2, userId: user2.userId, token: user2.token },
		{ userName: userName1, userId: user1.userId, token: user1.token },
		group.groupId,
	);
	if (!inviteSuccess) return;

	const groupObject = await GroupModel.find();

	assert(
		groupObject[0].userIds.includes(user1.userId),
		"User 1 is no longer in the group",
	);
	assert(
		!groupObject[0].userIds.includes(user2.userId),
		"User 2 joined the group despite declining the invitation",
	);
});

test("POST @ group/invite/respond: another user cannot accept the invitation", async (t) => {
	const userName1 = "testUser1";
	const user1 = await createUser(t, userName1);
	if (!user1) return;

	const userName2 = "testUser2";
	const user2 = await createUser(t, userName2);
	if (!user2) return;

	const group = await createGroup(t, user1.token);
	if (!group) return;

	const inviteSuccess = await invite(t, user2, user1, group.groupId);
	if (!inviteSuccess) return;

	const invites = await InviteModel.find();

	const [acceptInviteResponse] = await fetchApi({
		path: "/group/invite/respond",
		method: RequestMethod.POST,
		schema: InviteRespondRequestSchema,
		token: user1.token,
		searchParams: { inviteId: invites[0].id },
		requestBody: { accepted: true },
	});

	assert(
		acceptInviteResponse.status === StatusCode.FORBIDDEN,
		"Incorrect status code",
	);

	const groupObject = await GroupModel.find();

	assert(
		groupObject[0].userIds.length === 1,
		"Someone else tried to accept the invite, but there is not exactly 1 user in the group",
	);
	assert(
		!groupObject[0].userIds.includes(user2.userId),
		"Someone else tried to accept the invite, but the invited user was still added to the group",
	);
});
