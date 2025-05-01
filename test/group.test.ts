import assert from "node:assert";
import { test, before, beforeEach, after, TestContext } from "node:test";
import { start, end, clearDatabase } from "./setup";
import { fetchApi, RequestMethod } from "./fetch";

import { UserCreateRequestSchema } from "../Grouptivate-API/schemas/User";
import {
	GroupCreateRequestSchema,
	GroupGetRequestSchema,
	GroupRemoveRequestSchema,
} from "../Grouptivate-API/schemas/Group";
import {
	GoalCreateRequestSchema,
	GoalType,
} from "../Grouptivate-API/schemas/Goal";
import { Interval } from "../Grouptivate-API/schemas/Interval";
import GroupModel from "../src/models/GroupModel";
import UserModel from "../src/models/UserModel";
import { StatusCode } from "../src/dbEnums";
import { Metric } from "../Grouptivate-API/schemas/Metric";
import {
	OtherActivity,
	SportActivity,
} from "../Grouptivate-API/schemas/Activity";
import GoalModel from "../src/models/GoalModel";

before(async () => {
	await start();
});

beforeEach(async () => {
	await clearDatabase();
});

after(async () => {
	await end();
});

async function createUser(
	t: TestContext,
	userName: string = "testName",
	password: string = "testPassword1",
) {
	const [createUserResponse, createUserBody] = await fetchApi({
		path: "/user",
		method: RequestMethod.POST,
		schema: UserCreateRequestSchema,
		token: null,
		searchParams: {},
		requestBody: {
			name: userName,
			password: password,
		},
	});

	if (
		!createUserBody.success ||
		createUserResponse.status !== StatusCode.CREATED
	) {
		t.skip(`Skipped '${t.name}' due to failed user creation.`);
		return undefined;
	}

	return createUserBody.output;
}

async function createGroup(
	t: TestContext,
	name: string,
	interval: Interval,
	token: string,
) {
	const [createGroupResponse, createGroupBody] = await fetchApi({
		path: "/group",
		method: RequestMethod.POST,
		schema: GroupCreateRequestSchema,
		token: token,
		searchParams: {},
		requestBody: {
			groupName: name,
			interval: interval,
		},
	});

	if (
		!createGroupBody.success ||
		createGroupResponse.status !== StatusCode.CREATED
	) {
		t.skip(`Skipped '${t.name}' due to failed group creation.`);
		return;
	}

	return createGroupBody.output;
}

async function createGoal(
	t: TestContext,
	groupId: string,
	userId: string,
	type: GoalType,
	title: string,
	activity: SportActivity | OtherActivity,
	metric: Metric,
	target: number,
	token: string,
) {
	const [createGoalResponse, createGoalBody] = await fetchApi({
		path: "/group/goal",
		method: RequestMethod.POST,
		schema: GoalCreateRequestSchema,
		token: token,
		searchParams: {
			groupId,
			userId,
		},
		requestBody: {
			type,
			title,
			activity,
			metric,
			target,
		},
	});

	if (
		!createGoalBody.success ||
		createGoalResponse.status !== StatusCode.CREATED
	) {
		t.skip(`Skipped '${t.name}' due to failed goal creation.`);
		return;
	}

	return createGoalBody.output;
}

// async function inviteAcceptFlow(inviteeId: string, inviterId: string);

test("POST @ group: can create group", async (t) => {
	const user = await createUser(t);
	if (!user) return;

	const groupName = "testGroup";
	const groupInterval = Interval.Daily;
	const group = await createGroup(t, groupName, groupInterval, user.token);
	if (!group) return;

	const groups = await GroupModel.find();

	assert(groups.length === 1, "There is not exactly 1 group created");
	assert(
		groups[0].name === groupName,
		"The group does not have the supplied name",
	);
	assert(
		groups[0].interval === groupInterval,
		"The group does not have the supplied interval",
	);
	assert(
		groups[0].userIds.length === 1,
		"The group does not contain exactly 1 member",
	);
	assert(
		groups[0].userIds[0] === user.userId,
		"The groups only member is not the creator",
	);
	assert(
		groups[0].goalIds.length === 0,
		"The group does not contain exactly 0 goals",
	);
	assert(
		groups[0].streak === 0,
		"The group does not start with a streak of 0",
	);

	const updatedUsers = await UserModel.find();

	assert(updatedUsers.length === 1, "There is not exactly 1 user");
	assert(
		updatedUsers[0].groupIds.length === 1,
		"The user is not in exactly 1 group",
	);
	assert(
		updatedUsers[0].groupIds[0] === groups[0].id,
		"The user's only group is not the created group",
	);
});

