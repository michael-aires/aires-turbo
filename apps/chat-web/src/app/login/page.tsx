import { redirect } from "next/navigation";

import { getSession } from "~/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/chat");

  const googleEnabled = Boolean(
    process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
  );

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="bg-card w-full max-w-sm space-y-6 rounded-xl border p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Aires Agent Chat</h1>
          <p className="text-muted-foreground text-sm">
            Sign in to chat with your CRM agents.
          </p>
        </div>

        <LoginForm googleEnabled={googleEnabled} />
      </div>
    </main>
  );
}
