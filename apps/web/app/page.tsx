import { ArchitecturePreview } from "../components/landing/ArchitecturePreview";
import { StatusPanel } from "../components/shared/StatusPanel";
import { ChatPanel } from "../components/chat/ChatPanel";

function NavLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

function ButtonLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const base =
    "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full px-5 py-3 font-semibold";
  const styles =
    variant === "secondary"
      ? "ml-0 mt-2 bg-hairline-soft text-ink sm:ml-2 sm:mt-0"
      : "bg-blue text-white hover:bg-blue-active";

  return (
    <NavLink href={href} className={`${base} ${styles}`}>
      {children}
    </NavLink>
  );
}

export default function Home() {
  return (
    <div>
      <header className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
        <NavLink href="/" className="font-bold tracking-tight text-blue">
          study abroad / v2
        </NavLink>
        <nav className="hidden gap-6 text-sm text-body sm:flex">
          <NavLink href="#architecture">Architecture</NavLink>
          <NavLink href="#status">Status</NavLink>
        </nav>
        <ButtonLink href="#status">Explore shell</ButtonLink>
      </header>

      <main>
        <ChatPanel />
        <section className="bg-dark px-5 py-16 text-white sm:px-6 sm:py-24">
          <div className="mx-auto grid max-w-[1200px] items-center gap-9 sm:grid-cols-[1.05fr_0.95fr] sm:gap-16">
            <div>
              <span className="text-xs font-bold tracking-[0.12em] text-muted-soft">
                APPLICATION WORKSPACE · PHASE 3
              </span>
              <h1 className="my-5 max-w-[650px] text-[clamp(44px,7vw,80px)] font-normal leading-none tracking-[-0.055em]">
                Build with clarity. Observe every boundary.
              </h1>
              <p className="max-w-[540px] text-lg leading-relaxed text-muted-soft">
                A focused frontend shell for the Study Abroad architecture spike.
                The browser stays intentionally separate from coordination and graph
                execution.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <ButtonLink href="#architecture">See the boundary</ButtonLink>
                <ButtonLink href="#status" variant="secondary">
                  Check status
                </ButtonLink>
              </div>
            </div>
            <ArchitecturePreview />
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] px-5 py-16 sm:px-6 sm:py-24" id="architecture">
          <span className="text-xs font-bold tracking-[0.12em] text-blue">
            A SMALL, VERIFIABLE START
          </span>
          <h2 className="my-4 text-[clamp(32px,5vw,52px)] font-normal tracking-[-0.04em]">
            Ready for the first conversation.
          </h2>
          <p className="max-w-[540px] text-lg leading-relaxed text-body">
            This shell establishes feature-oriented UI, centralized visual tokens,
            and explicit process ownership without pulling future chat or domain work
            forward.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-3" id="status">
            <StatusPanel
              label="Web"
              status="ready"
              detail="Next.js renders the browser surface and owns no agent execution."
            />
            <StatusPanel
              label="API"
              status="ready"
              detail="NestJS provides the browser-facing health and coordinator boundary."
            />
            <StatusPanel
              label="Agent runtime"
              status="pending"
              detail="Python Agent Server remains an independent HTTP process."
            />
          </div>
        </section>
      </main>
    </div>
  );
}
