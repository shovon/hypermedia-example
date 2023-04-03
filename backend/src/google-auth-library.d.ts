declare module "google-auth-library" {
	export class OAuth2Client {
		constructor(clientId: string);

		verifyIdToken(options: { idToken: string; audience: string }): Promise<{
			getPayload(): {
				iss: string;
				sub: string;
				aud: string;
				exp: number;
				iat: number;
				email: string;
				email_verified: boolean;
				name: string;
				picture: string;
				given_name: string;
				family_name: string;
				locale: string;
				alg: string;
				kid: string;
				azp: string;
				at_hash: string;
			};
		}>;
	}
}
