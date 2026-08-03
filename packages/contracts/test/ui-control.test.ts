import { describe, expect, it } from 'vitest';
import { HOME_UI_TARGET, uiIntent, uiTargetRef, uiTargetsMatch } from '../src/ui-control.js';

describe('UI control contracts', () => {
  const summary = {
    schemaVersion: 1 as const,
    viewType: 'course_summary' as const,
    workSetId: 'turn-1-work',
    entityType: 'course',
    entityId: 'course-1',
    slot: 'summary',
  };

  it('accepts semantic course targets without routes or component names', () => {
    expect(uiTargetRef.parse(summary)).toEqual(summary);
    expect(() => uiTargetRef.parse({ ...summary, workSetId: undefined })).toThrow(/work set/i);
    expect(() => uiTargetRef.parse({ schemaVersion: 1, viewType: 'home', entityId: 'course-1' })).toThrow(/home/i);
  });

  it('supports future replace-view intent with an explicit revision fence', () => {
    expect(uiIntent.parse({
      kind: 'replace_view',
      target: { schemaVersion: 1, viewType: 'catalog', workSetId: 'turn-1-work' },
      baseNavigationRevision: 4,
      activation: 'auto_if_current',
    }).kind).toBe('replace_view');
  });

  it('matches exact summary targets and the stable home target', () => {
    expect(uiTargetsMatch(summary, { ...summary })).toBe(true);
    expect(uiTargetsMatch(summary, { ...summary, entityId: 'course-2' })).toBe(false);
    expect(uiTargetsMatch(HOME_UI_TARGET, HOME_UI_TARGET)).toBe(true);
  });
});
