import { DbConnection } from '@study-abroad/spacetimedb-bindings';
import { catalogCourses } from './manifest.js';

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
    })),
  });
  console.log(`Seeded ${catalogCourses.length} catalog courses.`);
  connection.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
