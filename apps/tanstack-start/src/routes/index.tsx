import { createFileRoute } from "@tanstack/react-router";

import { AuthShowcase } from "~/component/auth-showcase";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <main className="container flex min-h-screen flex-col items-center justify-center gap-6 py-16">
      <h1 className="text-5xl font-extrabold tracking-tight sm:text-[4rem]">
        Aires <span className="text-primary">Headless CRM</span>
      </h1>
      <p className="text-muted-foreground max-w-xl text-center text-lg">
        This TanStack Start surface is an experimental admin alternative. The
        primary admin UI lives in <code>apps/nextjs</code>.
      </p>
      <AuthShowcase />
    </main>
  );
}
