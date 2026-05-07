export default function DashboardLoading() {
  return (
    <div className="grid gap-6">
      <div className="h-28 animate-pulse rounded-[28px] border border-cyan-200/15 bg-cyan-300/10 shadow-[0_0_80px_rgba(34,211,238,0.12)]" />
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="h-[420px] animate-pulse rounded-[28px] border border-white/10 bg-white/[0.05]" />
        <div className="h-[420px] animate-pulse rounded-[28px] border border-cyan-200/15 bg-cyan-300/10" />
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-[360px] animate-pulse rounded-[28px] border border-white/10 bg-white/[0.05]" />
        ))}
      </div>
    </div>
  );
}
