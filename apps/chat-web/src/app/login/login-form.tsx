"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@acme/ui/button";

import { authClient } from "~/lib/auth-client";

interface LoginFormProps {
  googleEnabled: boolean;
}

/**
 * Email+password login form for Aires Agent Chat. Talks to Better-Auth
 * through the same-origin `/api/auth/*` proxy. On success we route to `/chat`
 * which redirects into a fresh thread.
 *
 * Google SSO is still available when the env vars are wired; we hide the
 * divider when it's not configured so the form stays clean.
 */
export function LoginForm({ googleEnabled }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const { error: authError } = await authClient.signIn.email({
        email: email.trim(),
        password,
      });
      if (authError) {
        setError(authError.message ?? "Sign-in failed. Check your credentials.");
        return;
      }
      router.push("/chat");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-3">
        <label className="block space-y-1">
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Email
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
            className="border-input bg-background focus:border-ring focus:ring-ring/20 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
            placeholder="you@aires.ai"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Password
          </span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
            }}
            className="border-input bg-background focus:border-ring focus:ring-ring/20 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
            placeholder="••••••••"
          />
        </label>

        {error ? (
          <div
            role="alert"
            className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm"
          >
            {error}
          </div>
        ) : null}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {googleEnabled ? (
        <>
          <div className="flex items-center gap-3">
            <div className="bg-border h-px flex-1" />
            <span className="text-muted-foreground text-xs uppercase">or</span>
            <div className="bg-border h-px flex-1" />
          </div>

          <form action="/api/auth/sign-in/social" method="POST">
            <input type="hidden" name="provider" value="google" />
            <Button type="submit" variant="outline" className="w-full">
              Continue with Google
            </Button>
          </form>
        </>
      ) : null}
    </div>
  );
}
