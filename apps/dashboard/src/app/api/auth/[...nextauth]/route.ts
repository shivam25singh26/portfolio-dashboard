import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import GithubProvider from "next-auth/providers/github"

const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_ID || "placeholder_google_id",
      clientSecret: process.env.GOOGLE_SECRET || "placeholder_google_secret",
    }),
    GithubProvider({
      clientId: process.env.GITHUB_ID || "placeholder_github_id",
      clientSecret: process.env.GITHUB_SECRET || "placeholder_github_secret",
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "2FA Code", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        console.log("[NextAuth] authorize() called with totpCode:", credentials.totpCode ? `"${credentials.totpCode}"` : "(empty)");

        try {
          const payload = {
            email: credentials.email,
            password: credentials.password,
            totp_code: credentials.totpCode || "",
          };
          console.log("[NextAuth] Sending to Go:", JSON.stringify({ email: payload.email, totp_code: payload.totp_code ? "(set)" : "(empty)" }));

          const res = await fetch("http://127.0.0.1:8080/api/users/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          console.log("[NextAuth] Go responded with status:", res.status);

          if (res.ok) {
            const user = await res.json();
            console.log("[NextAuth] SUCCESS! Returning user:", { id: user.id, name: user.name });
            return { 
              id: String(user.id || "1"), 
              name: String(user.name || "User"), 
              email: String(credentials.email) 
            };
          } else {
            const errorText = await res.text();
            console.log("[NextAuth] Go error body:", errorText);
            if (errorText.includes("2FA_REQUIRED")) {
              throw new Error("2FA_REQUIRED");
            }
            if (errorText.includes("INVALID_2FA_CODE")) {
              throw new Error("INVALID_2FA_CODE");
            }
            console.error(`[NextAuth] Go login failed. Body:`, errorText);
          }
        } catch (error: any) {
          console.error("[NextAuth] Fetch exception to Go Gateway:", error);
          if (error.message === "2FA_REQUIRED" || error.message === "INVALID_2FA_CODE") {
            throw error;
          }
        }
        
        console.log("[NextAuth] Returning null (login failed)");
        return null;
      }
    })
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: "jwt" as const,
  },
  callbacks: {
    async jwt({ token, user }: { token: any, user: any }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }: { session: any, token: any }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.name = token.name;
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET || "super_secret_quant_key_12345",
};

// Dynamic handler to bypass strict CSRF host checks during remote previews
import { NextRequest } from "next/server";

async function auth(req: NextRequest, ctx: any) {
  const host = req.headers.get("host");
  const protocol = req.headers.get("x-forwarded-proto") || req.nextUrl?.protocol?.replace(":", "") || "https";
  
  if (host) {
    process.env.NEXTAUTH_URL = `${protocol}://${host}`;
  }
  
  // @ts-ignore
  return NextAuth(authOptions)(req, ctx);
}

export { auth as GET, auth as POST };
