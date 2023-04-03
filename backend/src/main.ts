import { Server } from "http";
import * as Koa from "koa";
import * as KoaRouter from "@koa/router";
import { Middleware } from "@koa/router";
import * as cors from "@koa/cors";
import { OAuth2Client } from "google-auth-library";
import * as bodyParser from "koa-bodyparser";
import { object, string } from "./ninazu";

import { createHash, randomBytes } from "node:crypto";
import { Pool } from "pg";

const pool = new Pool();

if (!process.env.GOOGLE_CLIENT_ID) {
	throw new Error("The Google Client ID has not been set!");
}
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

type IRI = string;

type Collection<T> = {
	totalItems: number;
	prev?: IRI;
	next?: IRI;
	items: T[];
};

const app = new Koa();
app.use(
	cors({
		origin: "http://localhost:3000",
	})
);
app.use(bodyParser());

const router = new KoaRouter();

const googleAuthParams = object({
	id_token: string(),
});

async function upsertAuthor(payload: {
	name: string;
	email: string;
}): Promise<string> {
	const { name, email } = payload;

	const author = await pool.query(
		`
		SELECT id
		FROM authors
		WHERE email = $1
		`,
		[email]
	);

	if (author.rowCount > 0) {
		return author.rows[0].id;
	}

	const hash = createHash("md5");
	hash.update(email);

	const profilePicture = `https://www.gravatar.com/avatar/${hash.digest(
		"hex"
	)}?s=200`;

	const result = await pool.query(
		`
		INSERT INTO authors (name, email, profile_picture) VALUES ($1, $2, $3)
		RETURNING id;
		`,
		[name, email, profilePicture]
	);

	return result.rows[0].id;
}

async function createAuth(authorId: string): Promise<string> {
	const key = randomBytes(64).toString("base64");

	const result = await pool.query(
		`
		INSERT INTO auths (token, author_id) VALUES ($1, $2)
		RETURNING token;
		`,
		[key, authorId]
	);

	if (result.rows[0]?.token !== key) {
		// TODO: is this really a good idea?
		throw new Error("Failed to create auth");
	}

	return key;
}

router.post("/login/google", async (ctx) => {
	const validation = googleAuthParams.validate(ctx.request.body);
	if (!validation.isValid) {
		ctx.response.status = 400;
		ctx.response.body = validation.error;
		return;
	}
	const { id_token } = validation.value;

	const ticket = await client.verifyIdToken({
		idToken: id_token,
		audience: GOOGLE_CLIENT_ID!,
	});

	const payload = await ticket.getPayload();

	const id = await upsertAuthor(payload);
	const token = await createAuth(id);

	ctx.response.status = 200;
	ctx.response.body = { token };
});

function getNumber(query: string | string[] | undefined) {
	if (typeof query === "string" && /^\d+/.test(query)) {
		return parseInt(query, 10);
	}
	return undefined;
}

router.get("/posts", async (ctx) => {
	const max = 10;

	if (ctx.query.page) {
		if (ctx.query.page !== "string" || !/^\d+$/.test(ctx.query.page)) {
			return ctx.throw(400, "Invalid page number");
		}
	}

	const pageNumber = getNumber(ctx.query.page) ?? 1;
	const offset = (pageNumber - 1) * max;

	const result = await pool.query(
		`
		SELECT id, author_id, post_body, when_created
		FROM posts
		WHERE post_body IS NOT NULL AND in_reply_to IS NULL
		ORDER BY when_created
		DESC
		LIMIT $1
		OFFSET $2
		`,
		[max, offset]
	);

	const count = await pool.query(
		`
		SELECT COUNT(*) AS count
		`
	);

	const hasNextPage = count.rows[0].count > pageNumber * max;

	ctx.response.body = {
		totalItems: count.rows[0].count,
		next: hasNextPage ? `/posts?page=${pageNumber + 1}` : undefined,
		prev: pageNumber > 1 ? `/posts?page=${pageNumber - 1}` : undefined,
		items: result.rows.map((row) => {
			return {
				id: `/posts/${row.id}`,
				author: row.author_id ? `/authors/${row.author_id}` : null,
				postBody: row.post_body,
				whenCreated: row.when_created,
				isDeleted: false,
				comments: `/posts/${row.id}/comments`,
			};
		}),
	};
});

const authHandler: Middleware<{ authorId?: string }> = async (ctx, next) => {
	const authorization = ctx.request.header["authorization"];
	if (!authorization) {
		return ctx.throw(401, "Missing authorization header");
	}

	const [type, token] = authorization.split(" ");
	if (type !== "Bearer") {
		return ctx.throw(401, "Invalid authorization type");
	}

	const result = await pool.query(
		`
		SELECT author_id
		FROM auths
		WHERE token = $1
		`,
		[token]
	);

	if (result.rowCount === 0) {
		return ctx.throw(401, "Invalid token");
	}

	ctx.state.authorId = result.rows[0].author_id;

	await next();
};

