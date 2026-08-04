"""Shared catalog rows for agent-server graph tests."""

COMPUTING_AREA_ID = "computing-technology"

FAMILIES = [
    {"familyId": "computer-science", "areaId": COMPUTING_AREA_ID, "name": "Computer Science", "aliases": ["computer science"]},
    {"familyId": "computer-systems", "areaId": COMPUTING_AREA_ID, "name": "Computer Systems", "aliases": ["computer systems"]},
    {"familyId": "cyber-security-engineering", "areaId": COMPUTING_AREA_ID, "name": "Cybersecurity", "aliases": ["cybersecurity"]},
    {"familyId": "data-science", "areaId": COMPUTING_AREA_ID, "name": "Data Science", "aliases": ["data science"]},
    {"familyId": "artificial-intelligence", "areaId": COMPUTING_AREA_ID, "name": "Artificial Intelligence", "aliases": ["ai"]},
]

COURSES = [
    {"courseId": "cs-lu", "familyId": "computer-science", "name": "Computer Science", "institutionName": "University of Latvia"},
    {"courseId": "cs-charles", "familyId": "computer-science", "name": "Computer Science", "institutionName": "Charles University"},
    {"courseId": "systems-rtu", "familyId": "computer-systems", "name": "Computer Systems", "institutionName": "RTU"},
    {"courseId": "cyber-taltech", "familyId": "cyber-security-engineering", "name": "Cyber Security Engineering", "institutionName": "TalTech"},
    {"courseId": "data-vienna", "familyId": "data-science", "name": "Data Science", "institutionName": "Vienna"},
    {"courseId": "ai-bocconi", "familyId": "artificial-intelligence", "name": "AI", "institutionName": "Bocconi"},
]
