"use client";

import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";

import { CreateContactSchema } from "@acme/db/schema";
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

export function CreateContactForm({ organizationId }: { organizationId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const createContact = useMutation(
    trpc.contact.create.mutationOptions({
      onSuccess: async () => {
        form.reset();
        setOpen(false);
        await queryClient.invalidateQueries(trpc.contact.pathFilter());
        toast.success("Contact created");
      },
      onError: (err) => {
        toast.error(err.message || "Failed to create contact");
      },
    }),
  );

  const form = useForm({
    defaultValues: {
      organizationId,
      email: "",
      phone: "",
      firstName: "",
      lastName: "",
      source: "manual",
      status: "new",
    },
    validators: {
      onSubmit: CreateContactSchema,
    },
    onSubmit: (data) => createContact.mutate(data.value),
  });

  if (!open) {
    return <Button onClick={() => setOpen(true)}>+ New contact</Button>;
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
        {(["firstName", "lastName", "email", "phone"] as const).map((name) => (
          <form.Field
            key={name}
            name={name}
            children={(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldContent>
                    <FieldLabel htmlFor={field.name}>{name}</FieldLabel>
                  </FieldContent>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={isInvalid}
                    placeholder={name}
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          />
        ))}
      </FieldGroup>
      <div className="mt-4 flex gap-2">
        <Button type="submit" disabled={createContact.isPending}>
          {createContact.isPending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function ContactList({ organizationId }: { organizationId: string }) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.contact.list.queryOptions({ organizationId, limit: 25 }),
  );

  if (data.items.length === 0) {
    return (
      <div className="bg-muted/30 rounded-lg border p-8 text-center">
        <p className="text-muted-foreground">No contacts yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Phone</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((c) => (
            <tr key={c.id} className="border-t">
              <td className="px-4 py-3">
                {[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}
              </td>
              <td className="px-4 py-3">{c.email ?? "—"}</td>
              <td className="px-4 py-3">{c.phone ?? "—"}</td>
              <td className="px-4 py-3">
                <span className="bg-primary/10 text-primary rounded px-2 py-0.5 text-xs uppercase">
                  {c.status}
                </span>
              </td>
              <td className="text-muted-foreground px-4 py-3 text-xs">
                {new Date(c.createdAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ContactListSkeleton() {
  return (
    <div className="bg-muted/30 h-64 animate-pulse rounded-lg border" />
  );
}
