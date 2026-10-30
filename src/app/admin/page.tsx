import { fetchAdminRows, fetchStatusCounts } from "./actions";
import AdminTable from "@/components/admin/AdminTable";
import DownloadAllResumes from "@/components/admin/DownloadAllResumes";
import DecisionTools from "@/components/admin/DecisionTools";
import { EVENT_CAPACITY } from "@/lib/constants";
import { registrationStatuses, registrationStatusLabels } from "@/lib/validation";
import { getPublicImageUrl } from "@/lib/images";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const { q, status, sort } = sp ?? {};
  const [res, countsRes] = await Promise.all([fetchAdminRows({ q, status, sort }), fetchStatusCounts()]);

  const counts = countsRes.counts;
  const submittedCount = counts ? registrationStatuses.filter(st => st !== "draft").reduce((n, st) => n + counts[st], 0) : 0;
  // accepted spots are held until they RSVP or expire
  const spotsLeft = EVENT_CAPACITY - ((counts?.accepted ?? 0) + (counts?.confirmed ?? 0));

  const stats = [
    { label: "Drafts", value: counts?.draft ?? 0, tone: "from-gray-400 to-gray-600", text: "text-gray-600", num: "text-gray-900" },
    { label: "Submitted", value: submittedCount, tone: "from-gray-400 to-gray-600", text: "text-gray-600", num: "text-gray-900" },
    { label: "To review", value: counts?.pending ?? 0, tone: "from-blue-400 to-indigo-600", text: "text-blue-600", num: "text-blue-900" },
    { label: "Accepted (no RSVP)", value: counts?.accepted ?? 0, tone: "from-emerald-300 to-green-500", text: "text-green-600", num: "text-green-900" },
    { label: "Confirmed", value: counts?.confirmed ?? 0, tone: "from-green-400 to-emerald-600", text: "text-green-700", num: "text-green-900" },
    { label: "Waitlist", value: counts?.waitlist ?? 0, tone: "from-yellow-400 to-orange-600", text: "text-yellow-600", num: "text-yellow-900" },
    { label: "Declined", value: counts?.declined ?? 0, tone: "from-gray-400 to-gray-600", text: "text-gray-600", num: "text-gray-900" },
    { label: "Rejected", value: counts?.rejected ?? 0, tone: "from-red-400 to-rose-600", text: "text-red-600", num: "text-red-900" },
    { label: `Spots left (of ${EVENT_CAPACITY})`, value: spotsLeft, tone: "from-[#560700] to-[#ff9b5e]", text: "text-[#560700]", num: "text-[#560700]" },
  ];

  return (
    <div className="min-h-screen bg-[#FFE4B3] relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-20 right-10 w-64 h-64 bg-[#ebb8ce] opacity-30 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 left-10 w-80 h-80 bg-[#ebb8ce] opacity-20 rounded-full blur-3xl"></div>

      {/* Shark mascot decoration */}
      <div className="absolute bottom-0 left-0 opacity-5 pointer-events-none">
        <Image
          src={getPublicImageUrl("shark-mascot.png")}
          alt="Shark mascot"
          width={300}
          height={300}
          className="object-contain"
        />
      </div>

      <div className="relative z-10 mx-auto max-w-screen-xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-heading)] text-5xl md:text-6xl text-[#560700]">
            Admin Console
          </h1>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          {stats.map(st => (
            <div key={st.label} className="relative">
              <div className={`absolute -inset-0.5 rounded-2xl bg-gradient-to-r ${st.tone} opacity-20 blur`}></div>
              <div className="relative backdrop-blur-xl bg-white/90 rounded-2xl shadow-lg border border-[#FFE4B3]/30 p-4">
                <p className={`font-[family-name:var(--font-body)] text-xs ${st.text} mb-1`}>{st.label}</p>
                <p className={`font-[family-name:var(--font-heading)] text-3xl ${st.num}`}>{st.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Decisions: RSVP expiry, waitlist promotion, email queue */}
        <div className="relative mb-6">
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#560700] to-[#ff9b5e] opacity-10 blur-xl"></div>
          <div className="relative backdrop-blur-xl bg-white/95 rounded-3xl shadow-xl border border-[#FFE4B3]/30 p-6">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl text-[#560700] mb-1">Decisions</h2>
            <p className="font-[family-name:var(--font-body)] text-sm text-gray-600 mb-4">
              Status changes don&apos;t email anyone until you click &ldquo;Send pending emails&rdquo;.
            </p>
            <DecisionTools unsentEmails={countsRes.unsentEmails ?? 0} spotsLeft={spotsLeft} />
          </div>
        </div>

        {/* Search and Filters */}
        <div className="relative mb-6">
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#560700] to-[#ff9b5e] opacity-10 blur-xl"></div>
          <div className="relative backdrop-blur-xl bg-white/95 rounded-3xl shadow-xl border border-[#FFE4B3]/30 p-6">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl text-[#560700] mb-4">Search & Filter</h2>
            <form className="flex flex-col sm:flex-row gap-3">
              <input
                name="q"
                placeholder="Search name or email..."
                defaultValue={q ?? ""}
                className="flex-1 font-[family-name:var(--font-body)] rounded-xl border-2 border-gray-300 px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#ff9b5e] focus:border-transparent hover:border-gray-400"
              />
              <select
                name="status"
                defaultValue={status ?? ""}
                className="font-[family-name:var(--font-body)] rounded-xl border-2 border-gray-300 px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#ff9b5e] focus:border-transparent hover:border-gray-400"
              >
                <option value="">All statuses</option>
                {registrationStatuses.map(st => (
                  <option key={st} value={st}>{registrationStatusLabels[st]}</option>
                ))}
              </select>
              <select
                name="sort"
                defaultValue={sort ?? ""}
                className="font-[family-name:var(--font-body)] rounded-xl border-2 border-gray-300 px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#ff9b5e] focus:border-transparent hover:border-gray-400"
              >
                <option value="">Newest accounts</option>
                <option value="submitted">Submission order</option>
                <option value="score">Highest score</option>
              </select>
              <button className="font-[family-name:var(--font-body)] font-semibold rounded-xl px-6 py-3 text-sm text-white bg-gradient-to-r from-[#560700] to-[#6b1003] hover:from-[#6b1003] hover:to-[#560700] transition-all shadow-lg hover:shadow-xl">
                Apply Filters
              </button>
            </form>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <a
            href="/api/export"
            className="inline-flex items-center gap-2 font-[family-name:var(--font-body)] font-semibold rounded-xl px-6 py-3 text-sm text-white bg-gradient-to-r from-[#ff9b5e] to-[#ff7f3e] hover:from-[#ff7f3e] hover:to-[#ff9b5e] transition-all shadow-lg hover:shadow-xl"
            target="_blank"
            rel="noreferrer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </a>
          <DownloadAllResumes />
        </div>

        {/* Results Table */}
        <div className="relative">
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#560700] to-[#ff9b5e] opacity-10 blur-xl"></div>
          <div className="relative backdrop-blur-xl bg-white/95 rounded-3xl shadow-xl border border-[#FFE4B3]/30 p-6">
            {res.ok ? (
              <AdminTable rows={res.rows ?? []} />
            ) : (
              <div className="rounded-xl bg-gradient-to-r from-red-100 to-rose-100 border-2 border-red-400 p-5 shadow-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="font-[family-name:var(--font-body)]">
                    <p className="font-semibold text-red-900">Error loading data</p>
                    <p className="text-sm text-red-700 mt-1">{res.error ?? "Failed to load registrations"}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
