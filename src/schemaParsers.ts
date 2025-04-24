import type { WithId } from 'mongodb';
import { object, safeParse } from 'valibot';
import type {
    RequestSchema,
    SearchParametersSchema,
} from '../Grouptivate-API/containers/Request';
import type { Request, Response } from 'express';

export function convertObj(inputobj: WithId<Document>) {
    let obj: Record<any, any> = inputobj;
    obj.uuid = inputobj['_id'].toString();

    delete obj['_id'];

    return obj;
}

export function parseInput(
    inputSchema: RequestSchema<SearchParametersSchema, any, any>,
    req: Request,
    res: Response,
) {
    const parseRes = [];
    const result: Record<string, any> = {
        issues: [],
    };
    if (Object.keys(inputSchema.searchParams).length > 0) {
        const paramSchema = inputSchema.searchParams;
        for (const [key, value] of Object.entries(paramSchema)) {
            const parse = safeParse(value, req.query[key]);
            parseRes.push(parse.success);
            if (!parse.success) {
                console.log('Param error');
                console.log(paramSchema);
                console.log(req.query);
                result.issues.push(parse.issues);
            }
            result[key] = parse.output;
        }

        result.success = parseRes.every((v) => v === true);
    }
    if (
        inputSchema?.requestBody &&
        Object.keys(inputSchema?.requestBody).length > 0
    ) {
        const parseBody = safeParse(inputSchema.requestBody, req.body);
        result.success = parseBody.success && (result?.success ?? true);
        if (!result.success) console.log(parseBody.issues);
        result.issues.concat(parseBody.issues);
        if (Array.isArray(parseBody.output)) {
            Object.assign(result, { body: parseBody.output });
        } else {
            Object.assign(result, parseBody.output);
        }
    }
    if (!result.success) {
        res.status(400).send(result.issues);
    }
    return result;
}

export function parseOutput(
    schema: RequestSchema<SearchParametersSchema, any, any>,
    data: WithId<Document> | object | Array<object>,
    res: Response,
) {
    if (schema.responseBody) {
        if ('_id' in data) {
            data = convertObj(data);
        } else if (Array.isArray(data)) {
            for (const index in data) {
                data[index] = convertObj(data[index]);
            }
        }
        const parseRes = safeParse(schema.responseBody, data);
        if (parseRes.success) {
            // console.log(parseRes.output)
            return res.send(parseRes.output);
        } else {
            return res.status(401).send(parseRes.issues);
        }
    }
    return res.status(200).send('No responseBody');
}
