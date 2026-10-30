"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { AdminRow } from "@/app/admin/actions";
import { setStatus, setEditingLock, getSignedResumeLinks, deleteProfiles } from "@/app/admin/actions";
import { registrationStatusLabels, type RegistrationStatus } from "@/lib/validation";

export default function AdminTable({ rows }: { rows: AdminRow[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const allChecked = selected.length > 0 && selected.length === rows.length;

  const onToggleAll = (checked: boolean) => {
    setSelected(checked ? rows.map(r => r.user_id) : []);
  };
  const onToggle = (uid: string, checked: boolean) => {
    setSelected(prev => checked ? [...new Set([...prev, uid])] : prev.filter(id => id !== uid));
  };

  const selectedCount = selected.length;

  function run<T>(fn: () => Promise<T>) {
    setMessage(null);
    startTransition(async () => {
      try {
        await fn();
        setMessage("Done.");
      } catch {
        setMessage("Action failed.");
      }
    });
  }

  return (
    <div className="rounded-xl border overflow-x-auto">
      <div className="p-3 border-b bg-gray-50 flex items-center gap-2">
        <input type="checkbox" checked={allChecked} onChange={(e) => onToggleAll(e.target.checked)} />
        <span className="text-sm">{selectedCount} selected</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            disabled={!selectedCount || busy}
            onClick={() => run(() => setStatus(selected, "accepted"))}
            className="rounded-md border px-3 py-1.5 text-sm bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Accept
          </button>
          <button
            disabled={!selectedCount || busy}
            onClick={() => run(() => setStatus(selected, "waitlist"))}
            className="rounded-md border px-3 py-1.5 text-sm bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Waitlist
          </button>
          <button
            disabled={!selectedCount || busy}
            onClick={() => run(() => setStatus(selected, "rejected"))}
            className="rounded-md border px-3 py-1.5 text-sm bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Reject
          </button>
          <span className="mx-2 h-5 w-px bg-gray-300" />
          <button
            disabled={!selectedCount || busy}
            onClick={() => run(() => setEditingLock(selected, true))}
            className="rounded-md border px-3 py-1.5 text-sm bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Lock
          </button>
          <button
            disabled={!selectedCount || busy}
            onClick={() => run(() => setEditingLock(selected, false))}
            className="rounded-md border px-3 py-1.5 text-sm bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Unlock
          </button>
          <span className="mx-2 h-5 w-px bg-gray-300" />
          <button
            disabled={!selectedCount || busy}
            onClick={() => run(async () => {
              const { ok, links } = await getSignedResumeLinks(selected);
              if (!ok || !links) { setMessage("No links."); return; }
              // open each in a new tab (or you could show a modal)
              links.forEach(l => { if (l.url) window.open(l.url, "_blank"); });
            })}
            className="rounded-md border px-3 py-1.5 text-sm bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Resume links
          </button>
          <span className="mx-2 h-5 w-px bg-gray-300" />
          <button
            disabled={!selectedCount || busy}
            onClick={() => {
              if (!confirm(`Are you sure you want to delete ${selectedCount} profile(s)? This cannot be undone.`)) return;
              run(async () => {
                const result = await deleteProfiles(selected);
                if (result.ok) {
                  setSelected([]);
                  setMessage("Profiles deleted successfully.");
                } else {
                  setMessage(`Error: ${result.error}`);
                }
              });
            }}
            className="rounded-md border px-3 py-1.5 text-sm bg-red-50 text-red-700 border-red-300 hover:bg-red-100 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      <table className="min-w-[1200px] w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr className="text-left">
            <th className="px-3 py-2"><input type="checkbox" checked={allChecked} onChange={(e) => onToggleAll(e.target.checked)} /></th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">School</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Score</th>
            <th className="px-3 py-2">Submitted</th>
            <th className="px-3 py-2">Discord</th>
            <th className="px-3 py-2">Emailed?</th>
            <th className="px-3 py-2">Locked?</th>
            <th className="px-3 py-2">Resume updated</th>
            <th className="px-3 py-2">User ID</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.user_id} className="border-b hover:bg-gray-50">
              <td className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={selected.includes(r.user_id)}
                  onChange={(e) => onToggle(r.user_id, e.target.checked)}
                />
              </td>
              <td className="px-3 py-2">
                {r.profiles?.first_name && r.profiles?.last_name
                  ? `${r.profiles.first_name} ${r.profiles.last_name}`
                  : r.profiles?.full_name ?? "-"}
              </td>
              <td className="px-3 py-2">{r.profiles?.email ?? "-"}</td>
              <td className="px-3 py-2">{r.profiles?.school ?? "-"}</td>
              <td className="px-3 py-2">
                {registrationStatusLabels[r.status as RegistrationStatus] ?? r.status}
                {r.status === "accepted" && r.rsvp_deadline && (
                  <span className="block text-xs text-gray-500">RSVP by {new Date(r.rsvp_deadline).toLocaleDateString()}</span>
                )}
              </td>
              <td className="px-3 py-2">{r.review_score ?? "-"}</td>
              <td className="px-3 py-2">{r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : "-"}</td>
              <td className="px-3 py-2">{r.profiles?.discord_username ?? "-"}</td>
              <td className="px-3 py-2">
                {r.status === "draft" ? "-" : r.last_emailed_status === r.status ? "Yes" : "Queued"}
              </td>
              <td className="px-3 py-2">{r.editing_locked ? "Yes" : "No"}</td>
              <td className="px-3 py-2">
                {r.resume_updated_at ? new Date(r.resume_updated_at).toLocaleString() : "-"}
              </td>
              <td className="px-3 py-2">
                <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{r.user_id.substring(0, 8)}...</code>
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`/admin/${r.user_id}`}
                  className="text-blue-600 hover:underline text-xs"
                >
                  View Details
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {message && (
        <div className="p-3 text-sm text-gray-700">{message}</div>
      )}
    </div>
  );
}
