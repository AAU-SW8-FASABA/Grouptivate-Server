import assert from "node:assert";
import { test, before, beforeEach, after } from "node:test";
import { start, end, clearDatabase } from "./setup";
import { createGoal, createGroup, createUser } from "./helpers";
import {
	GoalPatchRequestSchema,
	GoalType,
} from "../Grouptivate-API/schemas/Goal";
import { OtherActivity } from "../Grouptivate-API/schemas/Activity";
import { Metric } from "../Grouptivate-API/schemas/Metric";
import GoalModel from "../src/models/GoalModel";
import { StatusCode } from "../src/dbEnums";
import { fetchApi, RequestMethod } from "./fetch";
import { updateStreaks } from "../src/jobs/streakJob";
import { Interval } from "../Grouptivate-API/schemas/Interval";
import GroupModel from "../src/models/GroupModel";

before(async () => {
	await start();
});

beforeEach(async () => {
	await clearDatabase();
});

after(async () => {
	await end();
});

test("Job: Streak - Group reached the target", async (t) => {
	const user = await createUser(t, "testUser1", "testPassword1");
	if (!user) return;

	const group = await createGroup(t, user.token, "testGroup", Interval.Daily);
	if (!group) return;

	const goal = await createGoal({
		t,
		type: GoalType.Individual,
		groupId: group.groupId,
		userId: user.userId,
		token: user.token,
	});
	if (!goal) return;

	const [patchGoalResponse] = await fetchApi({
		path: "/group/goal",
		method: RequestMethod.PATCH,
		schema: GoalPatchRequestSchema,
		token: user.token,
		searchParams: {},
		requestBody: [{ goalId: goal.goalId, progress: 1000 }],
	});

	assert(patchGoalResponse.status === StatusCode.OK);

	await updateStreaks(Interval.Daily);

	const updatedGroup = await GroupModel.findById(group.groupId);
	assert(updatedGroup !== null, "Group should not be null");
	assert(updatedGroup.streak === 1, "Streak should have been incremented");

	const updatedGoal = await GoalModel.findById(goal.goalId);
	assert(updatedGoal !== null, "Goal should not be null");

	assert(
		updatedGoal.progress.get(user.userId) === 0,
		"User progress was not reset to 0",
	);
});

test("Job: Streak - Group did not reach the target", async (t) => {
	const user = await createUser(t, "testUser1", "testPassword1");
	if (!user) return;

	const group = await createGroup(t, user.token, "testGroup", Interval.Daily);
	if (!group) return;

	const goal = await createGoal({
		t,
		type: GoalType.Individual,
		groupId: group.groupId,
		userId: user.userId,
		token: user.token,
	});
	if (!goal) return;

	const [patchGoalResponse] = await fetchApi({
		path: "/group/goal",
		method: RequestMethod.PATCH,
		schema: GoalPatchRequestSchema,
		token: user.token,
		searchParams: {},
		requestBody: [{ goalId: goal.goalId, progress: 1 }],
	});

	assert(patchGoalResponse.status === StatusCode.OK);

	await updateStreaks(Interval.Daily);

	const updatedGroup = await GroupModel.findById(group.groupId);
	assert(updatedGroup !== null, "Group should not be null");
	assert(updatedGroup.streak === 0, "Streak did not reset");

	const updatedGoal = await GoalModel.findById(goal.goalId);
	assert(updatedGoal !== null, "Goal should not be null");

	assert(
		updatedGoal.progress.get(user.userId) === 0,
		"User progress was not reset to 0",
	);
});
