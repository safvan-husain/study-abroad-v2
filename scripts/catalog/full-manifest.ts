import type { CatalogCondition, CatalogManifest, CatalogProgram, CatalogRanking, CatalogRequirement, DocumentType, StudyLevel } from "./full-types.js";

const verifiedOn = "2026-07-16";

export const countries = [
  ["latvia", "Latvia", "LV"], ["estonia", "Estonia", "EE"], ["poland", "Poland", "PL"],
  ["romania", "Romania", "RO"], ["austria", "Austria", "AT"], ["czechia", "Czechia", "CZ"], ["italy", "Italy", "IT"],
].map(([countryId, name, isoCode]) => ({ countryId, name, isoCode, active: true }));

export const institutions = [
  ["university-of-latvia", "latvia", "University of Latvia", "Riga", "public", []],
  ["riga-technical-university", "latvia", "Riga Technical University", "Riga", "public", ["RTU"]],
  ["riga-stradins-university", "latvia", "Rīga Stradiņš University", "Riga", "public", ["RSU", "Riga Stradins University"]],
  ["turiba-university", "latvia", "Turība University", "Riga", "private", ["Turiba University"]],
  ["riseba", "latvia", "RISEBA University of Applied Sciences", "Riga", "private", ["RISEBA"]],
  ["university-of-tartu", "estonia", "University of Tartu", "Tartu", "public", []],
  ["taltech", "estonia", "Tallinn University of Technology", "Tallinn", "public", ["TalTech"]],
  ["tallinn-university", "estonia", "Tallinn University", "Tallinn", "public", []],
  ["estonian-business-school", "estonia", "Estonian Business School", "Tallinn", "private", ["EBS"]],
  ["jagiellonian-university", "poland", "Jagiellonian University", "Kraków", "public", []],
  ["university-of-warsaw", "poland", "University of Warsaw", "Warsaw", "public", []],
  ["kozminski-university", "poland", "Kozminski University", "Warsaw", "private", []],
  ["lazarski-university", "poland", "Łazarski University", "Warsaw", "private", ["Lazarski University"]],
  ["ase-bucharest", "romania", "Bucharest University of Economic Studies", "Bucharest", "public", ["ASE"]],
  ["university-of-bucharest", "romania", "University of Bucharest", "Bucharest", "public", []],
  ["romanian-american-university", "romania", "Romanian-American University", "Bucharest", "private", ["RAU"]],
  ["titu-maiorescu-university", "romania", "Titu Maiorescu University", "Bucharest", "private", []],
  ["university-of-vienna", "austria", "University of Vienna", "Vienna", "public", []],
  ["fh-upper-austria", "austria", "University of Applied Sciences Upper Austria", "Wels / Steyr", "public", ["FH Upper Austria"]],
  ["modul-university-vienna", "austria", "Modul University Vienna", "Vienna", "private", []],
  ["webster-vienna", "austria", "Webster Vienna Private University", "Vienna", "private", []],
  ["charles-university", "czechia", "Charles University", "Prague", "public", []],
  ["anglo-american-university", "czechia", "Anglo-American University", "Prague", "private", ["AAU"]],
  ["university-of-bologna", "italy", "University of Bologna", "Bologna", "public", []],
  ["bocconi-university", "italy", "Bocconi University", "Milan", "private", []],
  ["luiss-university", "italy", "Luiss Guido Carli", "Rome", "private", ["Luiss University"]],
].map(([institutionId, countryId, canonicalName, city, ownership, aliases]) => ({ institutionId, countryId, canonicalName, aliases, city, ownership, institutionKind: "", active: true })) as CatalogManifest["institutions"];

type ProgramTuple = [string, string, string, string, StudyLevel, string, string, string?];
const p = (tuple: ProgramTuple): CatalogProgram => ({
  programId: tuple[0], institutionId: tuple[1], canonicalName: tuple[2], qualificationLabel: tuple[3],
  studyLevel: tuple[4], subjectArea: tuple[5], officialProgramUrl: tuple[6], schoolName: tuple[7] ?? "",
  teachingLanguage: "English", active: true,
});

