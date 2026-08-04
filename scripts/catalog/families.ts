import type { CatalogFamilySeed } from './types.js';

export const SUBJECT_AREA_TO_AREA: Record<string, string> = {
  computing: 'computing-technology',
  cybersecurity: 'computing-technology',
  data_science: 'computing-technology',
  artificial_intelligence: 'computing-technology',
  biotechnology: 'engineering-science',
  engineering: 'engineering-science',
  science: 'engineering-science',
  architecture: 'engineering-science',
  business: 'business-economics',
  economics: 'business-economics',
  finance: 'business-economics',
  logistics: 'business-economics',
  hospitality: 'business-economics',
  communications: 'business-economics',
  medicine: 'health-medicine',
  dentistry: 'health-medicine',
  nursing: 'health-medicine',
  health: 'health-medicine',
  psychology: 'health-medicine',
  social_sciences: 'society-humanities',
  humanities: 'society-humanities',
  languages: 'society-humanities',
  heritage: 'society-humanities',
  media: 'society-humanities',
  political_science: 'society-humanities',
  law: 'society-humanities',
};

export const AREA_NAMES: Record<string, string> = {
  'computing-technology': 'Computing and Technology',
  'engineering-science': 'Engineering and Science',
  'business-economics': 'Business and Economics',
  'health-medicine': 'Health and Medicine',
  'society-humanities': 'Society and Humanities',
};

const FAMILY_OVERRIDES: Record<string, Partial<CatalogFamilySeed>> = {
  'computer-science': {
    aliases: ['computer science', 'computing', 'cs'],
    description: 'Builds the theory and practice of software, algorithms, data structures, and computation.',
    typicalSubjects: ['Programming', 'Algorithms', 'Data structures', 'Databases', 'Computer theory'],
    careerDirections: ['Software engineering', 'Systems development', 'Research', 'Data and platform roles'],
    relatedFamilyIds: ['computer-systems', 'cyber-security-engineering', 'mathematical-foundations-of-data-science', 'mathematical-and-computing-sciences-for-artificial-intelligence'],
  },
  'computer-systems': {
    aliases: ['computer systems', 'systems architecture', 'computer system'],
    description: 'Connects software with operating systems, networks, hardware, and dependable system design.',
    typicalSubjects: ['Computer architecture', 'Operating systems', 'Networks', 'Programming', 'Embedded systems'],
    careerDirections: ['Systems engineering', 'Infrastructure', 'Network engineering', 'Embedded development'],
    relatedFamilyIds: ['computer-science', 'cyber-security-engineering'],
  },
  'cyber-security-engineering': {
    aliases: ['cybersecurity', 'cyber security', 'information security'],
    description: 'Focuses on designing, testing, and operating secure software, networks, and digital infrastructure.',
    typicalSubjects: ['Network security', 'Cryptography', 'Secure programming', 'Risk', 'Digital forensics'],
    careerDirections: ['Security engineering', 'Security operations', 'Penetration testing', 'Risk and assurance'],
    relatedFamilyIds: ['computer-science', 'computer-systems'],
  },
  'mathematical-foundations-of-data-science': {
    aliases: ['data science', 'data analytics'],
    description: 'Uses mathematics, statistics, and computing to model data and draw defensible conclusions.',
    typicalSubjects: ['Statistics', 'Linear algebra', 'Programming', 'Machine learning', 'Data modelling'],
    careerDirections: ['Data science', 'Analytics', 'Quantitative research', 'Machine-learning roles'],
    relatedFamilyIds: ['computer-science', 'mathematical-and-computing-sciences-for-artificial-intelligence'],
  },
  'mathematical-and-computing-sciences-for-artificial-intelligence': {
    aliases: ['artificial intelligence', 'ai', 'machine learning'],
    description: 'Combines rigorous mathematics and computer science for artificial-intelligence systems.',
    typicalSubjects: ['Machine learning', 'Algorithms', 'Probability', 'Optimisation', 'AI systems'],
    careerDirections: ['AI engineering', 'Machine-learning engineering', 'Research', 'Intelligent products'],
    relatedFamilyIds: ['computer-science', 'mathematical-foundations-of-data-science'],
  },
};

const AREA_FOCUS: Record<string, { subjects: string[]; careers: string[] }> = {
  computing: { subjects: ['Programming', 'Systems', 'Data'], careers: ['Technology roles', 'Software and systems work'] },
  cybersecurity: { subjects: ['Security', 'Networks', 'Risk'], careers: ['Cybersecurity roles', 'Security operations'] },
  data_science: { subjects: ['Mathematics', 'Statistics', 'Computing'], careers: ['Data and analytics roles'] },
  artificial_intelligence: { subjects: ['Mathematics', 'Algorithms', 'Machine learning'], careers: ['AI and machine-learning roles'] },
  business: { subjects: ['Management', 'Marketing', 'Operations'], careers: ['Management', 'Consulting', 'Entrepreneurship'] },
  economics: { subjects: ['Economics', 'Finance', 'Quantitative methods'], careers: ['Economics', 'Policy', 'Finance'] },
  engineering: { subjects: ['Mathematics', 'Design', 'Applied science'], careers: ['Engineering and technical roles'] },
  medicine: { subjects: ['Clinical science', 'Biology', 'Patient care'], careers: ['Medical practice and health services'] },
};

export const slugifyFamily = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const familyIdForProgram = (name: string) => {
  if (name === 'Dual Award Programme in Computer Science') return 'computer-science';
  return slugifyFamily(name);
};

export const buildFamily = (familyId: string, name: string, subjectArea: string): CatalogFamilySeed => {
  const fallback = AREA_FOCUS[subjectArea] ?? {
    subjects: [name, 'Foundational studies', 'Applied practice'],
    careers: [`Roles related to ${name}`],
  };
  const override = FAMILY_OVERRIDES[familyId] ?? {};
  return {
    familyId,
    areaId: SUBJECT_AREA_TO_AREA[subjectArea] ?? slugifyFamily(subjectArea),
    name,
    aliases: override.aliases ?? [name.toLowerCase()],
    description: override.description ?? `Explores the core knowledge and applied practice of ${name}.`,
    typicalSubjects: override.typicalSubjects ?? fallback.subjects,
    careerDirections: override.careerDirections ?? fallback.careers,
    relatedFamilyIds: override.relatedFamilyIds ?? [],
    active: true,
  };
};
