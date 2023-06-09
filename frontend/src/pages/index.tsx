import Head from "next/head";
import { Inter } from "next/font/google";
import styles from "site/styles/Home.module.css";
import { Google } from "../components/Google";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";

const inter = Inter({ subsets: ["latin"] });

export default function Home() {
	if (!process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID) {
		return;
	}
	return (
		<>
			<Head>
				<title>Create Next App</title>
				<meta name="description" content="Generated by create next app" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<link rel="icon" href="/favicon.ico" />
			</Head>
			<main className={`${styles.main} ${inter.className}`}>
				{!process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ? (
					<div>
						Whoops. We screwed up, and we are unable to log you in. We are sorry
						for this. Please contact support
					</div>
				) : (
					<GoogleOAuthProvider
						clientId={process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID}
					>
						<GoogleLogin
							onSuccess={(e) => {
								fetch(`/api/login`, {
									method: "POST",
									headers: {
										"Content-Type": "application/json",
									},
									body: JSON.stringify({
										id_token: e.credential,
									}),
								})
									.then((res) => res.json())
									.then((res) => {
										console.log(res);
									})
									.catch((e) => {
										// TODO: Handle error!
										console.error("Something went wrong");
									});
							}}
							onError={() => {
								console.log("Login failed");
							}}
						/>
					</GoogleOAuthProvider>
				)}
				;
			</main>
		</>
	);
}
