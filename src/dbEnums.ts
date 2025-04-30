export enum CollectionEnum {
	Goal = "Goal",
	Group = "Group",
	User = "User",
	Invite = "Invite",
	Session = "Session",
}

export enum StatusCode {
	OK = 200,
	CREATED = 201,
	BAD_REQUEST = 400,
	UNAUTHORIZED = 401,
	FORBIDDEN = 403,
	NOT_FOUND = 404,
	CONFLICT = 409,
	INTERNAL_SERVER_ERROR = 500,
}
