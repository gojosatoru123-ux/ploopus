import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db/drizzle"; // your drizzle instance
import { nextCookies } from "better-auth/next-js";
import { schema } from "@/db/schema";
import { customSession } from "better-auth/plugins";
import { eq } from "drizzle-orm";

export const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    socialProviders: {
        google: {
            prompt: "select_account", //If you want to always ask the user to select an account, you pass the prompt parameter to the provider, setting it to select_account.
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        },
        github: {
            clientId: process.env.GITHUB_CLIENT_ID as string,
            clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
            accessToken: true,
            scope: ["repo, read:user"]
        },
    },
    database: drizzleAdapter(db, {
        provider: "pg", // or "mysql", "sqlite"
        schema,
    }),
    plugins: [
        customSession(async ({ user, session }) => {
            const subscription = await db.select().from(schema.userSubscription).where(eq(schema.userSubscription.userId, user.id)).limit(1)
            return {
                subscription: subscription[0] || null, // add subscription to the session
                user,
                session
            };
        }),
        nextCookies()] // make sure this is the last plugin in the array
});