const luListing = "https://www.lu.lv/en/admission/for-prospective-students/";
const rtuListing = "https://www.rtu.lv/en/studies/all-study-programmes?study_type_code=B%2CC&title=";
const rsuAdmissions = "https://www.rsu.lv/en/study-here/admissions/general-requirements-studies-english";
const turibaAdmissions = "https://www.turiba.lv/en/admission/admission";
const risebaAdmissions = "https://riseba.lv/en/come-study/summer-admission-2026-2027/";

export const programs: CatalogProgram[] = [
  p(["lu-biotechnology-beng", "university-of-latvia", "Biotechnology and Bioengineering", "Bachelor", "undergraduate", "biotechnology", "https://www.lu.lv/en/admissions/degree-studies/"]),
  p(["lu-computer-science-bsc", "university-of-latvia", "Computer Science", "Bachelor", "undergraduate", "computing", luListing]),
  p(["lu-dual-computer-science-bsc", "university-of-latvia", "Dual Award Programme in Computer Science", "Bachelor", "undergraduate", "computing", luListing]),
  p(["lu-business-administration-bsc", "university-of-latvia", "Business Administration", "Bachelor", "undergraduate", "business", luListing]),
  p(["lu-international-economics-bsc", "university-of-latvia", "International Economics and Commercial Diplomacy", "Bachelor", "undergraduate", "economics", luListing]),
  p(["lu-industrial-engineering-bsc", "university-of-latvia", "Industrial Engineering and Management", "Bachelor", "undergraduate", "engineering", luListing]),
  p(["lu-cultural-anthropology-ba", "university-of-latvia", "Cultural and Social Anthropology", "Bachelor", "undergraduate", "social_sciences", luListing]),
  p(["lu-east-west-studies-ba", "university-of-latvia", "East-West Intercultural Studies", "Bachelor", "undergraduate", "humanities", luListing]),
  p(["lu-english-languages-business-ba", "university-of-latvia", "English, European Languages and Business Studies", "Bachelor", "undergraduate", "languages", "https://www.lu.lv/en/studies/study-programmes-1/bachelors-study-programmes/english-european-languages-and-business-studies/"]),
  p(["lu-philology-ba", "university-of-latvia", "Philology (French, Russian or German)", "Bachelor", "undergraduate", "languages", luListing]),
  p(["lu-cultural-environmental-heritage-ba", "university-of-latvia", "Research and Protection of Cultural and Environmental Heritage", "Bachelor", "undergraduate", "heritage", luListing]),
  p(["lu-optometry-bsc", "university-of-latvia", "Optometry", "Bachelor", "undergraduate", "health", luListing]),
  p(["rtu-civil-engineering-bsc", "riga-technical-university", "Civil Engineering", "Bachelor", "undergraduate", "engineering", rtuListing]),
  p(["rtu-mechanical-engineering-bsc", "riga-technical-university", "Engineering Technology, Mechanics and Mechanical Engineering", "Bachelor", "undergraduate", "engineering", rtuListing]),
  p(["rtu-medical-engineering-prof-bsc", "riga-technical-university", "Medical Engineering and Medical Physics", "Professional Bachelor", "professional_undergraduate", "engineering", rtuListing]),
  p(["rtu-biotechnology-bsc", "riga-technical-university", "Biotechnology and Bioengineering", "Bachelor", "undergraduate", "biotechnology", rtuListing]),
  p(["rtu-computer-systems-bsc", "riga-technical-university", "Computer Systems", "Bachelor", "undergraduate", "computing", "https://www.rtu.lv/en/studies/all-study-programmes/open/computer-systems?id=43&view=pdf"]),
  p(["rsu-medicine-md", "riga-stradins-university", "Medicine", "MD", "integrated_undergraduate", "medicine", rsuAdmissions]),
  p(["rsu-dentistry-dds", "riga-stradins-university", "Dentistry", "DDS", "integrated_undergraduate", "dentistry", rsuAdmissions]),
  p(["rsu-nursing-prof-bsc", "riga-stradins-university", "Nursing", "Professional Bachelor", "professional_undergraduate", "nursing", rsuAdmissions]),
  p(["rsu-international-business-bsc", "riga-stradins-university", "International Business and Start-up Entrepreneurship", "Bachelor", "undergraduate", "business", rsuAdmissions]),
  p(["turiba-business-administration-prof-bsc", "turiba-university", "Business Administration", "Professional Bachelor", "professional_undergraduate", "business", turibaAdmissions]),
  p(["turiba-logistics-prof-bsc", "turiba-university", "Business Logistics Management", "Professional Bachelor", "professional_undergraduate", "logistics", "https://www.turiba.lv/en/admission/study-programs/bachelor-studies/business-logistics-management"]),
  p(["turiba-computer-systems-prof-bsc", "turiba-university", "Computer Systems", "Professional Bachelor", "professional_undergraduate", "computing", turibaAdmissions]),
  p(["turiba-communication-prof-bsc", "turiba-university", "International Communication Management", "Professional Bachelor", "professional_undergraduate", "communications", turibaAdmissions]),
  p(["turiba-tourism-prof-bsc", "turiba-university", "Tourism and Hospitality Management", "Professional Bachelor", "professional_undergraduate", "hospitality", turibaAdmissions]),
  p(["riseba-architecture-ba", "riseba", "Architecture", "Bachelor", "undergraduate", "architecture", "https://riseba.lv/en/program/architecture/"]),
  p(["riseba-audiovisual-arts-ba", "riseba", "Audiovisual Arts and Media Arts", "Bachelor", "undergraduate", "media", risebaAdmissions]),
  p(["riseba-business-psychology-bsc", "riseba", "Business Psychology", "Bachelor", "undergraduate", "psychology", "https://riseba.lv/en/programmes/"]),
  p(["riseba-european-business-bsc", "riseba", "European Business Studies", "Bachelor", "undergraduate", "business", risebaAdmissions]),
  p(["riseba-pr-advertising-ba", "riseba", "Public Relations and Advertising Management", "Bachelor", "undergraduate", "communications", risebaAdmissions]),
  p(["riseba-business-management-prof-bsc", "riseba", "Business Management", "Professional Bachelor", "professional_undergraduate", "business", risebaAdmissions]),
  p(["tartu-science-technology-bsc", "university-of-tartu", "Science and Technology", "Bachelor", "undergraduate", "science", "https://ut.ee/en/curriculum/science-and-technology"]),
  p(["tartu-business-administration-bsc", "university-of-tartu", "Business Administration", "Bachelor", "undergraduate", "business", "https://ut.ee/en/curriculum/business-administration"]),
  p(["tartu-medicine-md", "university-of-tartu", "Medicine", "MD", "integrated_undergraduate", "medicine", "https://ut.ee/en/curriculum/medicine"]),
  p(["taltech-integrated-engineering-bsc", "taltech", "Integrated Engineering", "Bachelor", "undergraduate", "engineering", "https://taltech.ee/en/bachelors-programmes/integrated-engineering"]),
  p(["taltech-international-business-bsc", "taltech", "International Business Administration", "Bachelor", "undergraduate", "business", "https://taltech.ee/en/bachelors-programmes/international-business-administration"]),
  p(["taltech-cyber-security-bsc", "taltech", "Cyber Security Engineering", "Bachelor", "undergraduate", "cybersecurity", "https://taltech.ee/en/bachelors-programmes/cyber-security-engineering"]),
  p(["ebs-international-business-bsc", "estonian-business-school", "International Business Administration", "Bachelor", "undergraduate", "business", "https://www.ebs.ee/en/university/bachelors-studies/bachelors-admission-information"]),
  p(["tallinn-audiovisual-media-ba", "tallinn-university", "Audiovisual Media", "Bachelor", "undergraduate", "media", "https://www.tlu.ee/en/bfm/audiovisual-media"]),
  p(["tallinn-law-ba", "tallinn-university", "Law", "Bachelor", "undergraduate", "law", "https://www.tlu.ee/en/yti/law"]),
  p(["jagiellonian-medicine-md", "jagiellonian-university", "Medicine", "MD", "integrated_undergraduate", "medicine", "https://medschool.uj.edu.pl/prospective-students/md-program-in-english/admission-criteria/", "Jagiellonian University Medical College"]),
  p(["jagiellonian-european-studies-ba", "jagiellonian-university", "European Studies", "Bachelor", "undergraduate", "social_sciences", "https://irk.uj.edu.pl/en-gb/offer/IiJM_P_26/programme/europe.stud_s1s_P_en/"]),
  p(["kozminski-management-bsc", "kozminski-university", "Management", "Bachelor", "undergraduate", "business", "https://www.kozminski.edu.pl/en/programs/undergraduate-programs-bachelor/bachelor-management"]),
  p(["kozminski-finance-accounting-bsc", "kozminski-university", "Finance and Accounting", "Bachelor", "undergraduate", "finance", "https://www.kozminski.edu.pl/en/programs/undergraduate-programs-bachelor/bachelor-finance-and-accounting?L=560"]),
  p(["lazarski-business-economics-bsc", "lazarski-university", "Business Economics", "Bachelor", "undergraduate", "economics", "https://www.lazarski.pl/en/media/10518"]),
  p(["lazarski-international-relations-ba", "lazarski-university", "International Relations and European Studies", "Bachelor", "undergraduate", "social_sciences", "https://www.lazarski.pl/en/offer/admission/higher-education/european-studies-english-language-bachelors-degree"]),
  p(["ase-business-administration-bsc", "ase-bucharest", "Business Administration (FABIZ)", "Bachelor", "undergraduate", "business", "https://en.fabiz.ase.ro/admission/"]),
  p(["ase-applied-modern-languages-ba", "ase-bucharest", "Applied Modern Languages", "Bachelor", "undergraduate", "languages", "https://rei.ase.ro/en/academic-pragrams/applied-modern-languages/"]),
  p(["bucharest-political-science-ba", "university-of-bucharest", "Political Science", "Bachelor", "undergraduate", "political_science", "https://fsp.unibuc.ro/en/ba-admission-en/"]),
  p(["bucharest-international-relations-ba", "university-of-bucharest", "International Relations and European Studies", "Bachelor", "undergraduate", "social_sciences", "https://fsp.unibuc.ro/en/ba-admission-en/"]),
  p(["rau-business-administration-bsc", "romanian-american-university", "Business Administration", "Bachelor", "undergraduate", "business", "https://www.rau.ro/information-bachelor/?lang=en"]),
  p(["rau-psychology-bsc", "romanian-american-university", "Psychology", "Bachelor", "undergraduate", "psychology", "https://www.rau.ro/find-a-ba-program/?lang=en"]),
  p(["vienna-international-legal-studies-llb", "university-of-vienna", "International Legal Studies", "Bachelor", "undergraduate", "law", "https://studieren.univie.ac.at/en/admission/english-language-proficiency/"]),
  p(["vienna-data-science-bsc", "university-of-vienna", "Mathematical Foundations of Data Science", "Bachelor", "undergraduate", "data_science", "https://studieren.univie.ac.at/en/admission/english-language-proficiency/"]),
  p(["fhoo-global-sales-marketing-ba", "fh-upper-austria", "Global Sales and Marketing", "Bachelor", "undergraduate", "business", "https://fh-ooe.at/en/degree-programs/global-sales-and-marketing-bachelor/application-process"]),
  p(["fhoo-electrical-engineering-bsc", "fh-upper-austria", "Electrical Engineering", "Bachelor", "undergraduate", "engineering", "https://fh-ooe.at/en/degree-programs/electrical-engineering-bachelor/application-process"]),
  p(["modul-tourism-hospitality-bba", "modul-university-vienna", "Tourism and Hospitality Management", "BBA", "undergraduate", "hospitality", "https://www.modul.ac.at/study-at-mu/special-offer-spring-2026"]),
  p(["webster-business-administration-ba", "webster-vienna", "Business Administration", "BA", "undergraduate", "business", "https://webster.ac.at/admissions/"]),
  p(["webster-international-relations-ba", "webster-vienna", "International Relations", "BA", "undergraduate", "social_sciences", "https://webster.ac.at/admissions/"]),
  p(["charles-computer-science-bsc", "charles-university", "Computer Science", "BSc", "undergraduate", "computing", "https://www.mff.cuni.cz/en/admissions/admission-requirements-for-bachelor-s-programmes-in-english/2026-2027", "Faculty of Mathematics and Physics"]),
  p(["charles-liberal-arts-humanities-ba", "charles-university", "Liberal Arts and Humanities", "Bachelor", "undergraduate", "humanities", "https://fhs.cuni.cz/FHSENG-524-version1.pdf"]),
  p(["aau-business-administration-ba", "anglo-american-university", "Business Administration", "BA", "undergraduate", "business", "https://www.aauni.edu/admissions/undergraduate-admission/"]),
  p(["aau-international-relations-ba", "anglo-american-university", "International Relations", "BA", "undergraduate", "social_sciences", "https://www.aauni.edu/admissions/undergraduate-admission/"]),
  p(["bologna-economics-finance-bsc", "university-of-bologna", "Economics and Finance", "Bachelor", "undergraduate", "economics", "https://corsi.unibo.it/s/3427/p/en/programme-enrolment-requirements-deadlines-and-methods/bis-call-for-appliation-2026-27-en.pdf/%40%40download/file/BIS%2520-%2520Call%2520for%2520appliation%25202026-27%2520-%2520EN.pdf"]),
  p(["bocconi-international-economics-management-bsc", "bocconi-university", "International Economics and Management", "BSc", "undergraduate", "economics", "https://www.unibocconi.it/en/applying-bocconi/bachelor-and-law-programs/application-and-admissions/admissions"]),
  p(["bocconi-economic-social-sciences-bsc", "bocconi-university", "Economic and Social Sciences", "BSc", "undergraduate", "social_sciences", "https://www.unibocconi.it/en/applying-bocconi/bachelor-and-law-programs/application-and-admissions/admissions"]),
  p(["bocconi-mathematical-computing-ai-bsc", "bocconi-university", "Mathematical and Computing Sciences for Artificial Intelligence", "BSc", "undergraduate", "artificial_intelligence", "https://www.unibocconi.it/en/applying-bocconi/bachelor-and-law-programs/application-and-admissions/sat-and-act"]),
  p(["luiss-economics-business-bsc", "luiss-university", "Economics and Business", "BSc", "undergraduate", "economics", "https://www.luiss.it/en/orientation-and-admissions/admission-procedures/admission-bachelors-and-masters-degree-programs-law/non-eu-students"]),
  p(["luiss-politics-philosophy-economics-bsc", "luiss-university", "Politics, Philosophy and Economics", "BSc", "undergraduate", "social_sciences", "https://www.luiss.it/en/orientation-and-admissions/admission-procedures/admission-bachelors-and-masters-degree-programs-law/non-eu-students"]),
];

