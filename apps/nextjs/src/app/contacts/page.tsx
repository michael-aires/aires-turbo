import { Suspense } from "react";

import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { ContactList, ContactListSkeleton, CreateContactForm } from "./_components/contacts";

interface ContactsPageProps {
  searchParams: Promise<{ org?: string }>;
}

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const params = await searchParams;
  const organizationId = params.org;

  if (!organizationId) {
    return (
      <main className="container py-16">
        <h1 className="text-3xl font-bold">Contacts</h1>
        <p className="text-muted-foreground mt-4">
          Pass <code>?org=&lt;uuid&gt;</code> to scope this page to your organization.
        </p>
      </main>
    );
  }

  prefetch(
    trpc.contact.list.queryOptions({ organizationId, limit: 25 }),
  );

  return (
    <HydrateClient>
      <main className="container py-16">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Contacts</h1>
            <p className="text-muted-foreground text-sm">
              Org <code>{organizationId}</code>
            </p>
          </div>
          <CreateContactForm organizationId={organizationId} />
        </div>

        <Suspense fallback={<ContactListSkeleton />}>
          <ContactList organizationId={organizationId} />
        </Suspense>
      </main>
    </HydrateClient>
  );
}
