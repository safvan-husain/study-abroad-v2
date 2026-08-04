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
  familyId: string;
  qualification: string;
  officialUrl: string;
  ownership: 'public' | 'private';
  institutionAliases: string[];
  requirements: CatalogRequirementFact[];
  rankings: CatalogRankingFact[];
  sources: CatalogSourceFact[];
}

export interface CatalogRequirementFact {
  requirementId: string;
  category: string;
  required: boolean;
  evidenceDocumentType: string | null;
  sourceId: string;
  conditions: Array<{
    attribute: string;
    comparisonOperator: string;
    numericValue?: number;
    textValue: string;
    unit: string;
  }>;
}

export interface CatalogRankingFact {
  rankingId: string;
  provider: string;
  scope: string;
  editionYear: number;
  rankMin?: number;
  rankMax?: number;
  rankLabel: string;
  sourceId: string;
}

export interface CatalogSourceFact {
  sourceId: string;
  officialUrl: string;
  sourceType: string;
  academicYear: string;
  verificationStatus: 'verified';
  verificationDate: string;
  auditNote: string;
}

export interface CatalogFamilySeed {
  familyId: string;
  areaId: string;
  name: string;
  aliases: string[];
  description: string;
  typicalSubjects: string[];
  careerDirections: string[];
  relatedFamilyIds: string[];
  active: boolean;
}

export interface CatalogPolicySeed {
  seedVersion: string;
  policyId: string;
  version: number;
  baselineDocumentTypes: string[];
}

export interface CatalogInstitutionSeed {
  institutionId: string;
  name: string;
  country: string;
  city: string;
  ownership: 'public' | 'private';
  aliases: string[];
  rankings: CatalogRankingFact[];
  sources: CatalogSourceFact[];
  active: boolean;
}
