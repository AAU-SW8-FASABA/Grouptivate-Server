import * as v from "valibot";

import {
	type BaseSchema,
	type BaseIssue,
	type InferOutput,
	parse,
	InferInput,
} from "valibot";

import {
	RequestSchema,
	SearchParametersSchema,
} from "../Grouptivate-API/containers/Request";

export enum RequestMethod {
	GET = "GET",
	POST = "POST",
	PATCH = "PATCH",
	DELETE = "DELETE",
}

export async function fetchApi<
	P extends SearchParametersSchema,
	R extends BaseSchema<unknown, unknown, BaseIssue<unknown>> | undefined,
	D extends BaseSchema<unknown, unknown, BaseIssue<unknown>>,
>(_: {
	path: string;
	method: RequestMethod;
	token: string | null;
	schema: RequestSchema<P, R, D>;
	searchParams: { [K in keyof P]: InferInput<P[K]> };
	requestBody: R extends BaseSchema<unknown, unknown, BaseIssue<unknown>>
		? InferInput<R>
		: undefined;
}): Promise<InferOutput<D>>;
export async function fetchApi<
	P extends SearchParametersSchema,
	R extends BaseSchema<unknown, unknown, BaseIssue<unknown>> | undefined,
	D extends undefined,
>(_: {
	path: string;
	method: RequestMethod;
	token: string | null;
	schema: RequestSchema<P, R, D>;
	searchParams: { [K in keyof P]: InferInput<P[K]> };
	requestBody: R extends BaseSchema<unknown, unknown, BaseIssue<unknown>>
		? InferInput<R>
		: undefined;
}): Promise<void>;
export async function fetchApi<
	P extends SearchParametersSchema,
	R extends BaseSchema<unknown, unknown, BaseIssue<unknown>> | undefined,
	D extends BaseSchema<unknown, unknown, BaseIssue<unknown>> | undefined,
>({
	path,
	method,
	token,
	schema,
	searchParams,
	requestBody,
}: {
	path: string;
	method: RequestMethod;
	token: string | null;
	schema: RequestSchema<P, R, D>;
	searchParams: { [K in keyof P]: InferInput<P[K]> };
	requestBody: R extends BaseSchema<unknown, unknown, BaseIssue<unknown>>
		? InferInput<R>
		: undefined;
}) {
	const newUrl = new URL(path, "http://localhost:3000");
	for (const [key, value] of Object.entries(searchParams)) {
		newUrl.searchParams.set(key, JSON.stringify(value));
	}
	const headers: Record<string, string> = {};
	if (searchParams.responseBody) {
		headers["Content-Type"] = "application/json";
	}
	if (token) {
		headers["Authorization"] = `Bearer ${token}`;
	}
	const response = await fetch(newUrl, {
		method,
		body: requestBody ? JSON.stringify(requestBody) : undefined,
		headers,
	});
	if (!response.ok) {
		throw new Error(`Received bad response: ${await response.text()}`);
	}
	if (schema.responseBody) {
		return parse(schema.responseBody, await response.json());
	}
}
