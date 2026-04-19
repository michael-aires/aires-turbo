"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/react";

export function AuditLogTable({
  organizationId,
  actorType,
  result,
}: {
  organizationId: string;
  actorType?: "user" | "agent" | "system";
  result?: "ok" | "error" | "denied";
}) {
  const trpc = useTRPC();
  const { data: rows } = useSuspenseQuery(
    trpc.audit.list.queryOptions({
      organizationId,
      actorType,
      result,
      limit: 100,
    }),
  );

  if (rows.length === 0) {
    return (
      <div className="bg-muted/30 rounded-lg border p-8 text-center">
        <p className="text-muted-foreground">No audit records match these filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th className="px-4 py-3 font-medium">Time</th>
            <th className="px-4 py-3 font-medium">Actor</th>
            <th className="px-4 py-3 font-medium">Tool</th>
            <th className="px-4 py-3 font-medium">Action</th>
            <th className="px-4 py-3 font-medium">Result</th>
            <th className="px-4 py-3 font-medium">ms</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="text-muted-foreground px-4 py-3 text-xs">
                {new Date(r.createdAt).toLocaleString()}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded px-2 py-0.5 text-xs uppercase ${
                    r.actorType === "agent"
                      ? "bg-blue-500/10 text-blue-700"
                      : r.actorType === "user"
                        ? "bg-purple-500/10 text-purple-700"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {r.actorType}
                </span>
                <div className="text-muted-foreground font-mono text-xs">
                  {r.actorId.slice(0, 8)}…
                </div>
              </td>
              <td className="px-4 py-3 font-mono text-xs">{r.tool ?? "—"}</td>
              <td className="px-4 py-3">{r.action}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded px-2 py-0.5 text-xs uppercase ${
                    r.result === "ok"
                      ? "bg-green-500/10 text-green-700"
                      : r.result === "denied"
                        ? "bg-orange-500/10 text-orange-700"
                        : "bg-red-500/10 text-red-700"
                  }`}
                >
                  {r.result}
                </span>
              </td>
              <td className="text-muted-foreground px-4 py-3 text-xs">
                {r.durationMs ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AuditLogTableSkeleton() {
  return <div className="bg-muted/30 h-96 animate-pulse rounded-lg border" />;
}
