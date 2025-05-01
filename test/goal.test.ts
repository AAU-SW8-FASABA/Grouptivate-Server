import assert from "node:assert";
import { test, before, beforeEach, after, TestContext } from "node:test";
import { start, end, clearDatabase } from "./setup";
import { fetchApi, RequestMethod } from "./fetch";

import {
	GroupCreateRequestSchema,
	GroupGetRequestSchema,
	GroupRemoveRequestSchema,
} from "../Grouptivate-API/schemas/Group";
import { GoalDeleteRequestSchema } from "../Grouptivate-API/schemas/Goal";
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

test("POST @ group/goal: can create individual goal", async (t) => {
	const user = await createUser(t, "testUser1", "testPassword1");
	if (!user) return;

	const group = await createGroup(
		t,
		"TestGroup1",
		Interval.Daily,
		user.token,
	);
	if (!group) return;

	const type = GoalType.Individual;
	const title = "TestGoal";
	const activity = OtherActivity.ActiveCaloriesBurned;
	const metric = Metric.Count;
	const target = 1000;

	const goalBody = await createGoal({
		t,
		groupId: group.groupId,
		userId: user.userId,
		type,
		title,
		activity,
		metric,
		target,
		token: user.token,
		failOnError: true,
	});
	if (!goalBody) return;

	/**
	 * These asserts check whether the correct fields were set in the database
	 */
	const goal = await GoalModel.findById(goalBody.goalId);
	assert(goal !== null, "Goal was not inserted into the database");
	assert(goal.type === type, "Type should be correctly set in the database");
	assert(
		goal.title === title,
		"Title should be correctly set in the database",
	);
	assert(
		goal.activity === activity,
		"Activity should be correctly set in the database",
	);
	assert(
		goal.metric === metric,
		"Metric should be correctly set in the database",
	);
	assert(
		goal.target === target,
		"Target should be correctly set in the database",
	);

	assert(
		goal.progress.get(user.userId) !== undefined,
		"The progress map should be created with the individual user's userid",
	);

	const groupObject = await GroupModel.findById(group.groupId);
	assert(groupObject !== null, "Group should exist");
	assert(
		groupObject.goalIds.includes(goalBody.goalId),
		"Group should contain the id of the created goal",
	);
});

test("POST @ group/goal: can create group goal", async (t) => {
	const user1 = await createUser(t, "testUser1");
	if (!user1) return;

	const user2 = await createUser(t, "testUser2");
	if (!user2) return;

	const group = await createGroup(
		t,
		"TestGroup1",
		Interval.Daily,
		user1.token,
	);
	if (!group) return;

	const inviteId = await inviteAcceptFlow(
		t,
		{ ...user2 },
		{ ...user1 },
		group.groupId,
	);

	const type = GoalType.Group;
	const title = "TestGoal";
	const activity = OtherActivity.ActiveCaloriesBurned;
	const metric = Metric.Count;
	const target = 1000;

	const goalBody = await createGoal({
		t,
		groupId: group.groupId,
		userId: user1.userId,
		type,
		title,
		activity,
		metric,
		target,
		token: user1.token,
		failOnError: true,
	});
	if (!goalBody) return;

	/**
	 * These asserts check whether the correct fields were set in the database
	 */
	const goal = await GoalModel.findById(goalBody.goalId);
	assert(goal !== null, "Goal was not inserted into the database");
	assert(goal.type === type, "Type should be correctly set in the database");
	assert(
		goal.title === title,
		"Title should be correctly set in the database",
	);
	assert(
		goal.activity === activity,
		"Activity should be correctly set in the database",
	);
	assert(
		goal.metric === metric,
		"Metric should be correctly set in the database",
	);
	assert(
		goal.target === target,
		"Target should be correctly set in the database",
	);

	assert(
		goal.progress.get(user1.userId) !== undefined &&
			goal.progress.get(user1.userId) !== undefined,
		"The progress map should be created with all user's userid",
	);

	const groupObject = await GroupModel.findById(group.groupId);
	assert(groupObject !== null, "Group should exist");
	assert(
		groupObject.goalIds.includes(goalBody.goalId),
		"Group should contain the id of the created goal",
	);
});

