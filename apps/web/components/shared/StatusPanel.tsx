type StatusPanelProps = {
  label: string;
  status: "ready" | "pending" | "error";
  detail: string;
};

export function StatusPanel({ label, status, detail }: StatusPanelProps) {
  return (
    <article className="rounded-3xl border border-line bg-white p-7">
      <span className="inline-flex rounded-full bg-hairline-soft px-3 py-1 text-xs font-bold">
        {status.toUpperCase()}
      </span>
      <h3 className="mt-4 text-lg font-semibold">{label}</h3>
      <p className="mt-2 leading-relaxed text-body">{detail}</p>
    </article>
  );
}
