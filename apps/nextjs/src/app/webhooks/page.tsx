import { Suspense } from "react";

import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { getSelectedOrganizationId } from "../_lib/organization";
import {
  CreateSubscriptionForm,
  SubscriptionList,
  SubscriptionListSkeleton,
} from "./_components/subscriptions";

interface WebhooksPageProps {
  searchParams: Promise<{ org?: string }>;
}

export default async function WebhooksPage({ searchParams }: WebhooksPageProps) {
  const params = await searchParams;
  const organizationId = await getSelectedOrganizationId(params.org);

  if (!organizationId) {
    return (
      <main className="container py-16">
        <h1 className="text-3xl font-bold">Webhook Subscriptions</h1>
        <p className="text-muted-foreground mt-4">
          No accessible organization was found for this account.
        </p>
      </main>
    );
  }

  prefetch(trpc.subscription.list.queryOptions({ organizationId }));

  return (
    <HydrateClient>
      <main className="container py-16">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Webhook Subscriptions</h1>
            <p className="text-muted-foreground text-sm">
              Org <code>{organizationId}</code> — events fan out to these URLs.
            </p>
          </div>
          <CreateSubscriptionForm organizationId={organizationId} />
        </div>

        <Suspense fallback={<SubscriptionListSkeleton />}>
          <SubscriptionList organizationId={organizationId} />
        </Suspense>
      </main>
    </HydrateClient>
  );
}
