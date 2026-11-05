"use client";

import { useState, useTransition } from "react";
import { APPLICATION_QUESTIONS } from "@/lib/validation";

type Props = {
  initialResponses: Record<string, string>;
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  disabled?: boolean;
};

/** Edit free-response answers after submitting (onboarding has its own copy of these fields) */
export default function ResponsesForm({ initialResponses, action, disabled }: Props) {
  const [responses, setResponses] = useState<Record<string, string>>(() =>
    Object.fromEntries(APPLICATION_QUESTIONS.map(q => [q.id, initialResponses[q.id] ?? ""]))
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, startTransition] = useTransition();

  if (!(APPLICATION_QUESTIONS.length > 0)) return null;

  function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData();
    Object.entries(responses).forEach(([k, v]) => fd.append(k, v));
    startTransition(async () => {
      const res = await action(fd);
      setMsg(res.ok ? "Saved!" : res.error ?? "Failed to save your answers");
    });
  }

  return (
    <form onSubmit={save} className="relative font-[family-name:var(--font-body)]">
      <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#560700] to-[#ff9b5e] opacity-10 blur-xl"></div>
      <div className="relative bg-white rounded-3xl shadow-xl border border-[#FFE4B3]/30 p-6 md:p-8 space-y-4">
        <h2 className="font-[family-name:var(--font-heading)] text-2xl md:text-3xl text-[#560700]">A Little About You</h2>

        {APPLICATION_QUESTIONS.map(q => (
          <label key={q.id} className="block">
            <span className="text-sm font-medium">
              {q.label} {q.required ? "*" : "(optional)"}
            </span>
            <textarea
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              rows={4}
              maxLength={q.maxLength}
              disabled={disabled}
              placeholder={q.placeholder}
              value={responses[q.id] ?? ""}
              onChange={(e) => setResponses(prev => ({ ...prev, [q.id]: e.target.value }))}
            />
            <p className="text-xs text-gray-500 mt-1 text-right">
              {(responses[q.id] ?? "").length}/{q.maxLength}
            </p>
          </label>
        ))}

        {!disabled && (
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl px-5 py-3 text-sm font-semibold text-white bg-gradient-to-r from-[#560700] to-[#6b1003] shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save answers"}
            </button>
            {msg && <span className="text-sm text-gray-700">{msg}</span>}
          </div>
        )}
      </div>
    </form>
  );
}
