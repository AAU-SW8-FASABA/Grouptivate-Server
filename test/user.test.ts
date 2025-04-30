import assert from "node:assert";
import { test, beforeEach, afterEach } from "node:test";
import { start, end } from "./setup";

import { UserCreateRequestSchema } from "../Grouptivate-API/schemas/User";
import { fetchApi, RequestMethod } from "./fetch";

beforeEach(async () => {
	await start();
});

afterEach(async () => {
	await end();
});

test("server is running", async () => {
	const request = new Request("http://localhost:3000", {
		method: "GET",
	});
	const response = await fetch(request);
	assert.strictEqual(
		await response.text(),
		"Hello to the one and only Grouptivate",
	);
});

test("can create user", async () => {
	const response = await fetchApi({
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

	// assert.strictEqual(response., 200);
	assert.strictEqual(typeof response.token, "string");
	assert.strictEqual(response.token.length, 64);
	assert.strictEqual(typeof response.userId, "string");
	assert.strictEqual(response.userId.length, 24);
});

test("cannot create user with duplicate name", () => {});
