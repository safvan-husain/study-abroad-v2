import type { AdvisorDirective, AdvisorWorkItem, AdvisorWorkResult, AdvisorWorkSet } from '../../hooks/useAdvisorWorkspace';
import { WorkspaceWorkProgress } from './WorkspaceWorkProgress';

export function WorkspaceView({ directive, workSets, workItems, workResults }: { directive?: AdvisorDirective; workSets: AdvisorWorkSet[]; workItems: AdvisorWorkItem[]; workResults: AdvisorWorkResult[] }) {
  return (
    <main className="task-pane" aria-label="Study planning workspace">
      <header className="workspace-header">
        <a className="brand" href="/" aria-label="Study Abroad advisor home"><span>SA</span> Study Abroad</a>
        <div className="journey-state"><span /> Guest journey saved</div>
      </header>
      <div className="workspace-scroll">
        <div className="breadcrumb">YOUR JOURNEY <b>/</b> DISCOVERY</div>
        <section className="discovery-hero">
          <span className="eyebrow">A CLEARER WAY FORWARD</span>
          <h1>Shape the study plan<br />that fits your story.</h1>
          <p>Explore your background, ambitions, and practical preferences with your advisor. Useful results stay organized here, away from the conversation.</p>
          <div className="journey-progress" aria-label="Journey progress">
            <div><span>01</span><b>Discovery</b><i /></div>
            <div><span>02</span><b>Explore</b><i /></div>
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
            <div><h3>Your workspace is ready</h3><p>Start with a question in the advisor rail. Plans and independently completed results will collect here.</p></div>
          </section>
        )}
        <WorkspaceWorkProgress workSets={workSets} items={workItems} results={workResults} />
      </div>
    </main>
  );
}
