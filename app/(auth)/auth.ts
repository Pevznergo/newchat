import { compare } from "bcrypt-ts";
import NextAuth, { type DefaultSession } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import {
  createGoogleUser,
  createGuestUser,
  getUser,
  linkGoogleAccount,
} from "@/lib/db/queries";
import { authConfig } from "./auth.config";

export type UserType = "guest" | "regular" | "pro";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      type: UserType;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    email?: string | null;
    type: UserType;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    type: UserType;
  }
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {},
      async authorize({ email, password }: any) {
        const users = await getUser(email);

        if (users.length === 0) {
          // Allow dummy password only if user doesn't exist
          // But strict logic: return null
          return null;
        }

        const [user] = users;

        if (!user.password) {
          // If user has no password (e.g. created via Google), they can't login via credentials
          return null;
        }

        const passwordsMatch = await compare(password, user.password);

        if (!passwordsMatch) {
          return null;
        }

        return { ...user, type: user.hasPaid ? "pro" : "regular" };
      },
    }),
    Credentials({
      id: "guest",
      credentials: {},
      async authorize() {
        const [guestUser] = await createGuestUser();
        return { ...guestUser, type: "guest" };
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const email = user.email;
        if (!email) {
          return false;
        }

        const users = await getUser(email);

        if (users.length === 0) {
          // Create new user linked to Google
          await createGoogleUser(email, account.providerAccountId);
        } else {
          const [dbUser] = users;
          if (!dbUser.googleId) {
            // Link existing account
            await linkGoogleAccount(email, account.providerAccountId);
          }
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id as string;

        if (account?.provider === "credentials" && (user as any).type) {
          token.type = (user as any).type;
        } else if (user.email) {
          // For Google (or other providers), fetch user from DB to get hasPaid/type
          const users = await getUser(user.email);
          if (users.length > 0) {
            const dbUser = users[0];
            token.type = dbUser.hasPaid ? "pro" : "regular";
            // Also ensure ID matches DB ID if needed, but next-auth usually handles ID.
            token.id = dbUser.id.toString();
          } else {
            // Should not happen as signIn creates the user
            token.type = "regular";
          }
        } else {
          token.type = "guest";
        }
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.type = token.type;
      }

      return session;
    },
  },
});
