import { Suspense } from "react";

import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { AuditLogTable, AuditLogTableSkeleton } from "./_components/audit";

interface AuditPageProps {
  searchParams: Promise<{ org?: string; result?: string; actor?: string }>;
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const params = await searchParams;
  const organizationId = params.org;

  if (!organizationId) {
    return (
      <main className="container py-16">
        <h1 className="text-3xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground mt-4">
          Pass <code>?org=&lt;uuid&gt;</code> to scope this page to your organization.
        </p>
      </main>
    );
  }

  const actorType = params.actor as "user" | "agent" | "system" | undefined;
  const result = params.result as "ok" | "error" | "denied" | undefined;

  prefetch(
    trpc.audit.list.queryOptions({
      organizationId,
      actorType,
      result,
      limit: 100,
    }),
  );

  return (
    <HydrateClient>
      <main className="container py-16">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Audit Log</h1>
          <p className="text-muted-foreground text-sm">
            Org <code>{organizationId}</code> — last 100 actions.
          </p>
        </div>

        <Suspense fallback={<AuditLogTableSkeleton />}>
          <AuditLogTable
            organizationId={organizationId}
            actorType={actorType}
            result={result}
          />
        </Suspense>
      </main>
    </HydrateClient>
  );
}
