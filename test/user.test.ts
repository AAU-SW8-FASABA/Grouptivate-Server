import assert from "node:assert";
import { test, beforeEach, afterEach } from "node:test";
import crypto from "node:crypto";
import { start, end } from "./setup";

import {
	UserCreateRequestSchema,
	UserGetRequestSchema,
} from "../Grouptivate-API/schemas/User";
import {
	LoginRequestSchema,
	VerifyRequestSchema,
} from "../Grouptivate-API/schemas/Login";
import { fetchApi, RequestMethod } from "./fetch";
import { StatusCode } from "../src/dbEnums";
import UserModel from "../src/models/UserModel";
import SessionModel from "../src/models/SessionModel";
import { response } from "express";

beforeEach(async () => {
	await start();
});

afterEach(async () => {
	await end();
});

test("POST @ user: can create user", async () => {
	const [response, parsed] = await fetchApi({
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

	assert(parsed.success);
	assert.strictEqual(response.status, StatusCode.CREATED);

	const users = await UserModel.find();
	assert.strictEqual(users.length, 1);

	const sessions = await SessionModel.find();
	assert.strictEqual(sessions.length, 1);
});

test("POST @ user: cannot create user with duplicate name", async () => {
	const [response1, parsed1] = await fetchApi({
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

	assert.strictEqual(parsed1.success, true);
	assert.strictEqual(response1.status, StatusCode.CREATED);

	const [response2, parsed2] = await fetchApi({
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

	assert.strictEqual(parsed2.success, false);
	assert.strictEqual(response2.status, StatusCode.CONFLICT);

	const users = await UserModel.find();
	assert.strictEqual(users.length, 1);

	const sessions = await SessionModel.find();
	assert.strictEqual(sessions.length, 1);
});

test("GET @ user: it is possible to get a user", async (t) => {
	const username = "testName";
	const password = "testPassword1";
	const [createUserResponse, createUserBody] = await fetchApi({
		path: "/user",
		method: RequestMethod.POST,
		schema: UserCreateRequestSchema,
		token: null,
		searchParams: {},
		requestBody: {
			name: username,
			password: password,
		},
	});

	if (
		!createUserBody.success ||
		createUserResponse.status !== StatusCode.CREATED
	) {
		t.skip("User creation failed");
		return;
	}

	const [getUserResponse, getUserBody] = await fetchApi({
		path: "/user",
		method: RequestMethod.GET,
		schema: UserGetRequestSchema,
		token: createUserBody.output.token,
		searchParams: {},
		requestBody: undefined,
	});

	assert(getUserBody.success);
	assert.strictEqual(getUserResponse.status, StatusCode.OK);
	assert.strictEqual(getUserBody.output.name, username);
});

test("GET @ user: impossible to get user with invalid token", async (t) => {
	const username = "testName";
	const password = "testPassword1";
	const [createUserResponse, createUserBody] = await fetchApi({
		path: "/user",
		method: RequestMethod.POST,
		schema: UserCreateRequestSchema,
		token: null,
		searchParams: {},
		requestBody: {
			name: username,
			password: password,
		},
	});

	if (
		!createUserBody.success ||
		createUserResponse.status !== StatusCode.CREATED
	) {
		t.skip("User creation failed");
		return;
	}

	const [getUserResponse, getUserBody] = await fetchApi({
		path: "/user",
		method: RequestMethod.GET,
		schema: UserGetRequestSchema,
		token: "invalidtoken",
		searchParams: {},
		requestBody: undefined,
	});

	assert(!getUserBody.success);
	assert.strictEqual(getUserResponse.status, StatusCode.UNAUTHORIZED);
});

test("GET @ user/verify: can verify valid token", async (t) => {
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
		t.skip("User creation failed");
		return;
	}

	const [verifyResponse, _] = await fetchApi({
		path: "/user/verify",
		method: RequestMethod.POST,
		schema: VerifyRequestSchema,
		token: createUserBody.output.token,
		searchParams: {},
		requestBody: undefined,
	});

	assert.strictEqual(verifyResponse.status, StatusCode.OK);
});

test("GET @ user/verify: can not verify invalid token", async (t) => {
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
		t.skip("User creation failed");
		return;
	}

	const [verifyResponse, _] = await fetchApi({
		path: "/user/verify",
		method: RequestMethod.POST,
		schema: VerifyRequestSchema,
		token: crypto.randomBytes(32).toString("hex"),
		searchParams: {},
		requestBody: undefined,
	});

	assert.strictEqual(verifyResponse.status, StatusCode.UNAUTHORIZED);
});

test("POST @ user/login: incorrect username must fail", async (t) => {
	const username = "testName";
	const password = "testPassword1";
	const [createResponse, createBody] = await fetchApi({
		path: "/user",
		method: RequestMethod.POST,
		schema: UserCreateRequestSchema,
		token: null,
		searchParams: {},
		requestBody: {
			name: username,
			password: password,
		},
	});

	if (!createBody.success || createResponse.status !== StatusCode.CREATED) {
		t.skip("User creation failed");
		return;
	}

	const [loginResponse, loginBody] = await fetchApi({
		path: "/user/login",
		method: RequestMethod.POST,
		schema: LoginRequestSchema,
		token: null,
		searchParams: {},
		requestBody: {
			name: "incorrectName",
			password: password,
		},
	});

	assert(
		!loginBody.success,
		"Response body must not parse when login is incorrect",
	);
	assert.strictEqual(
		loginResponse.status,
		StatusCode.UNAUTHORIZED,
		"Login response must be 201 UNAUTHORIZED",
	);
});

test("POST @ user/login: incorrect password must fail", async (t) => {
	const username = "testName";
	const password = "testPassword1";
	const [createResponse, createBody] = await fetchApi({
		path: "/user",
		method: RequestMethod.POST,
		schema: UserCreateRequestSchema,
		token: null,
		searchParams: {},
		requestBody: {
			name: username,
			password: password,
		},
	});

	if (!createBody.success || createResponse.status !== StatusCode.CREATED) {
		t.skip("User creation failed");
		return;
	}

	const [loginResponse, loginBody] = await fetchApi({
		path: "/user/login",
		method: RequestMethod.POST,
		schema: LoginRequestSchema,
		token: null,
		searchParams: {},
		requestBody: {
			name: username,
			password: "incorrectPassword3",
		},
	});

	assert(
		!loginBody.success,
		"Response body must not parse when login is incorrect",
	);
	assert.strictEqual(
		loginResponse.status,
		StatusCode.UNAUTHORIZED,
		"Login response must be 401 UNAUTHORIZED",
	);
});
test("POST @ user/login: can login and has only one session token", async (t) => {
	const username = "testName";
	const password = "testPassword1";
	const [createResponse, createBody] = await fetchApi({
		path: "/user",
		method: RequestMethod.POST,
		schema: UserCreateRequestSchema,
		token: null,
		searchParams: {},
		requestBody: {
			name: username,
			password: password,
		},
	});

	if (!createBody.success || createResponse.status !== StatusCode.CREATED) {
		t.skip("User creation failed");
		return;
	}

	const [loginResponse, loginBody] = await fetchApi({
		path: "/user/login",
		method: RequestMethod.POST,
		schema: LoginRequestSchema,
		token: null,
		searchParams: {},
		requestBody: {
			name: username,
			password: password,
		},
	});

	assert(loginBody.success, "Response body must parse correctly");
	assert.strictEqual(
		loginResponse.status,
		StatusCode.OK,
		"Login response must be 200 OK",
	);
	assert.notStrictEqual(
		createBody.output.token,
		loginBody.output.token,
		"Server must generate new token",
	);
	assert.strictEqual(
		createBody.output.userId,
		loginBody.output.userId,
		"User ids must be the same",
	);

	const sessions = await SessionModel.find({
		userId: createBody.output.userId,
	});
	assert.strictEqual(
		sessions.length,
		1,
		"Every user must only have a single active session",
	);
});
