function PreviewRow({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-[#282b31] py-4 text-muted-soft">
      <span>{name}</span>
      <strong className="font-mono font-medium text-white">{value}</strong>
    </div>
  );
}

export function ArchitecturePreview() {
  return (
    <div
      className="rounded-3xl border border-[#282b31] bg-dark-card p-8"
      aria-label="Architecture preview"
    >
      <span className="text-xs font-bold tracking-[0.12em] text-muted-soft">
        LIVE BOUNDARY
      </span>
      <PreviewRow name="Web shell" value="Next.js" />
      <PreviewRow name="Request API" value="NestJS" />
      <PreviewRow name="Agent execution" value="HTTP-only" />
    </div>
  );
}
