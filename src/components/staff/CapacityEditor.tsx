"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCapacity } from "@/app/staff/checkin/actions";

/** Owner-only: edit the event capacity shown on the check-in counter (blank clears it) */
export function CapacityEditor({ capacity }: { capacity: number | null }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [value, setValue] = useState(capacity === null ? "" : String(capacity));
  const [error, setError] = useState<string | null>(null);

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = value.trim();
    startTransition(async () => {
      const res = await setCapacity(trimmed === "" ? null : Number(trimmed));
      if (!res.ok) {
        setError(res.error ?? "Couldn't save the capacity");
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="font-[family-name:var(--font-body)] text-[#560700]">
      <div className="flex items-center gap-2">
        <label htmlFor="capacity" className="text-sm">Capacity</label>
        <input
          id="capacity"
          type="number"
          min={1}
          step={1}
          value={value}
          onChange={e => setValue(e.target.value)}
          className="w-28 rounded-lg border border-[#560700]/30 bg-white px-3 py-1"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg border border-[#560700]/30 bg-white px-3 py-1 text-sm text-[#560700] hover:bg-[#560700]/10 disabled:opacity-50"
        >
          Save
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
    </form>
  );
}
