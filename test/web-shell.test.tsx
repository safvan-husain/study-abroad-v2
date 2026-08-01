import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "../apps/web/app/page";
import { StatusPanel } from "../apps/web/components/shared/StatusPanel";

describe("web shell", () => { it("renders the architecture status surface", () => { const markup = renderToStaticMarkup(<Home />); expect(markup).toContain("APPLICATION WORKSPACE"); expect(markup).toContain("Next.js"); }); it("renders shared status", () => { expect(renderToStaticMarkup(<StatusPanel label="API" status="ready" detail="Healthy" />)).toContain("READY"); }); });