test("DELETE @ group/goal: can delete own individual goal", async (t) => {
	const user = await createUser(t);
	if (!user) return;

	const group = await createGroup(t, "testGroup", Interval.Daily, user.token);
	if (!group) return;

	const goal = await createGoal({
		t,
		groupId: group.groupId,
		userId: user.userId,
		type: GoalType.Individual,
		title: "Badminton Calories",
		activity: SportActivity.Badminton,
		metric: Metric.Calories,
		target: 1000,
		token: user.token,
	});
	if (!goal) return;

	const [deleteGoalResponse] = await fetchApi({
		path: "/group/goal",
		method: RequestMethod.DELETE,
		schema: GoalDeleteRequestSchema,
		token: user.token,
		searchParams: {},
		requestBody: {
			goalId: goal?.goalId,
		},
	});

	assert(
		deleteGoalResponse.status === StatusCode.NO_CONTENT,
		"Incorrect status code",
	);

	const goalsAfterDelete = await GoalModel.find();

	assert(
		goalsAfterDelete.length === 0,
		"The only goal was deleted but still exists in database",
	);
});

test("DELETE @ group/goal: can delete someone elses individual goal", async (t) => {
	const user1 = await createUser(t, "testName1");
	if (!user1) return;

	const user2 = await createUser(t, "testName2");
	if (!user2) return;

	const group = await createGroup(
		t,
		"testGroup",
		Interval.Daily,
		user1.token,
	);
	if (!group) return;

	const goal = await createGoal({
		t,
		groupId: group.groupId,
		userId: user1.userId,
		type: GoalType.Individual,
		title: "Badminton Calories",
		activity: SportActivity.Badminton,
		metric: Metric.Calories,
		target: 1000,
		token: user1.token,
	});
	if (!goal) return;

	await inviteAcceptFlow(
		t,
		{ userName: user2.userName, userId: user2.userId, token: user2.token },
		{ userName: user1.userName, userId: user1.userId, token: user1.token },
		group.groupId,
	);

	const [deleteGoalResponse] = await fetchApi({
		path: "/group/goal",
		method: RequestMethod.DELETE,
		schema: GoalDeleteRequestSchema,
		token: user2.token,
		searchParams: {},
		requestBody: {
			goalId: goal?.goalId,
		},
	});

	assert(
		deleteGoalResponse.status === StatusCode.NO_CONTENT,
		"Incorrect status code",
	);

	const goalsAfterDelete = await GoalModel.find();

	assert(
		goalsAfterDelete.length === 0,
		"The only goal was deleted but still exists in database",
	);
});

test("DELETE @ group/goal: can not delete a goal if not in the group", async (t) => {
	const user1 = await createUser(t, "testName1");
	if (!user1) return;

	const user2 = await createUser(t, "testName2");
	if (!user2) return;

	const group = await createGroup(
		t,
		"testGroup",
		Interval.Daily,
		user1.token,
	);
	if (!group) return;

	const goal = await createGoal({
		t,
		groupId: group.groupId,
		userId: user1.userId,
		type: GoalType.Individual,
		title: "Badminton Calories",
		activity: SportActivity.Badminton,
		metric: Metric.Calories,
		target: 1000,
		token: user1.token,
	});
	if (!goal) return;

	const [deleteGoalResponse] = await fetchApi({
		path: "/group/goal",
		method: RequestMethod.DELETE,
		schema: GoalDeleteRequestSchema,
		token: user2.token,
		searchParams: {},
		requestBody: {
			goalId: goal?.goalId,
		},
	});

	assert(
		deleteGoalResponse.status === StatusCode.FORBIDDEN,
		"Incorrect status code",
	);

	const goalsAfterDelete = await GoalModel.find();

	assert(
		goalsAfterDelete.length === 1,
		"Someone outside the group tried to delete the goal, but it was still removed from database",
	);
});

test("DELETE @ group/goal: can delete a group goal", async (t) => {
	const user = await createUser(t);
	if (!user) return;

	const group = await createGroup(t, "testGroup", Interval.Daily, user.token);
	if (!group) return;

	const goal = await createGoal({
		t,
		groupId: group.groupId,
		userId: user.userId,
		type: GoalType.Group,
		title: "Badminton Calories",
		activity: SportActivity.Badminton,
		metric: Metric.Calories,
		target: 1000,
		token: user.token,
	});
	if (!goal) return;

	const [deleteGoalResponse] = await fetchApi({
		path: "/group/goal",
		method: RequestMethod.DELETE,
		schema: GoalDeleteRequestSchema,
		token: user.token,
		searchParams: {},
		requestBody: {
			goalId: goal?.goalId,
		},
	});

	assert(
		deleteGoalResponse.status === StatusCode.NO_CONTENT,
		"Incorrect status code",
	);

	const goalsAfterDelete = await GoalModel.find();

	assert(
		goalsAfterDelete.length === 0,
		"The only goal was deleted but still exists in database",
	);
});
