import { TestContext } from "node:test";
import assert from "node:assert";
import { fetchApi, RequestMethod } from "./fetch";

import { UserCreateRequestSchema } from "../Grouptivate-API/schemas/User";
import { GroupCreateRequestSchema } from "../Grouptivate-API/schemas/Group";
import {
	GoalCreateRequestSchema,
	GoalType,
} from "../Grouptivate-API/schemas/Goal";
import { Interval } from "../Grouptivate-API/schemas/Interval";
import { StatusCode } from "../src/dbEnums";
import { Metric } from "../Grouptivate-API/schemas/Metric";
import {
	OtherActivity,
	SportActivity,
} from "../Grouptivate-API/schemas/Activity";
import {
	InviteCreateRequestSchema,
	InviteGetRequestSchema,
	InviteRespondRequestSchema,
} from "../Grouptivate-API/schemas/Invite";

export async function createUser(
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

	return { userName, password, ...createUserBody.output };
}

export async function createGroup(
	t: TestContext,
	token: string,
	name: string = "groupName",
	interval: Interval = Interval.Daily,
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

	return { name, interval, ...createGroupBody.output };
}

interface GoalCreateType {
	t: TestContext;
	groupId: string;
	userId: string;
	token: string;
	type?: GoalType;
	title?: string;
	activity?: SportActivity | OtherActivity;
	metric?: Metric;
	target?: number;
	failOnError?: boolean;
}

export async function createGoal(_: GoalCreateType) {
	const type = _.type ?? GoalType.Group;
	const title = _.title ?? "goalTitle";
	const activity = _.activity ?? SportActivity.Wheelchair;
	const metric = _.metric ?? Metric.Calories;
	const target = _.target ?? 1000;

	const [createGoalResponse, createGoalBody] = await fetchApi({
		path: "/group/goal",
		method: RequestMethod.POST,
		schema: GoalCreateRequestSchema,
		token: _.token,
		searchParams: {
			groupId: _.groupId,
			userId: _.userId,
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
		const message = `Failed '${_.t.name}' due to failed goal creation. ParseSuccess: ${createGoalBody.success}, Status Code: ${createGoalResponse.status}`;
		_.failOnError !== undefined && _.failOnError
			? assert(false, message)
			: _.t.skip(message);
		return;
	}

	return {
		...createGoalBody.output,
		..._,
		type,
		title,
		activity,
		metric,
		target,
	};
}

export async function inviteAcceptFlow(
	t: TestContext,
	invitee: { userName: string; userId: string; token: string },
	inviter: { userName: string; userId: string; token: string },
	groupId: string,
): Promise<boolean> {
	const [postInviteResponse] = await fetchApi({
		path: "/group/invite",
		method: RequestMethod.POST,
		schema: InviteCreateRequestSchema,
		token: inviter.token,
		searchParams: {},
		requestBody: {
			groupId,
			inviteeName: invitee.userName,
		},
	});

	if (postInviteResponse.status !== StatusCode.OK) {
		t.skip(`Skipped ${t.name} due to failed invite creation request`);
		return false;
	}

	const [getInviteResponse, getInviteBody] = await fetchApi({
		path: "/group/invite",
		method: RequestMethod.GET,
		schema: InviteGetRequestSchema,
		token: invitee.token,
		searchParams: {},
		requestBody: undefined,
	});

	if (
		getInviteResponse.status !== StatusCode.OK ||
		!getInviteBody.success ||
		getInviteBody.output.length < 1
	) {
		t.skip(`Skipped ${t.name} due to failed invite get request`);
		return false;
	}

	const [acceptInviteResponse] = await fetchApi({
		path: "/group/invite/respond",
		method: RequestMethod.POST,
		schema: InviteRespondRequestSchema,
		token: invitee.token,
		searchParams: {
			inviteId: getInviteBody.output[0].inviteId,
		},
		requestBody: { accepted: true },
	});

	if (acceptInviteResponse.status !== StatusCode.OK) {
		t.skip(`Skipped ${t.name} due to failed invite respond request failed`);
		return false;
	}

	return true;
}

export async function inviteDeclineFlow(
	t: TestContext,
	invitee: { userName: string; userId: string; token: string },
	inviter: { userName: string; userId: string; token: string },
	groupId: string,
): Promise<boolean> {
	const [postInviteResponse] = await fetchApi({
		path: "/group/invite",
		method: RequestMethod.POST,
		schema: InviteCreateRequestSchema,
		token: inviter.token,
		searchParams: {},
		requestBody: {
			groupId,
			inviteeName: invitee.userName,
		},
	});

	if (postInviteResponse.status !== StatusCode.OK) {
		t.skip(`Skipped ${t.name} due to failed invite creation request`);
		return false;
	}

	const [getInviteResponse, getInviteBody] = await fetchApi({
		path: "/group/invite",
		method: RequestMethod.GET,
		schema: InviteGetRequestSchema,
		token: invitee.token,
		searchParams: {},
		requestBody: undefined,
	});

	if (
		getInviteResponse.status !== StatusCode.OK ||
		!getInviteBody.success ||
		getInviteBody.output.length < 1
	) {
		t.skip(`Skipped ${t.name} due to failed invite get request`);
		return false;
	}

	const [acceptInviteResponse] = await fetchApi({
		path: "/group/invite/respond",
		method: RequestMethod.POST,
		schema: InviteRespondRequestSchema,
		token: invitee.token,
		searchParams: {
			inviteId: getInviteBody.output[0].inviteId,
		},
		requestBody: { accepted: false },
	});

	if (acceptInviteResponse.status !== StatusCode.OK) {
		t.skip(`Skipped ${t.name} due to failed invite respond request failed`);
		return false;
	}

	return true;
}

export async function invite(
	t: TestContext,
	invitee: { userName: string; userId: string; token: string },
	inviter: { userName: string; userId: string; token: string },
	groupId: string,
): Promise<boolean> {
	const [postInviteResponse] = await fetchApi({
		path: "/group/invite",
		method: RequestMethod.POST,
		schema: InviteCreateRequestSchema,
		token: inviter.token,
		searchParams: {},
		requestBody: {
			groupId,
			inviteeName: invitee.userName,
		},
	});

	if (postInviteResponse.status !== StatusCode.OK) {
		t.skip(`Skipped ${t.name} due to failed invite creation request`);
		return false;
	}

	return true;
}