const countrySourceUrls: Record<string, string> = {
  latvia: "https://www.studyinlatvia.lv/admission/entrance-requirements/specific-requirements", estonia: "https://www.harno.ee/en/academic-recognition",
  poland: "https://nawa.gov.pl/en/recognition/recognition-for-academic-purposes", romania: "https://cnred.edu.ro/en/higher-education-studies/",
  austria: "https://studyinaustria.at/en/plan-your-studies/application-and-admission", czechia: "https://www.studyin.cz/plan-your-studies/recognition/",
  italy: "https://www.universitaly.it/first-steps",
};

type RankingTuple = [string, string, string, string, number, number, number, string, string];
const rankingFacts: RankingTuple[] = [
  ["rank-lu-qs-2026", "university-of-latvia", "QS", "world", 2026, 781, 790, "781–790", "https://www.lu.lv/en/about-us/ul-media/news/single/t/110010/"],
  ["rank-rtu-qs-2026", "riga-technical-university", "QS", "world", 2026, 751, 760, "751–760", "https://www.rtu.lv/en/university/rankings"],
  ["rank-rtu-qs-engineering-2026", "riga-technical-university", "QS", "Engineering & Technology", 2026, 451, 500, "451–500", "https://www.rtu.lv/en/university/rankings"],
  ["rank-tartu-the-2026", "university-of-tartu", "Times Higher Education", "world", 2026, 301, 350, "301–350", "https://ut.ee/en/rankings-surveys"],
  ["rank-taltech-qs-2027", "taltech", "QS", "world", 2027, 600, 600, "600", "https://taltech.ee/en/news/taltech-rose-35-places-qs-world-university-rankings"],
  ["rank-warsaw-qs-2026", "university-of-warsaw", "QS", "world", 2026, 271, 271, "271", "https://en.uw.edu.pl/university-of-warsaw-in-qs-world-university-rankings/"],
  ["rank-bucharest-qs-2026", "university-of-bucharest", "QS", "world", 2026, 801, 850, "801–850", "https://unibuc.ro/qs-world-university-rankings-2026-universitatea-din-bucuresti-prima-universitate-din-romania-si-in-primele-770-de-universitati-din-lume/?lang=en"],
  ["rank-vienna-qs-2027", "university-of-vienna", "QS", "world", 2027, 140, 140, "140", "https://www.univie.ac.at/en/news/press-room/press-releases/detail/university-of-vienna-ranks-in-140th-position-in-the-qs-rankings"],
  ["rank-charles-qs-2027", "charles-university", "QS", "world", 2027, 273, 273, "273", "https://cuni.cz/UK-15879.html"],
  ["rank-bologna-qs-2027", "university-of-bologna", "QS", "world", 2027, 123, 123, "123", "https://magazine.unibo.it/en/articles/qs-rankings-the-university-of-bologna-moves-up-fifteen-places-and-is-123rd-in-the-world"],
];

