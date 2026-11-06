"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importDevpostCsv } from "@/app/staff/actions";

export default function DevpostImport() {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      className="font-[family-name:var(--font-body)] flex flex-col sm:flex-row sm:items-center gap-3"
      onSubmit={e => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setMsg(null);
        startTransition(async () => {
          const res = await importDevpostCsv(fd);
          if (res.ok) {
            setMsg(`Imported ${res.imported} project(s)${res.skipped ? `, skipped ${res.skipped} (drafts or missing title/URL)` : ""}.`);
            router.refresh();
          } else {
            setMsg(`Error: ${res.error}`);
          }
        });
      }}
    >
      <input type="file" name="file" accept=".csv,text/csv" required className="text-sm" />
      <button
        type="submit"
        disabled={busy}
        className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#560700] to-[#6b1003] shadow disabled:opacity-50"
      >
        {busy ? "Importing..." : "Import CSV"}
      </button>
      {msg && <span className="text-sm text-gray-700">{msg}</span>}
    </form>
  );
}
