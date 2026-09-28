"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useInstruments, useMutationRpc } from "@/lib/api/rpc-hooks";
import type { RpcEnvelope } from "@/lib/api/rpc-types";
import { cn } from "@/lib/utils/cn";

const ADD_NEW = "__add_new__";

type AddInstrumentRes = RpcEnvelope & { instrument?: { id: string; name: string } };

/**
 * Teacher instrument picker — a dropdown fed by the shared, growable
 * `instrument_options` list, with an inline "Add new instrument" row so
 * founder/staff never have to leave the form to extend the list.
 */
export function InstrumentSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (name: string) => void;
  className?: string;
}) {
  const instruments = useInstruments();
  const [adding, setAdding] = React.useState(false);
  const [newName, setNewName] = React.useState("");

  const addInstrument = useMutationRpc<{ name: string }, AddInstrumentRes>("api_addInstrument", {
    invalidate: [["rpc", "api_listInstruments"]],
    onSuccess: (res) => {
      const name = res.instrument?.name ?? newName.trim();
      onChange(name);
      setAdding(false);
      setNewName("");
      toast.success(`Added "${name}" to the instrument list.`);
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not add instrument."),
  });

  const options = instruments.data?.instruments ?? [];
  // Older records may hold a value that predates this list — keep it selectable.
  const hasCurrent = !value || options.some((o) => o.name === value);

  if (adding) {
    return (
      <div className={cn("flex gap-2", className)}>
        <Input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New instrument name"
          className="border-dash-fg/10 bg-dash-surface text-dash-fg placeholder:text-dash-fg/35"
          onKeyDown={(e) => {
            if (e.key === "Enter" && newName.trim()) addInstrument.mutate({ name: newName.trim() });
            if (e.key === "Escape") setAdding(false);
          }}
        />
        <Button
          type="button"
          disabled={!newName.trim() || addInstrument.isPending}
          onClick={() => addInstrument.mutate({ name: newName.trim() })}
        >
          Add
        </Button>
        <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === ADD_NEW) {
          setAdding(true);
          return;
        }
        onChange(e.target.value);
      }}
      className={cn(
        "h-9 w-full rounded-md border border-dash-fg/10 bg-dash-surface px-3 text-sm text-dash-fg outline-none focus-visible:ring-1 focus-visible:ring-dash-accent",
        className,
      )}
    >
      <option value="" disabled>
        {instruments.isLoading ? "Loading…" : "Select an instrument"}
      </option>
      {!hasCurrent && (
        <option value={value} disabled>
          {value}
        </option>
      )}
      {options.map((o) => (
        <option key={o.id} value={o.name}>
          {o.name}
        </option>
      ))}
      <option value={ADD_NEW}>+ Add new instrument…</option>
    </select>
  );
}
