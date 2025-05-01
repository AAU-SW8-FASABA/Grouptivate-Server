import type { SearchParametersSchema } from "../../Grouptivate-API/containers/Request";
import { type Request } from "express";
import * as v from "valibot";

// Define the return type based on safeParse applied to each schema entry
type ParamsReturnType<
	T extends Record<
		string,
		v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>
	>,
> = {
	[K in keyof T]: v.SafeParseResult<T[K]>;
};

function typedEntries<T extends object>(obj: T): [keyof T, T[keyof T]][] {
	return Object.entries(obj) as [keyof T, T[keyof T]][];
}

export function getParsedSearchParams<S extends SearchParametersSchema>(
	schema: S,
	req: Request,
) {
	const searchParamsEntries = typedEntries(schema);

	const parsedParams: ParamsReturnType<typeof schema> =
		searchParamsEntries.reduce(
			(acc, [key, schema]) => {
				const rawValue = req.query[key as string];
				acc[key] = v.safeParse(
					schema,
					rawValue === undefined || typeof rawValue !== "string"
						? rawValue
						: JSON.parse(rawValue),
				);
				return acc;
			},
			{} as ParamsReturnType<typeof schema>,
		);

	return parsedParams;
}
