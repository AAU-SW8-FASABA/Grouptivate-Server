import assert from "node:assert";
import { test, before, beforeEach, after, TestContext } from "node:test";
import { start, end, clearDatabase } from "./setup";
import { fetchApi, RequestMethod } from "./fetch";

import {
	GroupCreateRequestSchema,
	GroupGetRequestSchema,
	GroupRemoveRequestSchema,
} from "../Grouptivate-API/schemas/Group";
import { GoalType } from "../Grouptivate-API/schemas/Goal";
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
import {
	createGoal,
	createGroup,
	createUser,
	inviteAcceptFlow,
} from "./helpers";

before(async () => {
	await start();
});

beforeEach(async () => {
	await clearDatabase();
});

after(async () => {
	await end();
});

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
	await createGoal({
		t,
		groupId: group.groupId,
		userId: user.userId,
		type,
		title,
		activity,
		metric,
		target,
		token: user.token,
	});

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
	await createGoal({
		t,
		groupId: group.groupId,
		userId: user.userId,
		type,
		title,
		activity,
		metric,
		target,
		token: user.token,
	});

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
		getGroupResponse.status === StatusCode.NOT_FOUND,
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

	const goal = await createGoal({
		t,
		groupId: group.groupId,
		userId: user.userId,
		type: GoalType.Individual,
		title: "testGoalTitle",
		activity: SportActivity.Running,
		metric: Metric.Distance,
		target: 3000,
		token: user.token,
	});
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

	const goal = await createGoal({
		t,
		groupId: group.groupId,
		userId: user.userId,
		type: GoalType.Group,
		title: "testGoalTitle",
		activity: SportActivity.Running,
		metric: Metric.Distance,
		target: 3000,
		token: user.token,
	});
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

	await inviteAcceptFlow(
		t,
		{ userName: userName2, userId: user2.userId, token: user2.token },
		{ userName: userName1, userId: user1.userId, token: user1.token },
		group.groupId,
	);

	const [removeUserResponse, _] = await fetchApi({
		path: "/group/remove",
		method: RequestMethod.POST,
		schema: GroupRemoveRequestSchema,
		token: user2.token,
		searchParams: {},
		requestBody: {
			userId: user1.userId,
			groupId: group.groupId,
		},
	});

	assert(
		removeUserResponse.status === StatusCode.OK,
		"Incorrect status code",
	);

	const groupObject = await GroupModel.findById(group.groupId);

	assert(
		groupObject !== null,
		"The group should not have been deleted in the database",
	);
	assert(
		!groupObject.userIds.includes(user1.userId),
		"User 1 was removed but the group still has their userId in userIds",
	);
	assert(
		groupObject.userIds.includes(user2.userId),
		"User 2 was not removed but the group does not have their userId in userIds",
	);

	const userObject1 = await UserModel.findById(user1.userId);
	const userObject2 = await UserModel.findById(user2.userId);

	assert(
		!userObject1?.groupIds.includes(group.groupId),
		"User 1 was removed but still has the groupId in groupIds",
	);
	assert(
		userObject2?.groupIds.includes(group.groupId),
		"User 2 was not removed but does not have the groupId in groupIds",
	);
});

test("POST @ group/remove: remove user from group with multiple users. Correctly deletes individual goal", async (t) => {
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

	await inviteAcceptFlow(
		t,
		{ userName: userName2, userId: user2.userId, token: user2.token },
		{ userName: userName1, userId: user1.userId, token: user1.token },
		group.groupId,
	);

	const goal = await createGoal({
		t,
		groupId: group.groupId,
		userId: user1.userId,
		type: GoalType.Individual,
		title: "GoalTitle",
		activity: OtherActivity.ActiveCaloriesBurned,
		metric: Metric.Count,
		target: 1000,
		token: user1.token,
	});
	if (!goal) return;

	const [removeUserResponse, _] = await fetchApi({
		path: "/group/remove",
		method: RequestMethod.POST,
		schema: GroupRemoveRequestSchema,
		token: user2.token,
		searchParams: {},
		requestBody: {
			userId: user1.userId,
			groupId: group.groupId,
		},
	});

	assert(
		removeUserResponse.status === StatusCode.OK,
		"Incorrect status code",
	);

	const groupObject = await GroupModel.findById(group.groupId);

	assert(
		groupObject !== null,
		"The group should not have been deleted in the database",
	);
	assert(
		!groupObject.userIds.includes(user1.userId),
		"User 1 was removed but the group still has their userId in userIds",
	);
	assert(
		groupObject.userIds.includes(user2.userId),
		"User 2 was not removed but the group does not have their userId in userIds",
	);
	assert(
		groupObject.goalIds.length === 0,
		"User 1 was removed but their goal remains in the group",
	);

	const userObject1 = await UserModel.findById(user1.userId);
	const userObject2 = await UserModel.findById(user2.userId);

	assert(
		!userObject1?.groupIds.includes(group.groupId),
		"User 1 was removed but still has the groupId in groupIds",
	);
	assert(
		userObject2?.groupIds.includes(group.groupId),
		"User 2 was not removed but does not have the groupId in groupIds",
	);

	const goalLength = await GoalModel.countDocuments();
	assert(
		goalLength === 0,
		"The user was removed from the group but their goal, still exists",
	);
});

test("POST @ group/remove: remove user from group with multiple users. Correctly deletes group goal", async (t) => {
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

	await inviteAcceptFlow(
		t,
		{ userName: userName2, userId: user2.userId, token: user2.token },
		{ userName: userName1, userId: user1.userId, token: user1.token },
		group.groupId,
	);

	const goal = await createGoal({
		t,
		groupId: group.groupId,
		userId: user1.userId,
		type: GoalType.Group,
		title: "GoalTitle",
		activity: OtherActivity.ActiveCaloriesBurned,
		metric: Metric.Count,
		target: 1000,
		token: user1.token,
	});
	if (!goal) return;

	const [removeUserResponse, _] = await fetchApi({
		path: "/group/remove",
		method: RequestMethod.POST,
		schema: GroupRemoveRequestSchema,
		token: user2.token,
		searchParams: {},
		requestBody: {
			userId: user1.userId,
			groupId: group.groupId,
		},
	});

	assert(
		removeUserResponse.status === StatusCode.OK,
		"Incorrect status code",
	);

	const groupObject = await GroupModel.findById(group.groupId);

	assert(
		groupObject !== null,
		"The group should not have been deleted in the database",
	);
	assert(
		!groupObject.userIds.includes(user1.userId),
		"User 1 was removed but the group still has their userId in userIds",
	);
	assert(
		groupObject.userIds.includes(user2.userId),
		"User 2 was not removed but the group does not have their userId in userIds",
	);
	assert(
		groupObject.goalIds.length === 1,
		"Removing a user should not delete group goals",
	);

	const userObject1 = await UserModel.findById(user1.userId);
	const userObject2 = await UserModel.findById(user2.userId);

	assert(
		!userObject1?.groupIds.includes(group.groupId),
		"User 1 was removed but still has the groupId in groupIds",
	);
	assert(
		userObject2?.groupIds.includes(group.groupId),
		"User 2 was not removed but does not have the groupId in groupIds",
	);

	const goals = await GoalModel.find();

	assert(
		goals.length === 1,
		"Removing a user should not delete Group goals from the database when users remain in the group",
	);

	assert(
		goals[0].progress.size === 1,
		"The progress of the group goal should only contain a single user",
	);
});
