import type { CatalogCourseSeed } from './types.js';
import courses from './courses.json' with { type: 'json' };

/** Single source of truth is courses.json; this module re-exports for seed scripts. */
export const catalogCourses = courses as CatalogCourseSeed[];

export const CATALOG_AREAS = [...new Set(catalogCourses.map((course) => course.area))].sort();
