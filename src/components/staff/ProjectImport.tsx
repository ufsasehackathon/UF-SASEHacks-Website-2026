"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importDevpostCsv } from "@/app/staff/judging/actions";

/** Upload Devpost's submissions export; new projects get table numbers, existing ones are updated */
export function ProjectImport() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setResult(null);
    setError(null);
    startTransition(async () => {
      const res = await importDevpostCsv(formData);
      if (!res.ok) {
        setError(res.error ?? "Import failed");
        return;
      }
      setResult(`Imported ${res.created ?? 0} new, ${res.updated ?? 0} updated, ${res.skippedDrafts ?? 0} drafts skipped.`);
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      className="space-y-3 rounded-3xl bg-white/90 px-5 py-4 font-[family-name:var(--font-body)] text-[#560700] shadow-2xl"
    >
      <p className="text-sm text-[#560700]/70">Devpost → Manage hackathon → Metrics → Export submissions (CSV)</p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          aria-label="Devpost CSV"
          required
          className="text-sm file:mr-3 file:rounded-lg file:border file:border-[#560700]/30 file:bg-white file:px-3 file:py-1 file:text-[#560700]"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-[#560700] px-4 py-1.5 text-sm text-[#FFE4B3] hover:bg-[#560700]/90 disabled:opacity-50"
        >
          Import CSV
        </button>
      </div>
      {result && <p className="text-sm">{result}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