const postBodySchema = object({
	postBody: string(),
});

router.post("/posts", authHandler, (async (ctx) => {
	const validation = postBodySchema.validate(ctx.request.body);
	if (!validation.isValid) {
		ctx.response.status = 400;
		ctx.response.body = validation.error;
		return;
	}

	const result = await pool.query(
		`
		INSERT INTO posts (author_id, post_body)
		VALUES ($1, $2)
		RETURNING id
		`,
		[ctx.state.authorId, validation.value]
	);

	ctx.response.status = 201;
	ctx.response.body = {
		id: `/posts/${result.rows[0].id}`,
	};
}) as Middleware<{ authorId: string }>);

router.get("/posts/:id", async (ctx) => {
	const result = await pool.query(
		`
		SELECT id, author_id, post_body, when_created
		FROM posts
		WHERE id = $1 AND post_body IS NOT NULL AND in_reply_to IS NULL
		`,
		[ctx.params.id]
	);

	if (result.rows.length === 0) {
		return ctx.throw(404, "Post not found");
	}

	const row = result.rows[0];

	ctx.response.body = {
		id: `/posts/${row.id}`,
		author: row.author_id ? `/authors/${row.author_id}` : null,
		postBody: row.post_body,
		whenCreated: row.when_created,
		isDeleted: false,
		comments: `/posts/${row.id}/comments`,
	};
});

router.get("/posts/:id/comments", async (ctx) => {
	const max = 10;

	if (ctx.query.page) {
		if (ctx.query.page !== "string" || !/^\d+$/.test(ctx.query.page)) {
			return ctx.throw(400, "Invalid page number");
		}
	}

	const pageNumber = getNumber(ctx.query.page) ?? 1;
	const offset = (pageNumber - 1) * max;

	const result = await pool.query(
		`
		SELECT id, author_id, post_body, when_created
		FROM posts
		WHERE post_body IS NOT NULL AND in_reply_to = $1
		ORDER BY when_created
		DESC
		LIMIT $2
		OFFSET $3
		`,
		[ctx.params.id, max, offset]
	);

	const count = await pool.query(
		`
		SELECT COUNT(*) AS count
		FROM posts
		WHERE in_reply_to = $1
		`,
		[ctx.params.id]
	);

	const hasNextPage = count.rows[0].count > pageNumber * max;

	ctx.response.body = {
		totalItems: count.rows[0].count,
		next: hasNextPage
			? `/posts/${ctx.params.id}/comments?page=${pageNumber + 1}`
			: undefined,
		prev:
			pageNumber > 1
				? `/posts/${ctx.params.id}/comments?page=${pageNumber - 1}`
				: undefined,
		items: result.rows.map((row) => {
			return {
				id: `/posts/${row.id}`,
				author: row.post_body
					? row.author_id
						? `/authors/${row.author_id}`
						: null
					: undefined,
				postBody: row.post_body ? row.post_body : undefined,
				whenCreated: row.when_created,
				isDeleted: row.post_body ? false : true,
				comments: `/posts/${row.id}/comments`,
			};
		}),
	};
});

router.post("/posts/:id/comments", authHandler, async (ctx) => {
	const validation = postBodySchema.validate(ctx.request.body);
	if (!validation.isValid) {
		ctx.response.status = 400;
		ctx.response.body = validation.error;
		return;
	}

	const result = await pool.query(
		`
		INSERT INTO posts (author_id, post_body, in_reply_to)
		VALUES ($1, $2, $3)
		RETURNING id
		`,
		[ctx.state.authorId, validation.value, ctx.params.id]
	);

	ctx.response.status = 201;
	ctx.response.body = {
		id: `/posts/${ctx.params.id}/comments/${result.rows[0].id}`,
	};
});

router.get("/posts/:id/comments/:commentId", async (ctx) => {
	const result = await pool.query(
		`
		SELECT id, author_id, post_body, when_created
		FROM posts
		WHERE id = $1 AND post_body IS NOT NULL AND in_reply_to = $2
		`,
		[ctx.params.commentId, ctx.params.id]
	);

	if (result.rows.length === 0) {
		return ctx.throw(404, "Comment not found");
	}

	const row = result.rows[0];

	ctx.response.body = {
		id: `/posts/${row.id}`,
		author: row.post_body
			? row.author_id
				? `/authors/${row.author_id}`
				: null
			: undefined,
		postBody: row.post_body ? row.post_body : undefined,
		whenCreated: row.when_created,
		isDeleted: row.post_body ? false : true,
		inReplyTo: `/posts/${ctx.params.id}`,
		comments: `/posts/${row.id}/comments`,
	};
});

app.use(router.routes());

app.listen(process.env.PORT || 8080, function (this: Server) {
	console.log(this.address());
});
