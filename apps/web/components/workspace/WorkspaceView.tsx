import type { AdvisorDirective, AdvisorProfile, AdvisorWorkItem, AdvisorWorkResult, AdvisorWorkSet } from '../../hooks/useAdvisorWorkspace';
import { WorkspaceWorkProgress } from './WorkspaceWorkProgress';

export function WorkspaceView({
  directive,
  workSets,
  workItems,
  workResults,
  profile,
}: {
  directive?: AdvisorDirective;
  workSets: AdvisorWorkSet[];
  workItems: AdvisorWorkItem[];
  workResults: AdvisorWorkResult[];
  profile?: AdvisorProfile;
}) {
  const exploring = directive?.viewType === 'catalog' || workItems.some((item) => item.kind === 'course_fit_summary');
  return (
    <main className="task-pane" aria-label="Study planning workspace">
      <header className="workspace-header">
        <a className="brand" href="/" aria-label="Study Abroad advisor home"><span>SA</span> Study Abroad</a>
        <div className="journey-state"><span /> Guest journey saved</div>
      </header>
      <div className="workspace-scroll">
        <div className="breadcrumb">YOUR JOURNEY <b>/</b> {exploring ? 'EXPLORE' : 'DISCOVERY'}</div>
        <section className="discovery-hero">
          <span className="eyebrow">A CLEARER WAY FORWARD</span>
          <h1>Shape the study plan<br />that fits your story.</h1>
          <p>
            {profile?.studentPhrase
              ? `We are organizing partner courses related to ${profile.studentPhrase} here, away from the conversation.`
              : 'Explore your background, ambitions, and practical preferences with your advisor. Useful results stay organized here, away from the conversation.'}
          </p>
          <div className="journey-progress" aria-label="Journey progress">
            <div className={!exploring ? 'active' : undefined}><span>01</span><b>Discovery</b><i /></div>
            <div className={exploring ? 'active' : undefined}><span>02</span><b>Explore</b><i /></div>
            <div><span>03</span><b>Shortlist</b><i /></div>
            <div><span>04</span><b>Documents</b></div>
          </div>
        </section>
        {directive ? (
          <section className="workspace-awareness">
            <span className="awareness-mark" aria-hidden="true">✦</span>
            <div><span className="eyebrow">CURRENT FOCUS</span><p>{directive.awareness}</p></div>
          </section>
        ) : (
          <section className="empty-workspace">
            <span aria-hidden="true">↗</span>
            <div><h3>Your workspace is ready</h3><p>Start by telling the advisor about your background and interests. Course matches will collect here independently.</p></div>
          </section>
        )}
        <WorkspaceWorkProgress workSets={workSets} items={workItems} results={workResults} />
      </div>
    </main>
  );
}
