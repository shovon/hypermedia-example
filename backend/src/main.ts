import { Server } from "http";
import * as Koa from "koa";
import * as Router from "@koa/router";
import * as cors from "@koa/cors";
import { OAuth2Client } from "google-auth-library";
import * as bodyParser from "koa-bodyparser";
import { object, string, validate } from "./ninazu";
import { createHash } from "node:crypto";
import { Pool } from "pg";

if (!process.env.GOOGLE_CLIENT_ID) {
	throw new Error("The Google Client ID has not been set!");
}
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

const app = new Koa();
app.use(cors());
app.use(bodyParser());

const router = new Router();

const googleAuthParams = object({
	id_token: string(),
});

function upsertAuthor(payload: { name: string; email: string }) {
	const { name, email } = payload;
	const hash = createHash("sha256");
	hash.update(email);

	const id = hash.digest("hex");
}

router.post("/login/google", async (ctx) => {
	const validation = googleAuthParams.validate(ctx.request.body);
	if (!validation.isValid) {
		ctx.response.status = 400;
		ctx.response.body = validation.error;
		return;
	}
	const { id_token } = validation.value;

	console.log(id_token);

	const ticket = await client.verifyIdToken({
		idToken: id_token,
		audience: GOOGLE_CLIENT_ID!,
	});

	const payload = await ticket.getPayload();

	console.log(payload);

	ctx.response.status = 501;
	ctx.response.body = "Got request, but won't verify it";
});

app.use(router.routes());

app.listen(process.env.PORT || 8080, function (this: Server) {
	console.log(this.address());
});
