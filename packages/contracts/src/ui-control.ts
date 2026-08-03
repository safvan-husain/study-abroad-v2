import { z } from 'zod';

export const uiViewType = z.enum(['home', 'catalog', 'course_summary']);

export const uiTargetRef = z.object({
  schemaVersion: z.literal(1),
  viewType: uiViewType,
  workSetId: z.string().min(1).max(128).optional(),
  entityType: z.string().min(1).max(128).optional(),
  entityId: z.string().min(1).max(128).optional(),
  slot: z.string().min(1).max(64).optional(),
}).strict().superRefine((target, context) => {
  if (target.viewType === 'home' && (target.workSetId || target.entityType || target.entityId || target.slot)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'home targets cannot identify workspace content' });
  }
  if (target.viewType === 'course_summary'
    && (!target.workSetId || target.entityType !== 'course' || !target.entityId)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'course summary targets require a work set and course entity' });
  }
});

export const uiIntent = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('content_updated'), target: uiTargetRef }),
  z.object({ kind: z.literal('offer_navigation'), target: uiTargetRef, label: z.string().min(1).max(256) }),
  z.object({
    kind: z.literal('replace_view'),
    target: uiTargetRef,
    baseNavigationRevision: z.number().int().min(0),
    activation: z.enum(['offer', 'auto_if_current']),
  }),
]);

export const uiActivityReceiptState = z.enum(['observed_in_place', 'opened', 'dismissed']);

export const courseSummaryDependencies = z.object({
  profile: z.object({
    background: z.string(),
    courseInterests: z.string(),
    ambitions: z.string(),
    primaryArea: z.string(),
    candidateAreas: z.array(z.string()),
    studentPhrase: z.string(),
    constraintsText: z.string(),
  }).strict(),
  course: z.object({
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
  }).strict(),
}).strict();

export type UiTargetRef = z.infer<typeof uiTargetRef>;
export type UiIntent = z.infer<typeof uiIntent>;
export type UiActivityReceiptState = z.infer<typeof uiActivityReceiptState>;
export type CourseSummaryDependencies = z.infer<typeof courseSummaryDependencies>;

export const HOME_UI_TARGET: UiTargetRef = { schemaVersion: 1, viewType: 'home' };

export function uiTargetsMatch(left: UiTargetRef, right: UiTargetRef): boolean {
  if (left.viewType !== right.viewType) return false;
  if (right.viewType === 'course_summary') {
    return left.workSetId === right.workSetId
      && left.entityType === right.entityType
      && left.entityId === right.entityId
      && left.slot === right.slot;
  }
  if (right.viewType === 'catalog') return left.workSetId === right.workSetId;
  return true;
}
