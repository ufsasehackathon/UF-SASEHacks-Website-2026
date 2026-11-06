/** Card + page shell matching the portal/admin look, shared by /staff and /judge */
export function Card({ title, subtitle, children }: { title?: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#560700] to-[#ff9b5e] opacity-10 blur-xl"></div>
      <div className="relative backdrop-blur-xl bg-white/95 rounded-3xl shadow-xl border border-[#FFE4B3]/30 p-6">
        {title && <h2 className="font-[family-name:var(--font-heading)] text-2xl text-[#560700] mb-1">{title}</h2>}
        {subtitle && <p className="font-[family-name:var(--font-body)] text-sm text-gray-600 mb-4">{subtitle}</p>}
        {!subtitle && title && <div className="mb-3" />}
        {children}
      </div>
    </div>
  );
}

export function PageShell({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FFE4B3] relative overflow-hidden">
      <div className="absolute top-20 right-10 w-64 h-64 bg-[#ebb8ce] opacity-30 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 left-10 w-80 h-80 bg-[#ebb8ce] opacity-20 rounded-full blur-3xl"></div>
      <div className="relative z-10 mx-auto max-w-screen-xl px-4 py-10">
        <div className="mb-8 pt-18">
          <h1 className="font-[family-name:var(--font-heading)] text-5xl md:text-6xl text-[#560700]">{title}</h1>
          {subtitle && <div className="font-[family-name:var(--font-body)] text-lg text-[#560700]/70 mt-2">{subtitle}</div>}
        </div>
        <div className="space-y-6">{children}</div>
      </div>
    </div>
  );
}

export function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/90 shadow border border-[#FFE4B3]/30 p-4">
      <p className="font-[family-name:var(--font-body)] text-xs text-gray-600 mb-1">{label}</p>
      <p className="font-[family-name:var(--font-heading)] text-3xl text-[#560700]">{value}</p>
    </div>
  );
}
