import { NextApiRequest, NextApiResponse } from "next";

type Data = {
	token: string;
};

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse<Data>
) {
	const token = req.body["id_token"] as string;
	const response = await fetch(
		`${process.env.NEXT_PUBLIC_REMOTE_ENDPOINT}/login/google`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				id_token: token,
			}),
		}
	);

	const result = await response.json();
	const authToken = result.token;

	// const { token: authToken } = await response.json();

	res.setHeader(
		"Set-Cookie",
		`auth_token=${authToken}; path=/; httponly; Max-Age=11510640000`
	);
	res.statusCode = 200;
	res.write(JSON.stringify({ message: "Success!" }));
}
