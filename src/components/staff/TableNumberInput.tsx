"use client";

import { useState, useTransition } from "react";
import { setTableNumber } from "@/app/staff/actions";

/** Inline-editable table number; saves on blur */
export default function TableNumberInput({ projectId, initial }: { projectId: string; initial: string | null }) {
  const [value, setValue] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [busy, startTransition] = useTransition();
  const [err, setErr] = useState(false);

  return (
    <input
      value={value}
      disabled={busy}
      onChange={e => setValue(e.target.value)}
      onBlur={() => {
        if (value === saved) return;
        startTransition(async () => {
          const res = await setTableNumber(projectId, value);
          setErr(!res.ok);
          if (res.ok) setSaved(value);
        });
      }}
      placeholder="-"
      className={`w-16 rounded-md border px-2 py-1 text-sm ${err ? "border-red-500" : "border-gray-300"}`}
    />
  );
}
