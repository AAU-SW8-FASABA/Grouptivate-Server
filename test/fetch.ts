import {
	type BaseSchema,
	type BaseIssue,
	type InferOutput,
	type SafeParseResult,
	safeParse,
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
}): Promise<[Response, SafeParseResult<D>]>;
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
}): Promise<[Response, undefined]>;
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
	if (schema.requestBody) {
		headers["Content-Type"] = "application/json;charset=UTF-8";
	}
	if (token) {
		headers["Authorization"] = `Bearer ${token}`;
	}
	const response = await fetch(newUrl, {
		method,
		body: requestBody ? JSON.stringify(requestBody) : undefined,
		headers,
	});

	return [
		response,
		schema.responseBody
			? safeParse(schema.responseBody, await response.json())
			: undefined,
	];
}
