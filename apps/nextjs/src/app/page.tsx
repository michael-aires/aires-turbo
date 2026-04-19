import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@acme/ui/button";

import { getSession } from "~/auth/server";
import { AuthShowcase } from "./_components/auth-showcase";
import { getAccessibleOrganizationIds } from "./_lib/organization";

interface HomePageProps {
  searchParams: Promise<{ org?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await getSession();
  if (!session) {
    return (
      <main className="container flex min-h-screen flex-col items-center justify-center gap-6 py-16">
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-[4rem]">
          Aires <span className="text-primary">Headless CRM</span>
        </h1>
        <p className="text-muted-foreground max-w-xl text-center text-lg">
          Agent-first CRM control plane. Sign in to access contacts, audit logs,
          webhooks, and agent tokens for your organization.
        </p>
        <AuthShowcase />
      </main>
    );
  }

  const params = await searchParams;
  const orgIds = await getAccessibleOrganizationIds();

  if (orgIds.length === 0) {
    return (
      <main className="container flex min-h-screen flex-col items-center justify-center gap-6 py-16">
        <h1 className="text-4xl font-bold">No organizations</h1>
        <p className="text-muted-foreground max-w-xl text-center">
          Your account is not a member of any organization yet. Ask an
          administrator to invite you, or create one via the API.
        </p>
        <AuthShowcase />
      </main>
    );
  }

  const selectedOrgId =
    params.org && orgIds.includes(params.org) ? params.org : orgIds[0];

  if (!selectedOrgId) redirect("/");

  const orgSuffix = `?org=${selectedOrgId}`;

  return (
    <main className="container py-16">
      <div className="mb-12 flex flex-col gap-2">
        <p className="text-muted-foreground text-sm">
          Signed in as {session.user.email}
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight">
          Aires Headless CRM
        </h1>
        <p className="text-muted-foreground">
          Organization <code className="bg-muted rounded px-1">{selectedOrgId}</code>
          {orgIds.length > 1 ? ` · ${orgIds.length} orgs available` : null}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <DashboardCard
          title="Contacts"
          description="Browse and create contacts within this organization."
          href={`/contacts${orgSuffix}`}
        />
        <DashboardCard
          title="Audit log"
          description="Every agent and user action that has touched this org."
          href={`/audit${orgSuffix}`}
        />
        <DashboardCard
          title="Webhooks"
          description="Event subscriptions, delivery status, and secrets."
          href={`/webhooks${orgSuffix}`}
        />
      </div>

      <div className="mt-12">
        <AuthShowcase />
      </div>
    </main>
  );
}

function DashboardCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <div className="border-border bg-card flex flex-col justify-between rounded-lg border p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-muted-foreground mt-2 text-sm">{description}</p>
      </div>
      <Button asChild className="mt-6 self-start" variant="outline">
        <Link href={href}>Open</Link>
      </Button>
    </div>
  );
}
