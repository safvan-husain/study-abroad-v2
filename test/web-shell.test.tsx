import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "../apps/web/app/page";

describe("web shell", () => {
  it("renders the desktop advisor workspace and separate task region", () => {
    const markup = renderToStaticMarkup(<Home />);
    expect(markup).toContain("Study planning workspace");
    expect(markup).toContain("Study advisor");
    expect(markup).toContain("Shape the study plan");
  });
});
