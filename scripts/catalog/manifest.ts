import type { CatalogCourseSeed, CatalogFamilySeed, CatalogInstitutionSeed, CatalogPolicySeed } from './types.js';
import courses from './courses.json' with { type: 'json' };
import families from './families.json' with { type: 'json' };
import institutions from './institutions.json' with { type: 'json' };
import policy from './policy.json' with { type: 'json' };

/** Single source of truth is courses.json; this module re-exports for seed scripts. */
export const catalogCourses = courses as CatalogCourseSeed[];
export const catalogFamilies = families as CatalogFamilySeed[];
export const catalogInstitutions = institutions as CatalogInstitutionSeed[];
export const catalogPolicy = policy as CatalogPolicySeed;

export const CATALOG_AREAS = [...new Set(catalogCourses.map((course) => course.area))].sort();
