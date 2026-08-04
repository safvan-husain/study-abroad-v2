import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readJson = (name: string) => JSON.parse(readFileSync(new URL(`../../../scripts/catalog/${name}`, import.meta.url), 'utf8')) as Array<Record<string, unknown>>;

const legacyIds = [
  'lu-computer-science-bsc', 'lu-dual-computer-science-bsc', 'lu-business-administration-bsc',
  'lu-industrial-engineering-bsc', 'lu-optometry-bsc', 'rtu-civil-engineering-bsc',
  'rtu-computer-systems-bsc', 'rtu-mechanical-engineering-bsc', 'rsu-medicine-md',
  'rsu-nursing-prof-bsc', 'rsu-international-business-bsc', 'turiba-business-administration-prof-bsc',
  'turiba-computer-systems-prof-bsc', 'turiba-tourism-prof-bsc', 'riseba-european-business-bsc',
  'riseba-audiovisual-arts-ba', 'tartu-business-administration-bsc', 'tartu-medicine-md',
  'tartu-science-technology-bsc', 'taltech-integrated-engineering-bsc', 'taltech-international-business-bsc',
  'taltech-cyber-security-bsc', 'ebs-international-business-bsc', 'tallinn-audiovisual-media-ba',
  'jagiellonian-medicine-md', 'kozminski-management-bsc', 'kozminski-finance-accounting-bsc',
  'lazarski-business-economics-bsc', 'ase-business-administration-bsc', 'rau-business-administration-bsc',
  'rau-psychology-bsc', 'vienna-data-science-bsc', 'vienna-international-legal-studies-llb',
  'fhoo-electrical-engineering-bsc', 'fhoo-global-sales-marketing-ba', 'modul-tourism-hospitality-bba',
  'webster-business-administration-ba', 'charles-computer-science-bsc', 'aau-business-administration-ba',
  'bologna-economics-finance-bsc', 'bocconi-international-economics-management-bsc',
  'bocconi-mathematical-computing-ai-bsc', 'luiss-economics-business-bsc',
];

describe('verified catalog snapshot', () => {
  it('ports 26 institutions and 70 offerings while preserving every v2 ID', () => {
    const institutions = readJson('institutions.json');
    const courses = readJson('courses.json');
    expect(institutions).toHaveLength(26);
    expect(courses).toHaveLength(70);
    const ids = new Set(courses.map((row) => row.courseId));
    expect(legacyIds).toHaveLength(43);
    expect(legacyIds.every((id) => ids.has(id))).toBe(true);
  });

  it('keeps complete matching Computer Science offerings and rich facts', () => {
    const courses = readJson('courses.json');
    const computerScience = courses.filter((row) => row.familyId === 'computer-science');
    expect(computerScience).toHaveLength(3);
    expect(computerScience.every((row) => Array.isArray(row.requirements) && Array.isArray(row.sources))).toBe(true);
  });
});