test("POST @ group: cannot create group without name", async (t) => {
	const user = await createUser(t);
	if (!user) return;

	const [response, parsed] = await fetchApi({
		path: "/group",
		method: RequestMethod.POST,
		schema: GroupCreateRequestSchema,
		token: user.token,
		searchParams: {},
		requestBody: {
			groupName: null as any,
			interval: Interval.Daily,
		},
	});

	assert(!parsed.success, "Parsing was not meant to succeed");
	assert(response.status === StatusCode.BAD_REQUEST, "Incorrect status code");

	const groups = await GroupModel.find();

	assert(
		groups.length === 0,
		"The group was created even when supplied an invalid name",
	);
});

test("POST @ group: cannot create group without interval", async (t) => {
	const user = await createUser(t);
	if (!user) return;

	const [response, parsed] = await fetchApi({
		path: "/group",
		method: RequestMethod.POST,
		schema: GroupCreateRequestSchema,
		token: user.token,
		searchParams: {},
		requestBody: {
			groupName: "Test Group",
			interval: null as any,
		},
	});

	assert(!parsed.success, "Parsing was not meant to succeed");
	assert(response.status === StatusCode.BAD_REQUEST, "Incorrect status code");

	const groups = await GroupModel.find();

	assert(
		groups.length === 0,
		"The group was created even when supplied an invalid interval",
	);
});

test("GET @ group: can get valid group with group goal", async (t) => {
	const userName = "testName";
	const user = await createUser(t, userName);
	if (!user) return;

	const groupName = "testGroup";
	const groupInterval = Interval.Daily;
	const group = await createGroup(t, groupName, groupInterval, user.token);
	if (!group) return;

	const type = GoalType.Group;
	const title = "testGoalTitle";
	const activity = SportActivity.Frisbee;
	const metric = Metric.Count;
	const target = 5;
	createGoal(
		t,
		group.groupId,
		user.userId,
		type,
		title,
		activity,
		metric,
		target,
		user.token,
	);

	const [getGroupResponse, getGroupBody] = await fetchApi({
		path: "/group",
		method: RequestMethod.GET,
		schema: GroupGetRequestSchema,
		token: user.token,
		searchParams: {
			groupId: group.groupId,
		},
		requestBody: undefined,
	});

	assert(getGroupBody.success, "Parsing did not succeed");
	assert(getGroupResponse.status === StatusCode.OK, "Incorrect status code");
	assert(
		getGroupBody.output.groupName === groupName,
		"Unexpected group name after creating and getting",
	);

	const userMap = new Map(Object.entries(getGroupBody.output.users));

	assert(
		getGroupBody.output.interval === groupInterval,
		"The group does not have the supplied interval",
	);
	assert(userMap.size === 1, "The group does not contain exactly 1 member");
	assert(
		userMap.get(user.userId) === userName,
		"The groups only member is not the creator",
	);
	assert(
		getGroupBody.output.streak === 0,
		"The group does not have a streak of 0",
	);
	assert(
		getGroupBody.output.goals.length === 1,
		"The group does not contain exactly 1 goals",
	);
	assert(
		getGroupBody.output.goals[0].type === type,
		"Goal type does not match",
	);
	assert(
		getGroupBody.output.goals[0].title === title,
		"Goal title does not match",
	);
	assert(
		getGroupBody.output.goals[0].activity === activity,
		"Goal activity does not match",
	);
	assert(
		getGroupBody.output.goals[0].metric === metric,
		"Goal metric does not match",
	);
	assert(
		getGroupBody.output.goals[0].target === target,
		"Goal target does not match",
	);

	const progressMap = new Map(
		Object.entries(getGroupBody.output.goals[0].progress),
	);

	assert(
		progressMap.size === 1,
		"There is not exactly 1 progress entry in group goal",
	);
	assert(
		progressMap.get(user.userId) === 0,
		"The user's progress in new group goal is not 0",
	);
});

