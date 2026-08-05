import Link from 'next/link';
import { HOME_UI_TARGET, type UiTargetRef } from '@study-abroad/contracts';
import type { AdvisorCatalogCourse, AdvisorCatalogFamily, AdvisorDirective, AdvisorDocumentRequirement, AdvisorDocumentSubmission, AdvisorProfile, AdvisorSelection, AdvisorWorkItem, AdvisorWorkResult, AdvisorWorkSet } from '../../hooks/useAdvisorWorkspace';
import { targetBreadcrumb } from '../../lib/ui-targets';
import { WorkspaceWorkProgress } from './WorkspaceWorkProgress';

export function WorkspaceView({
  directive,
  workSets,
  workItems,
  workResults,
  profile,
  catalogCourses = [],
  catalogFamilies = [],
  selection,
  documentRequirements = [],
  documentSubmissions = [],
  target = HOME_UI_TARGET,
  setScrollElement = () => undefined,
  onScroll = () => undefined,
  onSelectOffering = () => undefined,
  onSelectFamily = () => undefined,
  onUploadDocument = async () => undefined,
}: {
  directive?: AdvisorDirective;
  workSets: AdvisorWorkSet[];
  workItems: AdvisorWorkItem[];
  workResults: AdvisorWorkResult[];
  profile?: AdvisorProfile;
  catalogCourses?: AdvisorCatalogCourse[];
  catalogFamilies?: AdvisorCatalogFamily[];
  selection?: AdvisorSelection;
  documentRequirements?: AdvisorDocumentRequirement[];
  documentSubmissions?: AdvisorDocumentSubmission[];
  target: UiTargetRef;
  setScrollElement: (element: HTMLDivElement | null) => void;
  onScroll: () => void;
  onSelectOffering?: (offeringId: string) => void;
  onSelectFamily?: (familyId: string) => void;
  onUploadDocument?: (documentType: string, file: File) => Promise<void>;
}) {
  const exploring = target.viewType !== 'home';
  const hasShortlist = Boolean(selection?.provisionalOfferingIds.length);
  const hasDocuments = Boolean(selection?.confirmedOfferingIds.length);
  return (
    <main className="task-pane" aria-label="Study planning workspace">
      <header className="workspace-header">
        <Link href="/" className="brand" aria-label="Study Abroad home"><span>SA</span> Study Abroad</Link>
        <div className="journey-state"><span /> Guest journey saved</div>
      </header>
      <div className="workspace-scroll" ref={setScrollElement} onScroll={onScroll}>
        <div className="breadcrumb">YOUR JOURNEY <b>/</b> {targetBreadcrumb(target)}</div>
        <section className="workspace-intro">
          <span className="eyebrow">STUDENT WORKSPACE</span>
          <h1>Explore courses that fit your story.</h1>
          <p>
            {profile?.studentPhrase
              ? `Partner courses related to ${profile.studentPhrase} collect here, away from the conversation.`
              : 'Useful matches and comparisons stay organized here while you talk with your advisor.'}
          </p>
          <div className="journey-progress" aria-label="Journey progress">
            <div className={!hasShortlist && !hasDocuments ? 'active' : undefined}><span>01</span><b>Explore</b><i /></div>
            <div className={hasShortlist && !hasDocuments ? 'active' : undefined}><span>02</span><b>Shortlist</b><i /></div>
            <div className={hasDocuments ? 'active' : undefined}><span>03</span><b>Documents</b></div>
          </div>
        </section>
        {exploring && directive ? (
          <section className="workspace-awareness">
            <span className="awareness-mark" aria-hidden="true">✦</span>
            <div><span className="eyebrow">CURRENT FOCUS</span><p>{directive.awareness}</p></div>
          </section>
        ) : !exploring ? (
          <section className="empty-workspace">
            <span aria-hidden="true">↗</span>
            <div><h3>Ready to explore</h3><p>Tell the advisor about your background and interests. Course matches will appear here.</p></div>
          </section>
        ) : null}
        {exploring ? <WorkspaceWorkProgress workSets={workSets} items={workItems} results={workResults} workSetId={target.workSetId} selectedEntityId={target.entityId} catalogCourses={catalogCourses} catalogFamilies={catalogFamilies} selection={selection} onSelectOffering={onSelectOffering} onSelectFamily={onSelectFamily} /> : null}
        {selection?.confirmedOfferingIds.length ? (
          <section className="documents-workspace" aria-labelledby="documents-title">
            <div className="section-heading"><div><span className="eyebrow">CONFIRMED DOCUMENT CONTRACT</span><h3 id="documents-title">Collect your documents</h3></div><span>{documentRequirements.filter((row) => row.status === 'submitted').length}/{documentRequirements.length} uploaded</span></div>
            <p>This release collects files only. It does not review documents, decide eligibility, or make an admissions claim. Uploads expire after seven days.</p>
            <div className="document-grid">{documentRequirements.map((requirement) => {
              const submission = documentSubmissions.find((row) => row.snapshotId === requirement.snapshotId && row.documentType === requirement.documentType);
              return <article key={requirement.requirementKey}><div><strong>{requirement.label}</strong><span className={`document-status status-${requirement.status}`}>{requirement.status}</span></div><p>{requirement.reason}</p>{submission ? <small>{submission.originalName} · {(Number(submission.byteSize) / 1024 / 1024).toFixed(1)} MB</small> : <label className="upload-control">Upload JPEG, PNG, WebP, or PDF<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onUploadDocument(requirement.documentType, file); }} /></label>}</article>;
            })}</div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
