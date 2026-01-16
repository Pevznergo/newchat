import { compare } from "bcrypt-ts";
import NextAuth, { type DefaultSession } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Yandex from "next-auth/providers/yandex";
import {
  createGoogleUser,
  createGuestUser,
  createTelegramUser,
  createYandexUser,
  getUser,
  linkGoogleAccount,
  linkYandexAccount,
} from "@/lib/db/queries";
import { authConfig } from "./auth.config";

export type UserType = "guest" | "regular";

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

        return { ...user, type: "regular" };
      },
    }),
    Credentials({
      id: "guest",
      credentials: {},
      async authorize() {
        try {
          console.log("Creating guest user...");
          const [guestUser] = await createGuestUser();
          console.log("Guest user created:", guestUser);
          return { ...guestUser, type: "guest" };
        } catch (error) {
          console.error("Error creating guest user:", error);
          return null;
        }
      },
    }),
    Credentials({
      id: "telegram-login",
      name: "Telegram Login",
      credentials: {},
      async authorize(credentials: any) {
        const { id, first_name, last_name, username, photo_url, auth_date, hash } = credentials;
        
        // Verify Telegram data
        const dataCheckArr: string[] = [];
        if (auth_date) { dataCheckArr.push(`auth_date=${auth_date}`); }
        if (first_name) { dataCheckArr.push(`first_name=${first_name}`); }
        if (id) { dataCheckArr.push(`id=${id}`); }
        if (last_name) { dataCheckArr.push(`last_name=${last_name}`); }
        if (photo_url) { dataCheckArr.push(`photo_url=${photo_url}`); }
        if (username) { dataCheckArr.push(`username=${username}`); }
        
        dataCheckArr.sort();
        const dataCheckString = dataCheckArr.join('\n');
        
        const secretKey = await crypto.subtle.digest(
          "SHA-256", 
          new TextEncoder().encode(process.env.TELEGRAM_BOT_TOKEN)
        );
        
        const hmacKey = await crypto.subtle.importKey(
          "raw", 
          secretKey, 
          { name: "HMAC", hash: "SHA-256" }, 
          false, 
          ["sign"]
        );
        
        const signature = await crypto.subtle.sign(
          "HMAC", 
          hmacKey, 
          new TextEncoder().encode(dataCheckString)
        );
        
        const hashHex = Array.from(new Uint8Array(signature))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
          
        if (hashHex !== hash) {
          console.error("Telegram hash verification failed");
          return null;
        }

        // Check auth_date freshness (e.g. within 24 hours)
        const now = Math.floor(Date.now() / 1000);
        if (now - Number.parseInt(auth_date, 10) > 86400) {
           console.error("Telegram auth data outdated");
           return null;
        }

        const telegramId = id.toString();
        const email = `telegram-${telegramId}@telegram.bot`; // maintain same email format as queries.ts

        // Find or create user
        const users = await getUser(email);
        
        if (users.length === 0) {
           // Create new user
           const [newUser] = await createTelegramUser(telegramId, email);
           return { ...newUser, type: "regular", name: [first_name, last_name].filter(Boolean).join(" "), image: photo_url };
        } 
        
        const [existingUser] = users;
        return { ...existingUser, type: "regular", name: [first_name, last_name].filter(Boolean).join(" "), image: photo_url };
      }
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Yandex({
      clientId: process.env.YANDEX_CLIENT_ID,
      clientSecret: process.env.YANDEX_CLIENT_SECRET,
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

      if (account?.provider === "yandex") {
        const email = user.email;
        if (!email) {
          return false;
        }

        const users = await getUser(email);

        if (users.length === 0) {
          // Create new user linked to Yandex
          await createYandexUser(email, account.providerAccountId);
        } else {
          const [dbUser] = users;
          if (!dbUser.yandexId) {
            // Link existing account
            await linkYandexAccount(email, account.providerAccountId);
          }
        }
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.type = user.type;
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
