import { createAuthClient } from "better-auth/react"
import { customSessionClient } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";
export const authClient = createAuthClient({
    /** The base URL of the server (optional if you're using the same domain) */
    baseURL: process.env.BETTER_AUTH_URL,
    plugins: [customSessionClient<typeof auth>()],
})