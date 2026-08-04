import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalogManifest } from './full-manifest.js';
import { AREA_NAMES, buildFamily, familyIdForProgram } from './families.js';
import type { CatalogCourseSeed, CatalogFamilySeed, CatalogInstitutionSeed, CatalogPolicySeed } from './types.js';

export function buildCatalogSnapshot() {
  const institutionById = new Map(catalogManifest.institutions.map((row) => [row.institutionId, row]));
  const countryById = new Map(catalogManifest.countries.map((row) => [row.countryId, row]));
  const conditionByRequirement = new Map<string, typeof catalogManifest.conditions>();
  for (const condition of catalogManifest.conditions) {
    const rows = conditionByRequirement.get(condition.requirementId) ?? [];
    rows.push(condition);
    conditionByRequirement.set(condition.requirementId, rows);
  }
  const sourceById = new Map(catalogManifest.sources.map((row) => [row.sourceId, row]));
  const familiesById = new Map<string, CatalogFamilySeed>();

  const courses: CatalogCourseSeed[] = catalogManifest.programs.map((program) => {
    const institution = institutionById.get(program.institutionId);
    if (!institution) throw new Error(`Missing institution ${program.institutionId}`);
    const country = countryById.get(institution.countryId);
    if (!country) throw new Error(`Missing country ${institution.countryId}`);

    const familyId = familyIdForProgram(program.canonicalName);
    if (!familiesById.has(familyId)) {
      const displayName = familyId === 'computer-science' ? 'Computer Science' : program.canonicalName;
      familiesById.set(familyId, buildFamily(familyId, displayName, program.subjectArea));
    }

    const applicableRequirements = catalogManifest.requirements.filter(
      (row) => row.active && (
        (row.scopeType === 'country' && row.scopeId === institution.countryId) ||
        (row.scopeType === 'institution' && row.scopeId === institution.institutionId) ||
        (row.scopeType === 'program' && row.scopeId === program.programId)
      ),
    );
    const rankings = catalogManifest.rankings.filter((row) => row.active && row.institutionId === institution.institutionId);
    const sourceIds = new Set([
      `src-${program.programId}`,
      ...applicableRequirements.map((row) => row.sourceId),
      ...rankings.map((row) => row.sourceId),
    ]);
    const sources = [...sourceIds].map((sourceId) => sourceById.get(sourceId)).filter((row): row is NonNullable<typeof row> => Boolean(row));
    const ieltsCondition = applicableRequirements
      .flatMap((row) => conditionByRequirement.get(row.requirementId) ?? [])
      .find((row) => row.attribute === 'ielts.overall' && row.numericValue !== undefined);

    return {
      courseId: program.programId,
      institutionId: institution.institutionId,
      institutionName: institution.canonicalName,
      country: country.name,
      city: institution.city,
      name: program.canonicalName,
      area: AREA_NAMES[familiesById.get(familyId)!.areaId] ?? familiesById.get(familyId)!.areaId,
      level: program.studyLevel,
      tuitionBand: 'Unavailable',
      englishBar: ieltsCondition ? `IELTS ${ieltsCondition.numericValue}` : 'English proficiency proof required',
      familyId,
      qualification: program.qualificationLabel,
      officialUrl: program.officialProgramUrl,
      ownership: institution.ownership,
      institutionAliases: institution.aliases,
      requirements: applicableRequirements.map((row) => ({
        requirementId: row.requirementId,
        category: row.category,
        required: row.required,
        evidenceDocumentType: row.evidenceDocumentType,
        sourceId: row.sourceId,
        conditions: (conditionByRequirement.get(row.requirementId) ?? []).map((condition) => ({
          attribute: condition.attribute,
          comparisonOperator: condition.comparisonOperator,
          numericValue: condition.numericValue,
          textValue: condition.textValue,
          unit: condition.unit,
        })),
      })),
      rankings,
      sources,
    };
  });

  const families = [...familiesById.values()].sort((a, b) => a.areaId.localeCompare(b.areaId) || a.name.localeCompare(b.name));
  const policyRow = catalogManifest.reviewPolicies.find((row) => row.active);
  if (!policyRow) throw new Error('An active catalog review policy is required.');
  const policy: CatalogPolicySeed = {
    seedVersion: catalogManifest.seedVersion,
    policyId: policyRow.policyId,
    version: policyRow.version,
    baselineDocumentTypes: policyRow.baselineDocumentTypes,
  };
  const institutions: CatalogInstitutionSeed[] = catalogManifest.institutions.map((institution) => {
    const country = countryById.get(institution.countryId);
    if (!country) throw new Error(`Missing country ${institution.countryId}`);
    const rankings = catalogManifest.rankings.filter((row) => row.active && row.institutionId === institution.institutionId);
    const sourceIds = new Set(rankings.map((row) => row.sourceId));
    return {
      institutionId: institution.institutionId,
      name: institution.canonicalName,
      country: country.name,
      city: institution.city,
      ownership: institution.ownership,
      aliases: institution.aliases,
      rankings,
      sources: [...sourceIds].map((id) => sourceById.get(id)).filter((row): row is NonNullable<typeof row> => Boolean(row)),
      active: institution.active,
    };
  });
  return { institutions, courses, families, policy };
}

async function main() {
  const snapshot = buildCatalogSnapshot();
  const root = dirname(fileURLToPath(import.meta.url));
  await Promise.all([
    writeFile(join(root, 'courses.json'), `${JSON.stringify(snapshot.courses, null, 2)}\n`),
    writeFile(join(root, 'institutions.json'), `${JSON.stringify(snapshot.institutions, null, 2)}\n`),
    writeFile(join(root, 'families.json'), `${JSON.stringify(snapshot.families, null, 2)}\n`),
    writeFile(join(root, 'policy.json'), `${JSON.stringify(snapshot.policy, null, 2)}\n`),
  ]);
  console.log(`Wrote ${snapshot.institutions.length} institutions and ${snapshot.courses.length} offerings across ${snapshot.families.length} course types.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