test("GET @ group: can get valid group with individual goal", async (t) => {
	const userName = "testName";
	const user = await createUser(t, userName);
	if (!user) return;

	const groupName = "testGroup";
	const groupInterval = Interval.Daily;
	const group = await createGroup(t, groupName, groupInterval, user.token);
	if (!group) return;

	const type = GoalType.Individual;
	const title = "testGoalTitle";
	const activity = SportActivity.Frisbee;
	const metric = Metric.Count;
	const target = 5;
	createGoal(
		t,
		group.groupId,
		user.userId,
		type,
		title,
		activity,
		metric,
		target,
		user.token,
	);

	const [getGroupResponse, getGroupBody] = await fetchApi({
		path: "/group",
		method: RequestMethod.GET,
		schema: GroupGetRequestSchema,
		token: user.token,
		searchParams: {
			groupId: group.groupId,
		},
		requestBody: undefined,
	});

	assert(getGroupBody.success, "Parsing did not succeed");
	assert(getGroupResponse.status === StatusCode.OK, "Incorrect status code");
	assert(
		getGroupBody.output.groupName === groupName,
		"Unexpected group name after creating and getting",
	);

	const userMap = new Map(Object.entries(getGroupBody.output.users));

	assert(
		getGroupBody.output.interval === groupInterval,
		"The group does not have the supplied interval",
	);
	assert(userMap.size === 1, "The group does not contain exactly 1 member");
	assert(
		userMap.get(user.userId) === userName,
		"The groups only member is not the creator",
	);
	assert(
		getGroupBody.output.streak === 0,
		"The group does not have a streak of 0",
	);
	assert(
		getGroupBody.output.goals.length === 1,
		"The group does not contain exactly 1 goals",
	);
	assert(
		getGroupBody.output.goals[0].type === type,
		"Goal type does not match",
	);
	assert(
		getGroupBody.output.goals[0].title === title,
		"Goal title does not match",
	);
	assert(
		getGroupBody.output.goals[0].activity === activity,
		"Goal activity does not match",
	);
	assert(
		getGroupBody.output.goals[0].metric === metric,
		"Goal metric does not match",
	);
	assert(
		getGroupBody.output.goals[0].target === target,
		"Goal target does not match",
	);
	assert(
		Object.keys(getGroupBody.output.goals[0].progress).length === 1,
		"There is not exactly 1 progress entry in group goal",
	);
	assert(
		getGroupBody.output.goals[0].progress[user.userId] === 0,
		"The user's progress in new individual goal is not 0",
	);
});

test("GET @ group: can not get invalid group", async (t) => {
	const user = await createUser(t);
	if (!user) return;

	const group = await createGroup(t, "testGroup", Interval.Daily, user.token);
	if (!group) return;

	const [getGroupResponse, getGroupBody] = await fetchApi({
		path: "/group",
		method: RequestMethod.GET,
		schema: GroupGetRequestSchema,
		token: user.token,
		searchParams: {
			groupId: "123456789012345678901234",
		},
		requestBody: undefined,
	});

	assert(!getGroupBody.success, "Parsing was not meant to succeed");
	assert(
		getGroupResponse.status === StatusCode.BAD_REQUEST,
		"Incorrect status code",
	);
});

/**
 * These tests, check whether removing users correctly adjusts the user, goal and group collections
 */
test("POST @ group/remove: remove user from group with one user", async (t) => {
	const user = await createUser(t);
	if (!user) return;

	const groupName = "testGroup";
	const group = await createGroup(t, groupName, Interval.Daily, user.token);
	if (!group) return;

	const [removeUserResponse, _] = await fetchApi({
		path: "/group/remove",
		method: RequestMethod.POST,
		schema: GroupRemoveRequestSchema,
		token: user.token,
		searchParams: {},
		requestBody: {
			userId: user.userId,
			groupId: group.groupId,
		},
	});

	assert(
		removeUserResponse.status === StatusCode.OK,
		"Incorrect status code",
	);

	const groupObject = await GroupModel.findById(group.groupId);
	assert(
		groupObject === null,
		"The group should have been deleted in the database",
	);

	const userObject = await UserModel.findById(user.userId);
	assert(userObject !== null, "The user should exist");
	assert(
		userObject.groupIds.length === 0,
		"The groupId should have been removed from the user",
	);
});

