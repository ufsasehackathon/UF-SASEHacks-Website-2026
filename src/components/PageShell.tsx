/** Page shell matching the portal look, shared by the /staff and /judge placeholders */
export function PageShell({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FFE4B3] relative overflow-hidden">
      <div className="absolute top-20 right-10 w-64 h-64 bg-[#ebb8ce] opacity-30 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 left-10 w-80 h-80 bg-[#ebb8ce] opacity-20 rounded-full blur-3xl"></div>
      <div className="relative z-10 mx-auto max-w-screen-xl px-4 py-10">
        <div className="mb-8 pt-18">
          <h1 className="font-[family-name:var(--font-heading)] text-5xl md:text-6xl text-[#560700]">{title}</h1>
          {subtitle && <div className="font-[family-name:var(--font-body)] text-lg text-[#560700]/70 mt-2">{subtitle}</div>}
        </div>
        {children && <div className="space-y-6">{children}</div>}
      </div>
    </div>
  );
}
