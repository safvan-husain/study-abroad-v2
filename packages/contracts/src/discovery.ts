import { z } from 'zod';

export const courseDiscoveryIntent = z.object({
  studentPhrase: z.string().max(256),
  catalogAreas: z.array(z.string().min(1).max(64)).max(8),
  status: z.enum(['mapped', 'unmapped']),
});

export const discoveryProfilePatch = z.object({
  background: z.string().max(1024).default(''),
  courseInterests: z.string().max(1024).default(''),
  ambitions: z.string().max(1024).default(''),
  primaryArea: z.string().max(64).default(''),
  candidateAreas: z.array(z.string().min(1).max(64)).max(8).default([]),
  studentPhrase: z.string().max(256).default(''),
  constraintsText: z.string().max(1024).default(''),
});

export const turnUpdatePayload = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('turn_started') }),
  z.object({ kind: z.literal('course_search_started'), studentPhrase: z.string().max(256) }),
  z.object({
    kind: z.literal('course_search_results_ready'),
    studentPhrase: z.string().max(256),
    matchCount: z.number().int().min(0).max(100),
    courseIds: z.array(z.string().min(1).max(128)).max(20),
  }),
]);

export const discoveryDirective = z.object({
  type: z.enum(['discovery', 'catalog']),
  awareness: z.string().max(512),
});

export const discoveryWorkItem = z.object({
  entityType: z.string().min(1).max(128),
  entityId: z.string().min(1).max(128),
  kind: z.string().min(1).max(64),
  inputJson: z.string().max(4096),
});

export const discoveryTurnResult = z.object({
  assistantContent: z.string().min(1).max(16_000),
  profilePatch: discoveryProfilePatch,
  discoveryIntent: courseDiscoveryIntent,
  directive: discoveryDirective,
  workItems: z.array(discoveryWorkItem).max(8).default([]),
  workKind: z.string().max(64).default(''),
}).superRefine((value, ctx) => {
  if (value.workItems.length > 0 && value.workKind.trim().length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'workKind is required when workItems are present',
      path: ['workKind'],
    });
  }
});

export const courseFitResult = z.object({
  entityType: z.literal('course'),
  entityId: z.string().min(1).max(128),
  title: z.string().min(1).max(256),
  detail: z.string().min(1).max(2000),
  institutionName: z.string().max(256).optional(),
  area: z.string().max(64).optional(),
  country: z.string().max(64).optional(),
  studentPhrase: z.string().max(256).optional(),
});

export const catalogCourseView = z.object({
  courseId: z.string(),
  institutionId: z.string(),
  institutionName: z.string(),
  country: z.string(),
  city: z.string(),
  name: z.string(),
  area: z.string(),
  level: z.string(),
  tuitionBand: z.string(),
  englishBar: z.string(),
});

export type CourseDiscoveryIntent = z.infer<typeof courseDiscoveryIntent>;
export type DiscoveryProfilePatch = z.infer<typeof discoveryProfilePatch>;
export type TurnUpdatePayload = z.infer<typeof turnUpdatePayload>;
export type DiscoveryTurnResult = z.infer<typeof discoveryTurnResult>;
export type CourseFitResult = z.infer<typeof courseFitResult>;
export type CatalogCourseView = z.infer<typeof catalogCourseView>;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Match complete words/phrases so short aliases like "it" or "ai" do not hit substrings. */
export function matchesCatalogLabel(haystack: string, label: string): boolean {
  const needle = label.trim().toLowerCase();
  if (!needle) return false;
  const pattern = new RegExp(`(?:^|[^a-z0-9_])${escapeRegExp(needle)}(?:$|[^a-z0-9_])`, 'i');
  return pattern.test(haystack);
}

/** Map open-vocabulary student phrases onto known catalog areas without inventing labels. */
export function mapPhraseToCatalogAreas(phrase: string, catalogAreas: string[]): CourseDiscoveryIntent {
  const raw = phrase.trim().slice(0, 256);
  if (!raw) return { studentPhrase: '', catalogAreas: [], status: 'unmapped' };
  const normalized = raw.toLowerCase();
  const aliases: Record<string, string[]> = {
    computing: ['programming', 'computer science', 'software', 'coding', 'tech', 'it', 'cyber'],
    business: ['business', 'management', 'mba', 'entrepreneur', 'commerce'],
    engineering: ['engineering', 'mechanical', 'civil engineering', 'electrical'],
    medicine: ['medicine', 'medical', 'doctor', 'md'],
    health: ['health', 'nursing', 'healthcare', 'optometry'],
    hospitality: ['hospitality', 'tourism', 'hotel'],
    media: ['media', 'film', 'audiovisual'],
    economics: ['economics', 'finance', 'economy'],
    data_science: ['data science', 'data', 'analytics'],
    artificial_intelligence: ['ai', 'artificial intelligence', 'machine learning'],
    law: ['law', 'legal'],
    psychology: ['psychology'],
    science: ['science', 'biology', 'chemistry', 'physics'],
    cybersecurity: ['cyber security', 'cybersecurity', 'security engineering'],
  };
  const areaScores = new Map<string, number>();
  const retainedPhrases: string[] = [];
  for (const area of catalogAreas) {
    const key = area.toLowerCase();
    const labels = [key.replaceAll('_', ' '), key, ...(aliases[key] ?? [])];
    for (const label of labels) {
      if (!matchesCatalogLabel(normalized, label)) continue;
      areaScores.set(area, Math.max(areaScores.get(area) ?? 0, label.length));
      retainedPhrases.push(label);
    }
  }
  const catalogMatched = [...areaScores.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([area]) => area)
    .slice(0, 8);
  const studentPhrase = (retainedPhrases.sort((a, b) => b.length - a.length)[0] ?? raw).slice(0, 256);
  return {
    studentPhrase,
    catalogAreas: catalogMatched,
    status: catalogMatched.length > 0 ? 'mapped' : 'unmapped',
  };
}

export function rankCoursesForAreas(
  courses: CatalogCourseView[],
  areas: string[],
  limit = 5,
): CatalogCourseView[] {
  if (areas.length === 0) return [];
  const normalizedAreas = areas.map((area) => area.toLowerCase());
  const primary = normalizedAreas[0];
  const areaRank = new Map(normalizedAreas.map((area, index) => [area, index]));
  return courses
    .filter((course) => areaRank.has(course.area.toLowerCase()))
    .map((course) => {
      const area = course.area.toLowerCase();
      const rank = areaRank.get(area) ?? Number.MAX_SAFE_INTEGER;
      return {
        course,
        score: area === primary ? 50 : Math.max(10, 40 - rank),
      };
    })
    .sort((left, right) => right.score - left.score || left.course.name.localeCompare(right.course.name))
    .slice(0, limit)
    .map((row) => row.course);
}

export function turnUpdateLabel(payload: TurnUpdatePayload): string {
  switch (payload.kind) {
    case 'turn_started':
      return 'Starting your advisor turn…';
    case 'course_search_started':
      return `Searching partner courses related to ${payload.studentPhrase}…`;
    case 'course_search_results_ready':
      return payload.matchCount > 0
        ? `Found ${payload.matchCount} study-abroad courses related to ${payload.studentPhrase}.`
        : `No exact partner-catalogue match was found for ${payload.studentPhrase}.`;
  }
}
