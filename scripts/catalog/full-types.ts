export type StudyLevel = "undergraduate" | "professional_undergraduate" | "integrated_undergraduate";
export type RequirementScope = "country" | "institution" | "program";
export type RequirementCategory =
  | "academic_qualification" | "subject_prerequisite" | "english" | "entrance_test"
  | "interview" | "essay" | "portfolio" | "document" | "recognition_legalisation" | "finance";
export type ComparisonOperator = "eq" | "gte" | "lte" | "includes" | "one_of";
export type ConditionUnit = "" | "percent" | "points" | "ielts_band" | "toefl_points" | "sat_points" | "act_points" | "ib_points" | "cefr_level" | "characters" | "years";
export type DocumentType = "passport" | "academic" | "english_test" | "financial_proof" | "cv" | "sop" | "lor" | "experience";

export interface CatalogCountry { countryId: string; name: string; isoCode: string; active: boolean }
export interface CatalogInstitution { institutionId: string; countryId: string; canonicalName: string; aliases: string[]; city: string; ownership: "public" | "private"; institutionKind: string; active: boolean }
export interface CatalogProgram { programId: string; institutionId: string; schoolName: string; canonicalName: string; qualificationLabel: string; studyLevel: StudyLevel; subjectArea: string; teachingLanguage: "English"; officialProgramUrl: string; active: boolean }
export interface CatalogSource { sourceId: string; officialUrl: string; sourceType: "national_admissions" | "institution_admissions" | "program_page" | "ranking_provider"; academicYear: string; verificationStatus: "verified"; verificationDate: string; auditNote: string }
export interface CatalogRequirement { requirementId: string; scopeType: RequirementScope; scopeId: string; category: RequirementCategory; required: boolean; sourceId: string; effectiveFrom: string; effectiveUntil: string; overrideRequirementId: string; evidenceDocumentType: DocumentType | null; active: boolean }
export interface CatalogCondition { conditionId: string; requirementId: string; conditionGroup: string; groupOperator: "all" | "any"; attribute: string; comparisonOperator: ComparisonOperator; numericValue?: number; textValue: string; unit: ConditionUnit }
export interface CatalogRanking { rankingId: string; institutionId: string; sourceId: string; provider: string; scope: string; editionYear: number; rankMin?: number; rankMax?: number; rankLabel: string; active: boolean }
export interface CatalogReviewPolicy { policyId: string; version: number; baselineDocumentTypes: DocumentType[]; active: boolean }
export interface CatalogExclusion { institution: string; programOrField: string; source: string; reason: string; kind: "row" | "field" }
export interface CatalogManifest { seedVersion: string; countries: CatalogCountry[]; institutions: CatalogInstitution[]; programs: CatalogProgram[]; sources: CatalogSource[]; requirements: CatalogRequirement[]; conditions: CatalogCondition[]; rankings: CatalogRanking[]; reviewPolicies: CatalogReviewPolicy[] }