const sources = [
  ...countries.map((row) => ({ sourceId: `src-country-${row.countryId}`, officialUrl: countrySourceUrls[row.countryId], sourceType: "national_admissions" as const, academicYear: "2026/27", verificationStatus: "verified" as const, verificationDate: verifiedOn, auditNote: "Official national admissions or qualification-recognition guidance." })),
  ...programs.map((row) => ({ sourceId: `src-${row.programId}`, officialUrl: row.officialProgramUrl, sourceType: "program_page" as const, academicYear: row.officialProgramUrl.includes("2026") ? "2026/27" : "current", verificationStatus: "verified" as const, verificationDate: verifiedOn, auditNote: "Official programme or admissions page used during manual curation." })),
  ...rankingFacts.map((row) => ({ sourceId: `src-${row[0]}`, officialUrl: row[8], sourceType: "ranking_provider" as const, academicYear: String(row[4]), verificationStatus: "verified" as const, verificationDate: verifiedOn, auditNote: "Official institution ranking report with provider, edition and scope." })),
];

const rankings: CatalogRanking[] = rankingFacts.map(([rankingId, institutionId, provider, scope, editionYear, rankMin, rankMax, rankLabel]) => ({
  rankingId, institutionId, sourceId: `src-${rankingId}`, provider, scope, editionYear, rankMin, rankMax, rankLabel, active: true,
}));

