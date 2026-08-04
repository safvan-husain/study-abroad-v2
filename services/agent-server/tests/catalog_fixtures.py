"""Shared catalog rows for agent-server graph tests."""

COMPUTING_AREA_ID = "computing-technology"
HEALTH_AREA_ID = "health-medicine"

FAMILIES = [
    {"familyId": "computer-science", "areaId": COMPUTING_AREA_ID, "name": "Computer Science", "aliases": ["computer science"]},
    {"familyId": "computer-systems", "areaId": COMPUTING_AREA_ID, "name": "Computer Systems", "aliases": ["computer systems"]},
    {"familyId": "cyber-security-engineering", "areaId": COMPUTING_AREA_ID, "name": "Cybersecurity", "aliases": ["cybersecurity"]},
    {"familyId": "data-science", "areaId": COMPUTING_AREA_ID, "name": "Data Science", "aliases": ["data science"]},
    {"familyId": "artificial-intelligence", "areaId": COMPUTING_AREA_ID, "name": "Artificial Intelligence", "aliases": ["ai"]},
    {"familyId": "nursing", "areaId": HEALTH_AREA_ID, "name": "Nursing", "aliases": ["nursing"]},
]

COMPUTING_FAMILIES = [row for row in FAMILIES if row["areaId"] == COMPUTING_AREA_ID]

COURSES = [
    {"courseId": "cs-lu", "familyId": "computer-science", "name": "Computer Science", "institutionId": "university-of-latvia", "institutionName": "University of Latvia", "country": "Latvia"},
    {"courseId": "cs-charles", "familyId": "computer-science", "name": "Computer Science", "institutionId": "charles-university", "institutionName": "Charles University", "country": "Czechia"},
    {"courseId": "systems-rtu", "familyId": "computer-systems", "name": "Computer Systems", "institutionId": "rtu", "institutionName": "RTU", "country": "Latvia"},
    {"courseId": "cyber-taltech", "familyId": "cyber-security-engineering", "name": "Cyber Security Engineering", "institutionId": "taltech", "institutionName": "TalTech", "country": "Estonia"},
    {"courseId": "data-vienna", "familyId": "data-science", "name": "Data Science", "institutionId": "vienna", "institutionName": "Vienna", "country": "Austria"},
    {"courseId": "ai-bocconi", "familyId": "artificial-intelligence", "name": "AI", "institutionId": "bocconi", "institutionName": "Bocconi", "country": "Italy"},
    {"courseId": "nursing-lu", "familyId": "nursing", "name": "Nursing", "institutionId": "university-of-latvia", "institutionName": "University of Latvia", "country": "Latvia"},
]

COMPUTING_COURSES = [row for row in COURSES if row["familyId"] in {family["familyId"] for family in COMPUTING_FAMILIES}]
