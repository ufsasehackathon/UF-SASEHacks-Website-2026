import { fetchAdminRows } from "./actions";
import AdminTable from "@/components/admin/AdminTable";
import DownloadAllResumes from "@/components/admin/DownloadAllResumes";
import { getPublicImageUrl } from "@/lib/images";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const { q, status } = sp ?? {};
  const res = await fetchAdminRows({ q, status });

  const totalCount = res.rows?.length ?? 0;
  const pendingCount = res.rows?.filter(r => r.status === "pending").length ?? 0;
  const confirmedCount = res.rows?.filter(r => r.status === "confirmed").length ?? 0;
  const waitlistCount = res.rows?.filter(r => r.status === "waitlist").length ?? 0;
  const rejectedCount = res.rows?.filter(r => r.status === "rejected").length ?? 0;

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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="relative">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-gray-400 to-gray-600 opacity-20 blur"></div>
            <div className="relative backdrop-blur-xl bg-white/90 rounded-2xl shadow-lg border border-[#FFE4B3]/30 p-4">
              <p className="font-[family-name:var(--font-body)] text-xs text-gray-600 mb-1">Total</p>
              <p className="font-[family-name:var(--font-heading)] text-3xl text-gray-900">{totalCount}</p>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-blue-400 to-indigo-600 opacity-20 blur"></div>
            <div className="relative backdrop-blur-xl bg-white/90 rounded-2xl shadow-lg border border-[#FFE4B3]/30 p-4">
              <p className="font-[family-name:var(--font-body)] text-xs text-blue-600 mb-1">Pending</p>
              <p className="font-[family-name:var(--font-heading)] text-3xl text-blue-900">{pendingCount}</p>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-green-400 to-emerald-600 opacity-20 blur"></div>
            <div className="relative backdrop-blur-xl bg-white/90 rounded-2xl shadow-lg border border-[#FFE4B3]/30 p-4">
              <p className="font-[family-name:var(--font-body)] text-xs text-green-600 mb-1">Confirmed</p>
              <p className="font-[family-name:var(--font-heading)] text-3xl text-green-900">{confirmedCount}</p>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-600 opacity-20 blur"></div>
            <div className="relative backdrop-blur-xl bg-white/90 rounded-2xl shadow-lg border border-[#FFE4B3]/30 p-4">
              <p className="font-[family-name:var(--font-body)] text-xs text-yellow-600 mb-1">Waitlist</p>
              <p className="font-[family-name:var(--font-heading)] text-3xl text-yellow-900">{waitlistCount}</p>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-red-400 to-rose-600 opacity-20 blur"></div>
            <div className="relative backdrop-blur-xl bg-white/90 rounded-2xl shadow-lg border border-[#FFE4B3]/30 p-4">
              <p className="font-[family-name:var(--font-body)] text-xs text-red-600 mb-1">Rejected</p>
              <p className="font-[family-name:var(--font-heading)] text-3xl text-red-900">{rejectedCount}</p>
            </div>
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
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="waitlist">Waitlist</option>
                <option value="rejected">Rejected</option>
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
