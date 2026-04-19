"use client";

import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { z } from "zod/v4";

import { Button } from "@acme/ui/button";
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@acme/ui/field";
import { Input } from "@acme/ui/input";
import { toast } from "@acme/ui/toast";

import { useTRPC } from "~/trpc/react";

const CreateSchema = z.object({
  organizationId: z.string().uuid(),
  url: z.string().url(),
  secret: z.string().min(16, "secret must be at least 16 chars"),
  description: z.string().max(256).optional(),
  eventTypes: z.array(z.string()).default(["*"]),
});

const CANONICAL_EVENTS = [
  "contact.created",
  "activity.logged",
  "email.sent",
  "approval.requested",
  "agent.run.completed",
] as const;

export function CreateSubscriptionForm({
  organizationId,
}: {
  organizationId: string;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const create = useMutation(
    trpc.subscription.create.mutationOptions({
      onSuccess: async () => {
        form.reset();
        setOpen(false);
        await queryClient.invalidateQueries(trpc.subscription.pathFilter());
        toast.success("Subscription created");
      },
      onError: (err) => toast.error(err.message || "Failed to create"),
    }),
  );

  const form = useForm({
    defaultValues: {
      organizationId,
      url: "",
      secret: "",
      description: "",
      eventTypes: ["*"] as string[],
    },
    validators: { onSubmit: CreateSchema },
    onSubmit: (data) => create.mutate(data.value),
  });

  if (!open) {
    return <Button onClick={() => setOpen(true)}>+ New webhook</Button>;
  }

  return (
    <form
      className="bg-muted/40 w-full max-w-md rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field
          name="url"
          children={(field) => (
            <Field
              data-invalid={
                field.state.meta.isTouched && !field.state.meta.isValid
              }
            >
              <FieldContent>
                <FieldLabel htmlFor={field.name}>Delivery URL</FieldLabel>
              </FieldContent>
              <Input
                id={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="https://example.com/hooks/aires"
              />
              <FieldError errors={field.state.meta.errors} />
            </Field>
          )}
        />
        <form.Field
          name="secret"
          children={(field) => (
            <Field>
              <FieldContent>
                <FieldLabel htmlFor={field.name}>
                  HMAC secret (shared, ≥16 chars)
                </FieldLabel>
              </FieldContent>
              <Input
                id={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="whsec_…"
              />
              <FieldError errors={field.state.meta.errors} />
            </Field>
          )}
        />
        <form.Field
          name="description"
          children={(field) => (
            <Field>
              <FieldContent>
                <FieldLabel htmlFor={field.name}>Description</FieldLabel>
              </FieldContent>
              <Input
                id={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="internal zapier bridge"
              />
            </Field>
          )}
        />
        <form.Field
          name="eventTypes"
          children={(field) => (
            <Field>
              <FieldContent>
                <FieldLabel>Events</FieldLabel>
              </FieldContent>
              <div className="flex flex-wrap gap-2">
                {(["*", ...CANONICAL_EVENTS] as const).map((evt) => {
                  const selected = field.state.value.includes(evt);
                  return (
                    <button
                      type="button"
                      key={evt}
                      onClick={() => {
                        if (selected) {
                          field.handleChange(
                            field.state.value.filter((e) => e !== evt),
                          );
                        } else {
                          field.handleChange([...field.state.value, evt]);
                        }
                      }}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {evt}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}
        />
      </FieldGroup>
      <div className="mt-4 flex gap-2">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function SubscriptionList({
  organizationId,
}: {
  organizationId: string;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: rows } = useSuspenseQuery(
    trpc.subscription.list.queryOptions({ organizationId }),
  );
  const toggle = useMutation(
    trpc.subscription.setActive.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.subscription.pathFilter());
      },
    }),
  );

  if (rows.length === 0) {
    return (
      <div className="bg-muted/30 rounded-lg border p-8 text-center">
        <p className="text-muted-foreground">No webhook subscriptions yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th className="px-4 py-3 font-medium">URL</th>
            <th className="px-4 py-3 font-medium">Events</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Created</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const eventTypes =
              (s.eventFilter as { eventTypes?: string[] } | null)?.eventTypes ??
              ["*"];
            return (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-3 font-mono text-xs">{s.url}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {eventTypes.map((e) => (
                      <span
                        key={e}
                        className="bg-muted rounded px-2 py-0.5 text-xs"
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-2 py-0.5 text-xs uppercase ${
                      s.active
                        ? "bg-green-500/10 text-green-700"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s.active ? "active" : "paused"}
                  </span>
                </td>
                <td className="text-muted-foreground px-4 py-3 text-xs">
                  {new Date(s.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      toggle.mutate({ id: s.id, active: !s.active })
                    }
                  >
                    {s.active ? "Pause" : "Resume"}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function SubscriptionListSkeleton() {
  return <div className="bg-muted/30 h-64 animate-pulse rounded-lg border" />;
}
