import assert from "node:assert";
import { test, beforeEach, afterEach, TestContext } from "node:test";
import { start, end } from "./setup";

import { UserCreateRequestSchema } from "../Grouptivate-API/schemas/User";
import { GroupCreateRequestSchema } from "../Grouptivate-API/schemas/Group";
import { Interval } from "../Grouptivate-API/schemas/Interval";
import { fetchApi, RequestMethod } from "./fetch";
import { StatusCode } from "../src/dbEnums";
import UserModel from "../src/models/UserModel";
import GroupModel from "../src/models/GroupModel";

beforeEach(async () => {
	await start();
});

afterEach(async () => {
	await end();
});

async function createUser(t: TestContext) {
	const [createUserResponse, createUserBody] = await fetchApi({
		path: "/user",
		method: RequestMethod.POST,
		schema: UserCreateRequestSchema,
		token: null,
		searchParams: {},
		requestBody: {
			name: "testName",
			password: "testPassword1",
		},
	});

	if (
		!createUserBody.success ||
		createUserResponse.status !== StatusCode.CREATED
	) {
		t.skip(`Skipped '${t.name}' due to failed user creation.`);
		return;
	}

	return createUserBody.output;
}

test("POST @ group: can create group", async (t) => {
	const user = await createUser(t);
	if (!user) {
		t.skip("User is undefined");
		return;
	}

	const groupName = "Test Group";
	const groupInterval = Interval.Daily;

	const [response, parsed] = await fetchApi({
		path: "/group",
		method: RequestMethod.POST,
		schema: GroupCreateRequestSchema,
		token: user.token,
		searchParams: {},
		requestBody: {
			groupName: groupName,
			interval: groupInterval,
		},
	});

	assert(parsed.success, "Parsing did not succeed");
	assert(response.status === StatusCode.CREATED, "Incorrect status code");

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
	if (!user) {
		t.skip("User is undefined");
		return;
	}

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

	assert(groups.length === 0, "The group was created with invalid name");
});

test("POST @ group: cannot create group without interval", async (t) => {
	const user = await createUser(t);
	if (!user) {
		t.skip("User is undefined");
		return;
	}

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

	assert(groups.length === 0, "The group was created with invalid interval");
});
