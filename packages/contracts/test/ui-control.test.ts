import { describe, expect, it } from 'vitest';
import { HOME_UI_TARGET, uiAction, uiIntent, uiTargetRef, uiTargetsMatch, userUiState } from '../src/ui-control.js';

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

  it('validates per-tab UI state and durable actions', () => {
    const target = { schemaVersion: 1 as const, viewType: 'catalog' as const, workSetId: 'turn-1-work' };
    expect(userUiState.parse({ clientInstanceId: 'tab-1', target, navigationRevision: 2n, visible: true, lastSeenAtMicros: 10n })).toBeTruthy();
    expect(uiAction.parse({
      actionId: 'action-1', sourceKind: 'turn', sourceId: 'turn-1', kind: 'open_catalog',
      label: 'Course matches ready', buttonLabel: 'Open courses', target,
      clientInstanceId: 'tab-1', baseTarget: HOME_UI_TARGET, baseNavigationRevision: 2n,
      activation: 'auto_if_origin_unchanged', status: 'offered', createdAtMicros: 10n, updatedAtMicros: 10n,
    })).toBeTruthy();
  });
});
