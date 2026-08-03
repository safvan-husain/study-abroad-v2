import type { UiTargetRef } from '@study-abroad/contracts';

export function workspaceContainsTarget(current: UiTargetRef, candidate: UiTargetRef): boolean {
  if (current.viewType === 'home') return candidate.viewType === 'home';
  if (candidate.viewType === 'home') return false;
  if (current.workSetId && candidate.workSetId && current.workSetId !== candidate.workSetId) return false;
  if (current.viewType === 'catalog') {
    if (!current.workSetId) return candidate.viewType === 'catalog' && !candidate.workSetId;
    return current.workSetId === candidate.workSetId
      && (candidate.viewType === 'catalog' || candidate.viewType === 'course_summary');
  }
  if (current.viewType === 'course_summary' && candidate.viewType === 'course_summary') {
    // Course summaries share one mounted comparison workspace; selection only controls emphasis.
    return current.workSetId === candidate.workSetId;
  }
  return false;
}

export function targetBreadcrumb(target: UiTargetRef): string {
  if (target.viewType === 'home') return 'DISCOVERY';
  if (target.viewType === 'catalog') return 'EXPLORE';
  return 'EXPLORE / COURSE SUMMARY';
}
