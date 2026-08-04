import { describe, expect, it } from 'vitest';
import {
  catalogAreaDisplayName,
  catalogScopeDecision,
  discoveryTurnResult,
  mapPhraseToCatalogAreas,
  matchesCatalogLabel,
  rankCoursesForAreas,
  turnUpdateLabel,
} from '../src/discovery.js';

const courses = [
  { courseId: 'a', institutionId: 'i', institutionName: 'Uni A', country: 'Latvia', city: 'Riga', name: 'Computer Science', area: 'computing', level: 'undergraduate', tuitionBand: 'moderate', englishBar: 'IELTS 6.0' },
  { courseId: 'b', institutionId: 'i', institutionName: 'Uni A', country: 'Latvia', city: 'Riga', name: 'Business Admin', area: 'business', level: 'undergraduate', tuitionBand: 'moderate', englishBar: 'IELTS 6.0' },
  { courseId: 'c', institutionId: 'j', institutionName: 'Uni B', country: 'Estonia', city: 'Tallinn', name: 'Computer Systems', area: 'computing', level: 'undergraduate', tuitionBand: 'moderate', englishBar: 'IELTS 6.0' },
];

describe('discovery contracts', () => {
  it('retains the student phrase while mapping to catalog areas', () => {
    const intent = mapPhraseToCatalogAreas('I want to study programming', ['computing', 'business']);
    expect(intent.status).toBe('mapped');
    expect(intent.catalogAreas).toEqual(['computing']);
    expect(intent.studentPhrase).toBe('programming');
  });

  it('accepts areas_overview as a catalog scope', () => {
    expect(catalogScopeDecision.parse({
      scope: 'areas_overview',
      explanation: 'Cold-start browse',
    }).scope).toBe('areas_overview');
    expect(catalogAreaDisplayName('computing-technology')).toBe('Computing and Technology');
  });

  it('reports unmapped phrases without inventing areas', () => {
    const intent = mapPhraseToCatalogAreas('underwater basket weaving', ['computing', 'business']);
    expect(intent.status).toBe('unmapped');
    expect(intent.catalogAreas).toEqual([]);
    expect(intent.studentPhrase).toContain('underwater');
  });

  it('avoids short-alias substring false positives', () => {
    expect(matchesCatalogLabel('sit here quietly', 'it')).toBe(false);
    expect(matchesCatalogLabel('I like it', 'it')).toBe(true);
    expect(mapPhraseToCatalogAreas('I like sitting quietly', ['computing', 'business']).status).toBe('unmapped');
  });

  it('prefers the stronger interest area when several match', () => {
    const intent = mapPhraseToCatalogAreas(
      'I studied commerce and I am interested in programming',
      ['business', 'computing'],
    );
    expect(intent.catalogAreas[0]).toBe('computing');
    expect(rankCoursesForAreas(courses, intent.catalogAreas, 2).map((course) => course.area)).toEqual([
      'computing',
      'computing',
    ]);
  });

  it('ranks only matching active areas', () => {
    expect(rankCoursesForAreas(courses, ['computing'], 5).map((course) => course.courseId)).toEqual(['a', 'c']);
    expect(rankCoursesForAreas(courses, [], 5)).toEqual([]);
  });

  it('requires workKind when workItems are present', () => {
    expect(() => discoveryTurnResult.parse({
      assistantContent: 'Looking into courses.',
      profilePatch: {},
      discoveryIntent: { studentPhrase: 'programming', catalogAreas: ['computing'], status: 'mapped' },
      directive: { type: 'catalog', awareness: 'Showing courses related to programming.' },
      workItems: [{ entityType: 'course', entityId: 'a', kind: 'course_fit_summary', inputJson: '{}' }],
      workKind: '',
    })).toThrow(/workKind/i);
    expect(discoveryTurnResult.parse({
      assistantContent: 'Looking into courses.',
      profilePatch: {},
      discoveryIntent: { studentPhrase: 'programming', catalogAreas: ['computing'], status: 'mapped' },
      directive: { type: 'catalog', awareness: 'Showing courses related to programming.' },
      workItems: [],
      workKind: '',
    }).workItems).toEqual([]);
  });

  it('renders student-facing turn update labels from typed payloads', () => {
    expect(turnUpdateLabel({ kind: 'course_search_results_ready', studentPhrase: 'programming', matchCount: 5, courseIds: ['a'] }))
      .toBe('Found 5 study-abroad courses related to programming.');
  });
});
