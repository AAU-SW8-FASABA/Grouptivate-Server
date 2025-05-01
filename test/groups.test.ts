import assert from "node:assert";
import { test, before, beforeEach, after, TestContext } from "node:test";
import { start, end, clearDatabase } from "./setup";
import { fetchApi, RequestMethod } from "./fetch";

import { GroupsGetRequestSchema } from "../Grouptivate-API/schemas/Group";
import { Interval } from "../Grouptivate-API/schemas/Interval";
import { StatusCode } from "../src/dbEnums";
import { createGroup, createUser } from "./helpers";

before(async () => {
	await start();
});

beforeEach(async () => {
	await clearDatabase();
});

after(async () => {
	await end();
});

test("GET @ groups: can get groups", async (t) => {
	const user1 = await createUser(t, "user1");
	if (!user1) return;

	const user2 = await createUser(t, "user2");
	if (!user2) return;

	const g1Name = "group1";
	const group1 = await createGroup(t, user1.token, g1Name);
	if (!group1) return;

	const g2Name = "group2";
	const group2 = await createGroup(t, user1.token, g2Name);
	if (!group2) return;

	// Create unused group to make sure it doesn't just return all groups
	const group3 = await createGroup(t, user2.token);
	if (!group3) return;

	const [getGroupsResponse, getGroupsBody] = await fetchApi({
		path: "/groups",
		method: RequestMethod.GET,
		schema: GroupsGetRequestSchema,
		token: user1.token,
		searchParams: {},
		requestBody: undefined,
	});

	assert(getGroupsBody.success, "Parsing did not succeed");
	assert(getGroupsResponse.status === StatusCode.OK, "Incorrect status code");

	const groups = getGroupsBody.output;

	assert(groups.length === 2, "There is not exactly 2 groups");
	assert(
		groups.some((group) => group.groupName === g1Name),
		"Group 1 is missing",
	);
	assert(
		groups.some((group) => group.groupName === g2Name),
		"Group 2 is missing",
	);
});

test("GET @ groups: can get groups when not a member of any groups", async (t) => {
	const user = await createUser(t);
	if (!user) return;

	const [getGroupsResponse, getGroupsBody] = await fetchApi({
		path: "/groups",
		method: RequestMethod.GET,
		schema: GroupsGetRequestSchema,
		token: user.token,
		searchParams: {},
		requestBody: undefined,
	});

	assert(getGroupsBody.success, "Parsing did not succeed");
	assert(getGroupsResponse.status === StatusCode.OK, "Incorrect status code");

	const groups = getGroupsBody.output;

	assert(groups.length === 0, "There is not exactly 0 groups");
});
