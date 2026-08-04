import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "../apps/web/app/page";
import { WorkspaceWorkProgress } from "../apps/web/components/workspace/WorkspaceWorkProgress";
import { workspaceTargetIsAvailable } from "../apps/web/lib/ui-targets";

describe("web shell", () => {
  it("renders the desktop advisor workspace and separate task region", () => {
    const markup = renderToStaticMarkup(<Home />);
    expect(markup).toContain("Study planning workspace");
    expect(markup).toContain("Study advisor");
    expect(markup).toContain("Shape the study plan");
  });

  it("rejects a restored workspace target after its work set has expired", () => {
    expect(workspaceTargetIsAvailable(
      { schemaVersion: 1, viewType: "family", workSetId: "expired-work-set", entityId: "computer-science" },
      ["current-work-set"],
    )).toBe(false);
    expect(workspaceTargetIsAvailable({ schemaVersion: 1, viewType: "home" }, [])).toBe(true);
  });

  it("groups an area-wide offering result by course type", () => {
    const markup = renderToStaticMarkup(<WorkspaceWorkProgress
      workSets={[{ workSetId: "area-results", kind: "catalog", status: "completed" } as never]}
      items={[
        { workSetId: "area-results", workItemId: "cs", entityId: "cs-1", kind: "program_offering", displayTitle: "Computer Science", status: "completed" },
        { workSetId: "area-results", workItemId: "systems", entityId: "systems-1", kind: "program_offering", displayTitle: "Computer Systems", status: "completed" },
      ] as never[]}
      results={[
        { workItemId: "cs", resultJson: JSON.stringify({ familyId: "computer-science", name: "Computer Science" }) },
        { workItemId: "systems", resultJson: JSON.stringify({ familyId: "computer-systems", name: "Computer Systems" }) },
      ] as never[]}
      workSetId="area-results"
      catalogFamilies={[
        { familyId: "computer-science", name: "Computer Science" },
        { familyId: "computer-systems", name: "Computer Systems" },
      ] as never[]}
    />);
    expect(markup.match(/class="offering-family-group"/g)).toHaveLength(2);
    expect(markup).toContain('id="offering-family-computer-science"');
    expect(markup).toContain('id="offering-family-computer-systems"');
  });
});