const requirements: CatalogRequirement[] = [];
const conditions: CatalogCondition[] = [];
const addRequirement = (id: string, scopeType: CatalogRequirement["scopeType"], scopeId: string, category: CatalogRequirement["category"], sourceId: string, attribute: string, comparisonOperator: CatalogCondition["comparisonOperator"], value: boolean | number | string, unit: CatalogCondition["unit"] = "", groupOperator: CatalogCondition["groupOperator"] = "all", evidenceDocumentType: DocumentType | null = null) => {
  requirements.push({ requirementId: id, scopeType, scopeId, category, required: true, sourceId, effectiveFrom: "2026-01-01", effectiveUntil: "", overrideRequirementId: "", evidenceDocumentType, active: true });
  conditions.push({ conditionId: `${id}-condition-1`, requirementId: id, conditionGroup: `${id}-group-1`, groupOperator, attribute, comparisonOperator, numericValue: typeof value === "number" ? value : undefined, textValue: typeof value === "number" ? "" : String(value), unit });
};

for (const country of countries) addRequirement(`req-country-${country.countryId}-secondary`, "country", country.countryId, "academic_qualification", `src-country-${country.countryId}`, "secondary.completed", "eq", true);
for (const program of programs) {
  addRequirement(`req-${program.programId}-secondary`, "program", program.programId, "academic_qualification", `src-${program.programId}`, "secondary.completed", "eq", true);
  addRequirement(`req-${program.programId}-english`, "program", program.programId, "english", `src-${program.programId}`, "english.proficiency_proof", "eq", true);
}

