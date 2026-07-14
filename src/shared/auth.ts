import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { User } from "@/shared/types";
import { authConfig } from "@/shared/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const [{ prisma }, bcrypt] = await Promise.all([
          import("@/shared/db"),
          import("bcryptjs"),
        ]);
        const user = (await prisma.user.findUnique({ where: { email } })) as User | null;
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.default.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
});
