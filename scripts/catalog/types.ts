export type StudyLevel = 'undergraduate' | 'professional_undergraduate' | 'integrated_undergraduate';

export interface CatalogCourseSeed {
  courseId: string;
  institutionId: string;
  institutionName: string;
  country: string;
  city: string;
  name: string;
  area: string;
  level: StudyLevel | string;
  tuitionBand: string;
  englishBar: string;
}