// Only explicitly published programme-specific facts are added below.
const extra = (programId: string, suffix: string, category: CatalogRequirement["category"], attribute: string, operator: CatalogCondition["comparisonOperator"], value: number | string | boolean, unit: CatalogCondition["unit"] = "", evidenceDocumentType: DocumentType | null = null) => addRequirement(`req-${programId}-${suffix}`, "program", programId, category, `src-${programId}`, attribute, operator, value, unit, "all", evidenceDocumentType);
const academicExtra = (programId: string, suffix: string, category: "academic_qualification" | "subject_prerequisite", attribute: string, operator: CatalogCondition["comparisonOperator"], value: number | string | boolean, unit: CatalogCondition["unit"] = "") => extra(programId, suffix, category, attribute, operator, value, unit, "academic");
const ieltsExtra = (programId: string, value: number) => extra(programId, "ielts", "english", "ielts.overall", "gte", value, "ielts_band", "english_test");
academicExtra("lu-english-languages-business-ba", "average", "academic_qualification", "secondary.average", "gte", 60, "percent");
extra("lu-english-languages-business-ba", "sat", "entrance_test", "sat.total", "gte", 1200, "sat_points");
extra("lu-english-languages-business-ba", "interview", "interview", "interview.required", "eq", true);
for (const id of programs.filter((row) => row.institutionId === "riga-technical-university").map((row) => row.programId)) academicExtra(id, "average", "academic_qualification", "secondary.average", "gte", 60, "percent");
academicExtra("rtu-computer-systems-bsc", "maths", "subject_prerequisite", "grade12.subject", "includes", "mathematics");
for (const id of ["rsu-medicine-md", "rsu-dentistry-dds"]) {
  academicExtra(id, "maths", "subject_prerequisite", "grade12.subject", "includes", "mathematics");
  academicExtra(id, "science", "subject_prerequisite", "grade12.subject", "one_of", "biology|chemistry");
}
academicExtra("rsu-international-business-bsc", "maths", "subject_prerequisite", "grade12.subject", "includes", "mathematics");
for (const id of programs.filter((row) => row.institutionId === "turiba-university").map((row) => row.programId)) academicExtra(id, "average", "academic_qualification", "secondary.average", "gte", 60, "percent");
for (const id of ["turiba-business-administration-prof-bsc", "turiba-logistics-prof-bsc", "turiba-communication-prof-bsc", "turiba-tourism-prof-bsc"]) extra(id, "social-test", "entrance_test", "entrance_test.subject", "eq", "social_science");
extra("turiba-computer-systems-prof-bsc", "maths-test", "entrance_test", "entrance_test.subject", "eq", "mathematics");
for (const id of programs.filter((row) => row.institutionId === "riseba").map((row) => row.programId)) { academicExtra(id, "average", "academic_qualification", "secondary.average", "gte", 60, "percent"); extra(id, "test", "entrance_test", "entrance_test.required", "eq", true); }
extra("riseba-architecture-ba", "portfolio", "portfolio", "portfolio.pages", "eq", 12, "points");
for (const subject of ["mathematics", "biology|chemistry|physics"]) academicExtra("tartu-science-technology-bsc", `subject-${subject[0]}`, "subject_prerequisite", "grade12.subject", subject.includes("|") ? "one_of" : "includes", subject);
extra("tartu-science-technology-bsc", "test", "entrance_test", "entrance_test.required", "eq", true);
extra("tartu-science-technology-bsc", "interview", "interview", "interview.required", "eq", true);
extra("tartu-business-administration-bsc", "maths-test", "entrance_test", "entrance_test.subject", "eq", "mathematics");
for (const [id, score] of [["taltech-integrated-engineering-bsc", 60], ["taltech-international-business-bsc", 50], ["taltech-cyber-security-bsc", 60]] as const) extra(id, "test-score", "entrance_test", "entrance_exam.score", "gte", score, "percent");
academicExtra("ebs-international-business-bsc", "maths", "subject_prerequisite", "grade12.subject", "includes", "mathematics");
ieltsExtra("ebs-international-business-bsc", 6);
extra("tallinn-audiovisual-media-ba", "portfolio", "portfolio", "portfolio.required", "eq", true);
extra("tallinn-audiovisual-media-ba", "interview", "interview", "interview.weight", "eq", 35, "percent");
extra("tallinn-law-ba", "interview-score", "interview", "interview.score", "gte", 65, "percent");
academicExtra("jagiellonian-medicine-md", "subjects", "subject_prerequisite", "grade12.subject", "one_of", "biology|physics+chemistry");
extra("jagiellonian-medicine-md", "exam", "entrance_test", "entrance_test.required", "eq", true);
ieltsExtra("jagiellonian-medicine-md", 6.5);
extra("jagiellonian-european-studies-ba", "interview", "interview", "interview.required", "eq", true);
extra("kozminski-management-bsc", "points", "entrance_test", "recruitment.points", "gte", 350, "points");
for (const id of ["lazarski-business-economics-bsc", "lazarski-international-relations-ba"]) academicExtra(id, "average", "academic_qualification", "secondary.average", "gte", 55, "percent");
extra("ase-business-administration-bsc", "essay", "essay", "essay.required", "eq", true);
extra("ase-applied-modern-languages-ba", "essay", "essay", "essay.required", "eq", true);
for (const id of ["bucharest-political-science-ba", "bucharest-international-relations-ba"]) { academicExtra(id, "grade", "academic_qualification", "admission.grade", "gte", 7, "points"); extra(id, "paper", "essay", "essay.max_characters", "lte", 4000, "characters"); }
extra("rau-business-administration-bsc", "interview", "interview", "interview.required", "eq", true);
extra("rau-psychology-bsc", "test", "entrance_test", "entrance_test.subject", "eq", "psychology");
for (const id of ["vienna-international-legal-studies-llb", "vienna-data-science-bsc"]) extra(id, "english-b2", "english", "english.cefr", "gte", "B2", "cefr_level");
for (const id of ["fhoo-global-sales-marketing-ba", "fhoo-electrical-engineering-bsc"]) ieltsExtra(id, 6);
extra("fhoo-global-sales-marketing-ba", "interview", "interview", "interview.required", "eq", true);
ieltsExtra("modul-tourism-hospitality-bba", 6.5);
for (const id of ["webster-business-administration-ba", "webster-international-relations-ba"]) { academicExtra(id, "gpa", "academic_qualification", "secondary.gpa_4", "gte", 2.5, "points"); ieltsExtra(id, 6); }
extra("charles-computer-science-bsc", "sat", "entrance_test", "sat.total", "gte", 1250, "sat_points");
extra("charles-computer-science-bsc", "sat-math", "entrance_test", "sat.math", "gte", 720, "sat_points");
extra("charles-liberal-arts-humanities-ba", "test", "entrance_test", "entrance_test.name", "eq", "Scio General Academic Prerequisites");
for (const id of ["aau-business-administration-ba", "aau-international-relations-ba"]) extra(id, "interview", "interview", "interview.required", "eq", true);
extra("bologna-economics-finance-bsc", "tolc", "entrance_test", "entrance_test.name", "eq", "TOLC-E");
for (const id of ["bocconi-international-economics-management-bsc", "bocconi-economic-social-sciences-bsc", "bocconi-mathematical-computing-ai-bsc"]) extra(id, "test", "entrance_test", "entrance_test.one_of", "one_of", "Bocconi test|SAT|ACT");
extra("bocconi-mathematical-computing-ai-bsc", "sat-math", "entrance_test", "sat.math", "gte", 600, "sat_points");
for (const id of ["luiss-economics-business-bsc", "luiss-politics-philosophy-economics-bsc"]) { extra(id, "sat", "entrance_test", "sat.total", "gte", 1200, "sat_points"); extra(id, "english-b2", "english", "english.cefr", "gte", "B2", "cefr_level"); }

const reviewPolicies: CatalogManifest["reviewPolicies"] = [{ policyId: "demo-intake-documents", version: 1, baselineDocumentTypes: ["passport", "academic"], active: true }];

export const catalogManifest: CatalogManifest = { seedVersion: "europe-plus2-2026.2", countries, institutions, programs, sources, requirements, conditions, rankings, reviewPolicies };
