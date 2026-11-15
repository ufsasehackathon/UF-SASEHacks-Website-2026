"use client";

import { useState } from "react";
import { MAX_RESUME_BYTES } from "@/lib/resume";

export default function ResumeUploader({
  action,
  disabled,
}: {
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  disabled?: boolean;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);

    const form = e.currentTarget;
    const input = form.querySelector<HTMLInputElement>('input[type="file"][name="resume"]');
    const file = input?.files?.[0];

    if (!file) {
      setMsg("Please choose a file.");
      return;
    }

    // Client-side guards (server validates again)
    if (file.type && file.type.toLowerCase() !== "application/pdf") {
      setMsg("Only PDF files are allowed.");
      return;
    }
    if (file.size > MAX_RESUME_BYTES) {
      setMsg("File too large (max 4 MB).");
      return;
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("resume", file);
      const res = await action(fd);
      if (!res.ok) setMsg(res.error ?? "Upload failed");
      else setMsg("Upload successful!");
    } catch {
      setMsg("Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border p-4 space-y-3">
      <div>
        <input
          type="file"
          name="resume"
          accept="application/pdf"
          disabled={disabled || busy}
          className="block w-full text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:text-sm file:bg-white hover:file:bg-gray-50"
        />
      </div>
      <button
        type="submit"
        disabled={disabled || busy}
        className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium border bg-black text-white border-black hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Uploading..." : "Upload / Replace"}
      </button>
      {msg && <div className="text-sm">{msg}</div>}
    </form>
  );
}
