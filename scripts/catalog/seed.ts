import { DbConnection } from '@study-abroad/spacetimedb-bindings';
import { catalogCourses, catalogFamilies, catalogInstitutions, catalogPolicy } from './manifest.js';

const uri = (process.env.SPACETIME_URL ?? 'http://localhost:3002').replace(/^http/, 'ws');
const database = process.env.SPACETIME_DATABASE ?? 'study-abroad-coordinator';
const username = process.env.AGENT_USERNAME ?? 'study_abroad_agent';
const password = process.env.AGENT_PASSWORD ?? 'study-agent-dev';

async function main() {
  const connection = await new Promise<DbConnection>((resolve, reject) => {
    const builder = DbConnection.builder()
      .withUri(uri)
      .withDatabaseName(database)
      .onConnect((conn) => resolve(conn))
      .onConnectError((_ctx, error) => reject(error));
    builder.build();
  });

  await connection.reducers.login({ username, password });
  await connection.reducers.replaceCatalog({
    institutions: catalogInstitutions.map((institution) => ({
      institutionId: institution.institutionId,
      name: institution.name,
      country: institution.country,
      city: institution.city,
      ownership: institution.ownership,
      aliasesJson: JSON.stringify(institution.aliases),
      rankingsJson: JSON.stringify(institution.rankings),
      sourcesJson: JSON.stringify(institution.sources),
      active: institution.active,
    })),
    families: catalogFamilies.map((family) => ({
      familyId: family.familyId,
      areaId: family.areaId,
      name: family.name,
      aliasesJson: JSON.stringify(family.aliases),
      description: family.description,
      typicalSubjectsJson: JSON.stringify(family.typicalSubjects),
      careerDirectionsJson: JSON.stringify(family.careerDirections),
      relatedFamilyIdsJson: JSON.stringify(family.relatedFamilyIds),
      active: family.active,
    })),
    courses: catalogCourses.map((course) => ({
      courseId: course.courseId,
      institutionId: course.institutionId,
      institutionName: course.institutionName,
      country: course.country,
      city: course.city,
      name: course.name,
      area: course.area,
      level: course.level,
      tuitionBand: course.tuitionBand,
      englishBar: course.englishBar,
      familyId: course.familyId,
      qualification: course.qualification,
      officialUrl: course.officialUrl,
      ownership: course.ownership,
      requirementsJson: JSON.stringify(course.requirements),
      rankingsJson: JSON.stringify(course.rankings),
      sourcesJson: JSON.stringify(course.sources),
    })),
    policy: {
      seedVersion: catalogPolicy.seedVersion,
      policyId: catalogPolicy.policyId,
      version: catalogPolicy.version,
      baselineDocumentTypesJson: JSON.stringify(catalogPolicy.baselineDocumentTypes),
    },
  });
  console.log(`Seeded ${catalogInstitutions.length} institutions, ${catalogFamilies.length} course types, and ${catalogCourses.length} offerings.`);
  connection.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
