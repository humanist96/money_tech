import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Kakao from "next-auth/providers/kakao"
import { getDb } from "@/lib/db"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      tier: string
    }
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    tier?: string
    userId?: string
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Kakao({
      clientId: process.env.KAKAO_CLIENT_ID!,
      clientSecret: process.env.KAKAO_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email || !account) {
        return false
      }

      try {
        const sql = getDb()
        await sql`
          INSERT INTO users (email, name, image, provider, provider_id)
          VALUES (${user.email}, ${user.name ?? null}, ${user.image ?? null}, ${account.provider}, ${account.providerAccountId})
          ON CONFLICT (email) DO UPDATE SET
            name = COALESCE(EXCLUDED.name, users.name),
            image = COALESCE(EXCLUDED.image, users.image),
            provider_id = COALESCE(EXCLUDED.provider_id, users.provider_id),
            updated_at = NOW()
        `
        return true
      } catch (error) {
        console.error("Failed to upsert user:", error)
        return false
      }
    },

    async jwt({ token, user, account }) {
      if (user?.email) {
        try {
          const sql = getDb()
          const rows = await sql`
            SELECT id, tier FROM users WHERE email = ${user.email} LIMIT 1
          `
          if (rows.length > 0) {
            token.userId = rows[0].id
            token.tier = rows[0].tier
          }
        } catch (error) {
          console.error("Failed to fetch user tier:", error)
          token.tier = "free"
        }
      }
      return token
    },

    async session({ session, token }) {
      if (token?.userId) {
        session.user.id = token.userId as string
        session.user.tier = (token.tier as string) || "free"
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
})