test("POST @ group/remove: remove user from group with one user. Correctly deletes individual goal", async (t) => {
	const user = await createUser(t);
	if (!user) return;

	const groupName = "testGroup";
	const group = await createGroup(t, groupName, Interval.Daily, user.token);
	if (!group) return;

	const goal = await createGoal(
		t,
		group.groupId,
		user.userId,
		GoalType.Individual,
		"testGoalTitle",
		SportActivity.Running,
		Metric.Distance,
		3000,
		user.token,
	);
	if (!goal) return;

	const [removeUserResponse, _] = await fetchApi({
		path: "/group/remove",
		method: RequestMethod.POST,
		schema: GroupRemoveRequestSchema,
		token: user.token,
		searchParams: {},
		requestBody: {
			userId: user.userId,
			groupId: group.groupId,
		},
	});

	assert(
		removeUserResponse.status === StatusCode.OK,
		"Incorrect status code",
	);

	const groupObject = await GroupModel.findById(group.groupId);
	assert(
		groupObject === null,
		"The group should have been deleted in the database",
	);

	const userObject = await UserModel.findById(user.userId);
	assert(userObject !== null, "The user should exist");
	assert(
		userObject.groupIds.length === 0,
		"The groupId should have been removed from the user",
	);

	const goalsNumber = await GoalModel.countDocuments();
	assert(goalsNumber === 0, "The goal should have been deleted");
});

test("POST @ group/remove: remove user from group with one user. Correctly deletes group goal", async (t) => {
	const user = await createUser(t);
	if (!user) return;

	const groupName = "testGroup";
	const group = await createGroup(t, groupName, Interval.Daily, user.token);
	if (!group) return;

	const goal = await createGoal(
		t,
		group.groupId,
		user.userId,
		GoalType.Group,
		"testGoalTitle",
		SportActivity.Running,
		Metric.Distance,
		3000,
		user.token,
	);
	if (!goal) return;

	const [removeUserResponse, _] = await fetchApi({
		path: "/group/remove",
		method: RequestMethod.POST,
		schema: GroupRemoveRequestSchema,
		token: user.token,
		searchParams: {},
		requestBody: {
			userId: user.userId,
			groupId: group.groupId,
		},
	});

	assert(
		removeUserResponse.status === StatusCode.OK,
		"Incorrect status code",
	);

	const groupObject = await GroupModel.findById(group.groupId);
	assert(
		groupObject === null,
		"The group should have been deleted in the database",
	);

	const userObject = await UserModel.findById(user.userId);
	assert(userObject !== null, "The user should exist");
	assert(
		userObject.groupIds.length === 0,
		"The groupId should have been removed from the user",
	);

	const goalsNumber = await GoalModel.countDocuments();
	assert(goalsNumber === 0, "The goal should have been deleted");
});

test("POST @ group/remove: remove user from group with multiple users", async (t) => {
	const userName1 = "testUser1";
	const user1 = await createUser(t, userName1);
	if (!user1) return;

	const userName2 = "testUser2";
	const user2 = await createUser(t, userName2);
	if (!user2) return;

	const group = await createGroup(
		t,
		"testGroup",
		Interval.Daily,
		user1.token,
	);
	if (!group) return;

	// Invite user and accept, or just add them to group??

	const [removeUserResponse, _] = await fetchApi({
		path: "/group/remove",
		method: RequestMethod.POST,
		schema: GroupRemoveRequestSchema,
		token: user1.token,
		searchParams: {},
		requestBody: {
			userId: user2.userId,
			groupId: group.groupId,
		},
	});
});

test("POST @ group/remove: remove user from group with multiple users. Correctly deletes individual goal", async (t) => {});

test("POST @ group/remove: remove user from group with multiple users. Correctly deletes group goal", async (t) => {});
