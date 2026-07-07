-- Akili Risk — platform question bank seed (custom intake script)
-- ============================================================
-- Prerequisites: apply Prisma migrations first (creates public.categories, sections, questions).
-- Load: npm run seed:pillar-ddl:akili
--   or: PILLAR_DDL_SEED_PATH=scripts/sql/akili-pillar-ddl-seed.sql npm run seed:pillar-ddl
--
-- CUSTOMIZE INTAKE: edit the "QUESTIONS — INTAKE" block below. Each row is one spoken
-- interview question. Columns:
--   question_text       — spoken aloud (supports {{firmName}} personalization)
--   answer_type         — fillable | yes_no | number | date | date_mm_yyyy | choice_list | ...
--   why_this_matters    — advisor tooltip + client context when set
--   recommended_actions — recording tips (one per line)
--   is_visible          — FALSE skips the question in client intake
--   display_order       — order within the section (lower = earlier)
--
-- Assessment questions (governance → reputational) are unchanged from the platform
-- default bank. Replace that section when you have your own assessment content.
--
-- INTAKE re-runs use DO UPDATE so edits here apply on repeat seed. Assessment blocks
-- still use DO NOTHING (add-only) unless you change those clauses too.
-- ============================================================

-- ============================================================
-- CATEGORIES
-- ============================================================

INSERT INTO categories (id, code, name, sheet_name, display_order, category_kind) VALUES
    ('00000000-0000-0000-0000-000000000001', 'intake',            'Intake',                    'Intake',                     1, 'INTAKE'),
    ('00000000-0000-0000-0000-000000000002', '1_governance',      'Governance',                '1_Governance',               2, 'ASSESSMENT'),
    ('00000000-0000-0000-0000-000000000003', '2_cybersecurity',   'Cybersecurity',             '2_Cybersecurity',            3, 'ASSESSMENT'),
    ('00000000-0000-0000-0000-000000000004', '3_physical',        'Physical Security',         '3_Physical Security',        4, 'ASSESSMENT'),
    ('00000000-0000-0000-0000-000000000005', '4_insurance',       'Insurance',                 '4_Insurance',                5, 'ASSESSMENT'),
    ('00000000-0000-0000-0000-000000000006', '5_geographic',      'Geographic Risk',           '5_Geographic',               6, 'ASSESSMENT'),
    ('00000000-0000-0000-0000-000000000007', '6_reputational',    'Reputational & Social Risk','6_Reputational Social Risk', 7, 'ASSESSMENT')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- SECTIONS
-- ============================================================

INSERT INTO sections (id, category_id, code, name, objective, weight_pct, display_order) VALUES

-- INTAKE
    ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', 'GEN',  'General Discovery',              NULL, NULL, 1),
    ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000001', 'DEM',  'Demographic Information',        NULL, NULL, 2),
    ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000001', 'LAP',  'Lifestyle and Asset Profile',    NULL, NULL, 3),
    ('00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0000-000000000001', 'PFE',  'Professional and Financial Exposures', NULL, NULL, 4),

-- GOVERNANCE
    ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0000-000000000002', 'A', 'Family Governance & Decision-Making', NULL, 25, 1),
    ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0000-000000000002', 'B', 'Legal & Document Infrastructure',     NULL, 25, 2),
    ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0000-000000000002', 'C', 'Wealth Education & Stewardship',      NULL, 25, 3),
    ('00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0000-000000000002', 'D', 'Reputation & Conduct Management',     NULL, 15, 4),
    ('00000000-0000-0000-0002-000000000005', '00000000-0000-0000-0000-000000000002', 'E', 'Marital & Relationship Governance',   NULL, 10, 5),

-- CYBERSECURITY
    ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0000-000000000003', 'A', 'Household Governance',         NULL, NULL, 1),
    ('00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0000-000000000003', 'B', 'Devices & Network',            NULL, NULL, 2),
    ('00000000-0000-0000-0003-000000000003', '00000000-0000-0000-0000-000000000003', 'C', 'Accounts & Access',            NULL, NULL, 3),
    ('00000000-0000-0000-0003-000000000004', '00000000-0000-0000-0000-000000000003', 'D', 'Data & Privacy',               NULL, NULL, 4),
    ('00000000-0000-0000-0003-000000000005', '00000000-0000-0000-0000-000000000003', 'E', 'Financial & Identity Risk',    NULL, NULL, 5),
    ('00000000-0000-0000-0003-000000000006', '00000000-0000-0000-0000-000000000003', 'F', 'Incident Response & Recovery', NULL, NULL, 6),

-- PHYSICAL SECURITY
    ('00000000-0000-0000-0004-000000000001', '00000000-0000-0000-0000-000000000004', 'A', 'Household Travel and Security',    NULL, NULL, 1),
    ('00000000-0000-0000-0004-000000000002', '00000000-0000-0000-0000-000000000004', 'B', 'Residence & Property',            NULL, NULL, 2),
    ('00000000-0000-0000-0004-000000000003', '00000000-0000-0000-0000-000000000004', 'C', 'Staff & Vendor Management',       NULL, NULL, 3),
    ('00000000-0000-0000-0004-000000000004', '00000000-0000-0000-0000-000000000004', 'D', 'Extended & Business Exposure',    NULL, NULL, 4),
    ('00000000-0000-0000-0004-000000000005', '00000000-0000-0000-0000-000000000004', 'E', 'Incident Management & Response',  NULL, NULL, 5),

-- INSURANCE
    ('00000000-0000-0000-0005-000000000001', '00000000-0000-0000-0000-000000000005', 'A', 'Insurance Governance & Oversight',         NULL, 25, 1),
    ('00000000-0000-0000-0005-000000000002', '00000000-0000-0000-0000-000000000005', 'B', 'Personal Coverage and Asset Alignment',    NULL, NULL, 2),
    ('00000000-0000-0000-0005-000000000003', '00000000-0000-0000-0000-000000000005', 'C', 'Business Insurance & Asset Alignment',     NULL, NULL, 3),
    ('00000000-0000-0000-0005-000000000004', '00000000-0000-0000-0000-000000000005', 'D', 'Executive & Professional Liability',       NULL, NULL, 4),
    ('00000000-0000-0000-0005-000000000005', '00000000-0000-0000-0000-000000000005', 'E', 'Non-Profit Board Service Coverage',        NULL, NULL, 5),
    ('00000000-0000-0000-0005-000000000006', '00000000-0000-0000-0000-000000000005', 'F', 'Umbrella Liability Coverage',              NULL, NULL, 6),
    ('00000000-0000-0000-0005-000000000007', '00000000-0000-0000-0000-000000000005', 'G', 'Claims History & Future Planning',         NULL, NULL, 7),

-- GEOGRAPHIC
    ('00000000-0000-0000-0006-000000000001', '00000000-0000-0000-0000-000000000006', 'A', 'Property Location & Distribution', NULL, NULL, 1),
    ('00000000-0000-0000-0006-000000000002', '00000000-0000-0000-0000-000000000006', 'B', 'Climate & Environmental Risk',     NULL, NULL, 2),
    ('00000000-0000-0000-0006-000000000003', '00000000-0000-0000-0000-000000000006', 'C', 'Infrastructure & Access Risk',     NULL, NULL, 3),
    ('00000000-0000-0000-0006-000000000004', '00000000-0000-0000-0000-000000000006', 'D', 'Insurance & Mitigation Planning',  NULL, NULL, 4),
    ('00000000-0000-0000-0006-000000000005', '00000000-0000-0000-0000-000000000006', 'E', 'Resilience & Long-Term Planning',  NULL, NULL, 5),

-- REPUTATIONAL SOCIAL RISK
    ('00000000-0000-0000-0007-000000000001', '00000000-0000-0000-0000-000000000007', '1', 'Digital Footprint & Discoverability', 'What appears when someone searches you?',       NULL, 1),
    ('00000000-0000-0000-0007-000000000002', '00000000-0000-0000-0000-000000000007', '2', 'Media & Public Narrative',            'How are you portrayed publicly?',               NULL, 2),
    ('00000000-0000-0000-0007-000000000003', '00000000-0000-0000-0000-000000000007', '3', 'Social Media Exposure',               'Evaluate tone, control, and risk across platforms', NULL, 3),
    ('00000000-0000-0000-0007-000000000004', '00000000-0000-0000-0000-000000000007', '4', 'Affiliations & Associations',         'Exposure via relationships and organizations',  NULL, 4),
    ('00000000-0000-0000-0007-000000000005', '00000000-0000-0000-0000-000000000007', '5', 'Personal Conduct & Legal Sensitivity','Latent or historical risks that could surface', NULL, 5),
    ('00000000-0000-0000-0007-000000000006', '00000000-0000-0000-0000-000000000007', '6', 'Monitoring, Controls & Preparedness', 'Ability to detect and respond to risk',         NULL, 6)
ON CONFLICT (category_id, code) DO NOTHING;

-- ============================================================
-- QUESTIONS — INTAKE  (edit this block for your Akili script)
-- ============================================================

INSERT INTO questions (section_id, question_number, question_text, answer_type, answer_0, answer_1, answer_2, answer_3, why_this_matters, recommended_actions, is_sub_question, cross_reference, display_order, is_visible) VALUES

-- General Discovery — Akili household governance intake (10 core questions)
('00000000-0000-0000-0001-000000000001', '1', 'Can you tell me about your family structure and the key family members involved in wealth decisions?', 'fillable', NULL, NULL, NULL, NULL, 'Understanding family composition helps identify stakeholders and potential dynamics that impact governance decisions.', E'Speak clearly and at a normal pace\nInclude names, relationships, and ages if relevant\nMention anyone who plays a role in family wealth decisions', FALSE, NULL, 1, TRUE),
('00000000-0000-0000-0001-000000000001', '2', 'What formal or informal governance practices does your family currently have in place?', 'fillable', NULL, NULL, NULL, NULL, 'Current governance structures reveal what''s working and what gaps need to be addressed.', E'Think about family meetings, councils, or committees\nInclude both written and unwritten rules\nMention any documentation like family constitutions or policies', FALSE, NULL, 2, TRUE),
('00000000-0000-0000-0001-000000000001', '3', 'How are important family decisions currently made, and who is typically involved?', 'fillable', NULL, NULL, NULL, NULL, 'Decision-making processes directly impact family harmony and wealth preservation effectiveness.', E'Describe the typical flow from idea to decision\nIdentify who has final say on different types of decisions\nMention any consensus-building approaches used', FALSE, NULL, 3, TRUE),
('00000000-0000-0000-0001-000000000001', '4', 'What are your primary concerns about transferring wealth to the next generation?', 'fillable', NULL, NULL, NULL, NULL, 'Wealth transfer concerns reveal risk priorities and help focus governance recommendations.', E'Be honest about your biggest worries\nConsider both financial and relational aspects\nThink about readiness, responsibility, and family dynamics', FALSE, NULL, 4, TRUE),
('00000000-0000-0000-0001-000000000001', '5', 'How does your family typically handle disagreements or conflicts?', 'fillable', NULL, NULL, NULL, NULL, 'Conflict resolution patterns predict future challenges and inform governance structure design.', E'Describe both successful and unsuccessful approaches\nInclude formal mediation if applicable\nThink about family communication patterns during stress', FALSE, NULL, 5, TRUE),
('00000000-0000-0000-0001-000000000001', '6', 'What communication challenges exist within your family, especially around money matters?', 'fillable', NULL, NULL, NULL, NULL, 'Communication gaps are often the root cause of wealth-related family conflicts.', E'Consider different generations and their communication styles\nThink about topics that are difficult to discuss\nMention frequency and quality of family conversations', FALSE, NULL, 6, TRUE),
('00000000-0000-0000-0001-000000000001', '7', 'What succession planning have you done, and what aspects feel incomplete or concerning?', 'fillable', NULL, NULL, NULL, NULL, 'Succession planning status helps prioritize immediate governance needs and timeline considerations.', E'Include both business and family wealth succession\nMention estate planning documents and their status\nDiscuss leadership transition plans and readiness', FALSE, NULL, 7, TRUE),
('00000000-0000-0000-0001-000000000001', '8', 'What risks worry you most about your family''s wealth and relationships?', 'fillable', NULL, NULL, NULL, NULL, 'Risk awareness drives governance priorities and helps customize recommendations to family concerns.', E'Consider financial, legal, tax, and relationship risks\nThink about external threats and internal vulnerabilities\nInclude both likely and worst-case scenarios', FALSE, NULL, 8, TRUE),
('00000000-0000-0000-0001-000000000001', '9', 'How prepared do you feel the next generation is to handle wealth responsibility?', 'fillable', NULL, NULL, NULL, NULL, 'Next generation readiness assessment helps determine education needs and governance timing.', E'Consider financial literacy, values alignment, and maturity\nThink about individual differences among family members\nInclude current involvement in wealth decisions', FALSE, NULL, 9, TRUE),
('00000000-0000-0000-0001-000000000001', '10', 'What would successful family governance look like for your family in five years?', 'fillable', NULL, NULL, NULL, NULL, 'Vision alignment ensures governance recommendations match family goals and values.', E'Paint a picture of ideal family dynamics\nInclude both structures and relationship quality\nThink about measurable outcomes you''d want to see', FALSE, NULL, 10, TRUE),

-- Demographic Information (hidden — family profile carries structured demographics)
('00000000-0000-0000-0001-000000000002', '11', 'Household member full names', 'fillable', NULL, NULL, NULL, NULL, NULL, NULL, FALSE, NULL, 1, FALSE),
('00000000-0000-0000-0001-000000000002', '12', 'Ages', 'fillable', NULL, NULL, NULL, NULL, NULL, NULL, FALSE, NULL, 2, FALSE),
('00000000-0000-0000-0001-000000000002', '13', 'Extended family not living in the home', 'fillable', NULL, NULL, NULL, NULL, NULL, NULL, FALSE, NULL, 3, FALSE),
('00000000-0000-0000-0001-000000000002', '14', 'Occupation or career', 'fillable', NULL, NULL, NULL, NULL, NULL, NULL, FALSE, NULL, 4, FALSE),
('00000000-0000-0000-0001-000000000002', '15', 'Primary contact phone', 'fillable', NULL, NULL, NULL, NULL, NULL, NULL, FALSE, NULL, 5, FALSE),
('00000000-0000-0000-0001-000000000002', '16', 'Primary contact email', 'fillable', NULL, NULL, NULL, NULL, NULL, NULL, FALSE, NULL, 6, FALSE),

-- Lifestyle and Asset Profile — add, remove, or edit rows as needed
('00000000-0000-0000-0001-000000000003', '17', 'Can you describe your primary residences, vacation homes, or other properties you own or lease?', 'fillable', NULL, NULL, NULL, NULL, 'Property footprint surfaces geographic, physical security, and insurance exposure.', E'Include locations at a high level\nMention how each property is used\nNote any staff or vendors with property access', FALSE, NULL, 1, TRUE),
('00000000-0000-0000-0001-000000000003', '18', 'Do you or your family travel frequently, domestically or internationally?', 'yes_no', NULL, NULL, NULL, NULL, 'Travel patterns affect physical security and cyber exposure while away from home.', NULL, FALSE, NULL, 2, TRUE),
('00000000-0000-0000-0001-000000000003', '19', 'How would you describe your household''s online presence or digital footprint?', 'fillable', NULL, NULL, NULL, NULL, 'Digital exposure connects to cyber and reputational risk areas in the assessment.', E'Mention social platforms family members use\nNote whether profiles are public or private\nInclude any public-facing roles or media presence', FALSE, NULL, 3, TRUE),

-- Professional and Financial Exposures
('00000000-0000-0000-0001-000000000004', '20', 'Does your professional role involve public visibility, board service, or fiduciary responsibilities?', 'yes_no', NULL, NULL, NULL, NULL, 'Professional exposure drives governance, insurance, and reputational priorities.', NULL, FALSE, NULL, 1, TRUE),
('00000000-0000-0000-0001-000000000004', '21', 'When was the last time your personal insurance coverages were reviewed against your current lifestyle and net worth?', 'date_mm_yyyy', NULL, NULL, NULL, NULL, 'Insurance alignment is a common gap between accumulated wealth and existing coverage.', NULL, FALSE, NULL, 2, TRUE),
('00000000-0000-0000-0001-000000000004', '22', 'How did your advisor at {{firmName}} describe what we do together in this risk assessment?', 'fillable', NULL, NULL, NULL, NULL, 'Sets expectations for the Akili intake and surfaces any misconceptions early.', E'It is fine to paraphrase what you were told\nMention what you are hoping to learn from this process', FALSE, NULL, 3, TRUE)

ON CONFLICT (section_id, question_number) DO UPDATE SET
  question_text       = EXCLUDED.question_text,
  answer_type         = EXCLUDED.answer_type,
  answer_0            = EXCLUDED.answer_0,
  answer_1            = EXCLUDED.answer_1,
  answer_2            = EXCLUDED.answer_2,
  answer_3            = EXCLUDED.answer_3,
  why_this_matters    = EXCLUDED.why_this_matters,
  recommended_actions = EXCLUDED.recommended_actions,
  display_order       = EXCLUDED.display_order,
  is_visible          = EXCLUDED.is_visible;
-- ============================================================
-- QUESTIONS — GOVERNANCE
-- ============================================================

INSERT INTO questions (section_id, question_number, question_text, answer_type, answer_0, answer_1, answer_2, answer_3, why_this_matters, recommended_actions, is_sub_question, cross_reference, display_order) VALUES

-- Section A
('00000000-0000-0000-0002-000000000001', 'A1', 'How would you describe the documentation and communication of your family''s mission, values, and governance principles?', 'scored_0_3', 'No documented mission, values, or governance principles', 'Communicated verbally only', 'Formally documented', 'Formally documented, regularly reviewed, and actively reinforced', 'Lack of shared principles increases conflict, inconsistent decisions, and erosion of legacy over time.', 'Develop or update constitution or charter to reflect family priorities and legal structures.', FALSE, NULL, 1),
('00000000-0000-0000-0002-000000000001', 'A1a', 'Please attach copies of any relevant supporting documentation, if available.', 'fillable', NULL, NULL, NULL, NULL, 'Validates existence, completeness, and currency of governance materials.', 'Review for gaps, inconsistencies, and legal alignment; update and centralize documents securely.', TRUE, NULL, 2),
('00000000-0000-0000-0002-000000000001', 'A2', 'Have you established a family governance structure (e.g., family council, board, or advisory committee)?', 'scored_0_3', 'None', 'Informal', 'Established', 'Active and documented', 'Unstructured governance relies on informal authority, creating conflict, inefficiency, and inconsistency.', 'Formalize governance body with charter, defined roles, and meeting structure.', FALSE, NULL, 3),
('00000000-0000-0000-0002-000000000001', 'A2a', 'Please attach copies of any relevant supporting documentation, if available.', 'fillable', NULL, NULL, NULL, NULL, 'Validates existence, completeness, and currency of governance materials.', 'Review for gaps, inconsistencies, and legal alignment; update and centralize documents securely.', TRUE, NULL, 4),
('00000000-0000-0000-0002-000000000001', 'A3', 'Does the family hold regular governance meetings (e.g., annual summit, quarterly check-ins)?', 'scored_0_3', 'Never', 'Inconsistent', 'Regular', 'Regular, with structured agendas and recorded minutes', 'Regular cadence is critical to proactive risk management and alignment.', 'Implement a structured calendar for governance meetings with agenda and documentation.', FALSE, NULL, 5),
('00000000-0000-0000-0002-000000000001', 'A3a', 'Describe these meetings', 'fillable', NULL, NULL, NULL, NULL, 'Helps assess effectiveness versus formality without substance.', 'Introduce structured agendas, facilitated discussions, and action tracking.', TRUE, NULL, 6),
('00000000-0000-0000-0002-000000000001', 'A3b', 'What is the frequency of meetings?', 'fillable', NULL, NULL, NULL, NULL, 'Too infrequent leads to reactive decisions; too frequent may signal dysfunction.', 'Calibrate meeting cadence to family complexity and asset profile.', TRUE, NULL, 7),
('00000000-0000-0000-0002-000000000001', 'A3c', 'When was the last meeting?', 'date', NULL, NULL, NULL, NULL, 'Long gaps indicate governance drift and latent risk accumulation.', 'Trigger governance reset or facilitated session if lapse exceeds threshold.', TRUE, NULL, 8),
('00000000-0000-0000-0002-000000000001', 'A4', 'What are your family decision-making protocols (voting rights, dispute resolution, leadership selection) and how are they documented?', 'scored_0_3', 'Undefined', 'Informal', 'Documented', 'Documented and enforced', 'Undefined rules lead to power struggles and stalled decisions.', 'Define escalation and arbitration mechanisms to reduce conflict.', FALSE, NULL, 9),
('00000000-0000-0000-0002-000000000001', 'A4a', 'Are the decision-making protocols documented?', 'yes_no', NULL, NULL, NULL, NULL, 'Undocumented rules are unenforceable and forgotten over generations.', 'Formalize protocols and integrate into family governance handbook.', TRUE, NULL, 10),
('00000000-0000-0000-0002-000000000001', 'A4b', 'Please attach copies of any relevant supporting documentation, if available.', 'fillable', NULL, NULL, NULL, NULL, 'Validates existence, completeness, and currency of governance materials.', 'Review for gaps, inconsistencies, and legal alignment; update and centralize documents securely.', TRUE, NULL, 11),
('00000000-0000-0000-0002-000000000001', 'A5', 'Are external advisors (legal, financial, risk, philanthropic) engaged for family governance matters?', 'scored_0_3', 'None', 'Reactive', 'Engaged', 'Fully integrated advisory team', 'Absence of neutral advisors increases blind spots and internal bias.', 'Make introductions to curated network of external advisors; establish engagement letters and confidentiality standards for all advisors.', FALSE, NULL, 12),
('00000000-0000-0000-0002-000000000001', 'A6', 'Has your family established agreed-upon basic dos and don''ts for what is shared internally vs. externally (press, staff, social media)? If so, are they formally documented?', 'scored_0_3', 'None', 'Verbal', 'Documented', 'Documented and staff trained', 'Reputational damage often starts with informal disclosures.', 'Create comprehensive reputation and communications policies.', FALSE, NULL, 13),
('00000000-0000-0000-0002-000000000001', 'A6a', 'Please attach copies of any relevant supporting documentation, if available.', 'fillable', NULL, NULL, NULL, NULL, 'Validates existence, completeness, and currency of governance materials.', 'Review for gaps, inconsistencies, and legal alignment; update and centralize documents securely.', TRUE, NULL, 14),

-- Section B
('00000000-0000-0000-0002-000000000002', 'B1', 'Are wills, trusts, and powers of attorney current, consistent, and legally valid across all jurisdictions?', 'scored_0_3', 'None', 'Outdated', 'Current', 'Current and valid across all jurisdictions', 'Outdated or inconsistent documents create legal ambiguity and contested estates.', 'Review and update core estate documents with legal counsel; ensure multi-jurisdictional compliance.', FALSE, NULL, 1),
('00000000-0000-0000-0002-000000000002', 'B2', 'Do you have a centralized and secure document management system?', 'scored_0_3', 'None', 'Paper-based or scattered', 'Organized', 'Encrypted digital vault', 'Loss of critical documents during emergencies or transitions creates severe legal exposure.', 'Implement a secure digital vault with tiered access controls.', FALSE, NULL, 2),
('00000000-0000-0000-0002-000000000002', 'B3', 'Have continuity protocols been established in case of sudden incapacity or death of a principal family member?', 'scored_0_3', 'Ad hoc', 'Advisor-led', 'Committee-led', 'Documented and transparent', 'Sudden events expose operational and financial paralysis risk.', 'Develop contingency plans with operational handoff and communication trees.', FALSE, NULL, 3),
('00000000-0000-0000-0002-000000000002', 'B3a', 'Please attach copies of any relevant supporting documentation, if available.', 'fillable', NULL, NULL, NULL, NULL, 'Validates existence, completeness, and currency of governance materials.', 'Review for gaps, inconsistencies, and legal alignment; update and centralize documents securely.', TRUE, NULL, 4),
('00000000-0000-0000-0002-000000000002', 'B4', 'How are next-generation members trained or mentored for financial stewardship and leadership roles?', 'scored_0_3', 'None', 'Case-by-case', 'Formal program in place', 'Reviewed and tied to development', 'Unprepared heirs increase stewardship and governance risk.', 'Build a structured leadership and education track for heirs.', FALSE, NULL, 5),
('00000000-0000-0000-0002-000000000002', 'B5', 'Is there a family emergency response plan for operational, financial, and personal continuity?', 'scored_0_3', 'None', 'Assumed', 'Documented', 'Enforced', 'Without one, families tend to respond emotionally and reactively during a crisis.', 'Develop and rehearse a comprehensive continuity plan.', FALSE, NULL, 6),
('00000000-0000-0000-0002-000000000002', 'B5a', 'Please attach copies of any relevant supporting documentation, if available.', 'fillable', NULL, NULL, NULL, NULL, 'Validates existence, completeness, and currency of governance materials.', 'Review for gaps, inconsistencies, and legal alignment; update and centralize documents securely.', TRUE, NULL, 7),

-- Section C
('00000000-0000-0000-0002-000000000003', 'C1', 'Are there family policies for how wealth, assets, or business interests are distributed or discussed with next-generation members?', 'scored_0_3', 'None', 'Informal', 'Documented', 'Documented, reviewed, and enforced', 'Unmanaged expectations create entitlement, conflict, and governance failure.', 'Develop an age-appropriate wealth education and communication strategy.', FALSE, NULL, 1),
('00000000-0000-0000-0002-000000000003', 'C1a', 'Please attach copies of any relevant supporting documentation, if available.', 'fillable', NULL, NULL, NULL, NULL, 'Validates existence, completeness, and currency of governance materials.', 'Review for gaps, inconsistencies, and legal alignment; update and centralize documents securely.', TRUE, NULL, 2),
('00000000-0000-0000-0002-000000000003', 'C2', 'Do family members understand the sources and structures of family wealth?', 'scored_0_3', 'None', 'Basic', 'Educated', 'Continuously updated', 'Informed heirs make better decisions and support governance continuity.', 'Implement structured financial literacy curriculum for all family members.', FALSE, NULL, 3),
('00000000-0000-0000-0002-000000000003', 'C3', 'Are family philanthropy and charitable giving formally governed?', 'scored_0_3', 'None', 'Ad hoc', 'Structured', 'Strategic and regularly reviewed', 'Undirected giving reduces impact, creates tax risk, and misaligns values.', 'Formalize a giving policy aligned with family values and tax strategy; include documented mission statements and giving charters.', FALSE, NULL, 4),
('00000000-0000-0000-0002-000000000003', 'C4', 'What structured allowances and accountability reviews apply to younger family members?', 'scored_0_3', 'None', 'Informal', 'Defined', 'Structured with financial education and defined limits', 'Unstructured access undermines financial discipline and development.', 'Deploy Belvedere proprietary financial education and allowance management tools.', FALSE, NULL, 5),
('00000000-0000-0000-0002-000000000003', 'C5', 'What is your family''s agreed-upon policy on gifts and loans between family members?', 'scored_0_3', 'None', 'Inconsistent', 'Standard', 'Periodic re-checks', 'Ambiguity leads to inequity, resentment, and legal issues.', 'Document and review intra-family transfers with tax and legal counsel.', FALSE, NULL, 6),

-- Section D
('00000000-0000-0000-0002-000000000004', 'D1', 'Has your family established agreed-upon basic dos and don''ts for what is shared internally vs. externally (press, staff, social media)? If so, are they formally documented?', 'scored_0_3', 'None', 'Verbal', 'Documented', 'Documented and staff trained', 'Reputational damage often starts with informal disclosures.', 'Implement a comprehensive reputation and communications policy.', FALSE, NULL, 1),
('00000000-0000-0000-0002-000000000004', 'D1a', 'Please attach copies of any relevant supporting documentation, if available.', 'fillable', NULL, NULL, NULL, NULL, 'Validates existence, completeness, and currency of governance materials.', 'Review for gaps, inconsistencies, and legal alignment; update and centralize documents securely.', TRUE, NULL, 2),
('00000000-0000-0000-0002-000000000004', 'D2', 'Is there a designated spokesperson for media, legal, or public matters?', 'scored_0_3', 'None', 'Assumed', 'Designated', 'Designated, trained, and authorized', 'Lack of a designated spokesperson increases misstatement risk.', 'Appoint and train a single designated spokesperson; connect with a vetted PR network for communications support.', FALSE, NULL, 3),
('00000000-0000-0000-0002-000000000004', 'D3', 'Are confidentiality agreements in place for household staff, advisors, and vendors?', 'scored_0_3', 'None', 'Informal', 'Standard NDAs', 'Comprehensive and actively enforced', 'Sharing confidential information with staff or vendors without NDAs in place creates significant legal and reputational exposure.', 'Standardize NDA requirements for all staff, vendors, and advisors with legal review.', FALSE, NULL, 4),
('00000000-0000-0000-0002-000000000004', 'D4', 'Are social media and digital conduct guidelines in place for family members and staff?', 'scored_0_3', 'None', 'Verbal', 'Documented', 'Documented and staff trained', 'Undocumented digital conduct norms allow inadvertent reputational exposure.', 'Create and distribute a digital conduct policy covering social media, messaging, and public statements.', FALSE, NULL, 5),
('00000000-0000-0000-0002-000000000004', 'D4a', 'Please attach copies of any relevant supporting documentation, if available.', 'fillable', NULL, NULL, NULL, NULL, 'Validates existence, completeness, and currency of governance materials.', 'Review for gaps, inconsistencies, and legal alignment; update and centralize documents securely.', TRUE, NULL, 6),
('00000000-0000-0000-0002-000000000004', 'D5', 'Are background checks required for new staff, partners, or vendors?', 'scored_0_3', 'None', 'Inconsistent', 'Standard', 'Periodic re-checks', 'Insider risk often comes from trusted but unvetted parties.', 'Mandate pre-employment screening and vendor due diligence.', FALSE, NULL, 7),

-- Section E
('00000000-0000-0000-0002-000000000005', 'E1', 'Are pre-nuptial or post-nuptial agreements standard practice for family members entering marriage?', 'scored_0_3', 'None', 'Optional', 'Expected', 'Mandatory and regularly reviewed', 'Marriage is a primary vector for asset and governance risk.', 'Establish uniform prenuptial guidelines with legal counsel; implement standardized contractual safeguards to protect against the dilution of wealth, control, and sensitive information in the event of marriage breakdown.', FALSE, NULL, 1),
('00000000-0000-0000-0002-000000000005', 'E2', 'Does the family maintain policies for cohabitation, divorce, or blended-family integration?', 'scored_0_3', 'None', 'Case-by-case', 'Defined', 'Tested', 'Lack of clarity escalates conflict and asset exposure.', 'Establish consistent frameworks for asset protection and inclusion.', FALSE, NULL, 2),
('00000000-0000-0000-0002-000000000005', 'E3', 'Is there a confidentiality policy protecting sensitive family and business information during personal transitions?', 'scored_0_3', 'None', 'Informal', 'Documented', 'Enforced', 'Personal transitions increase leakage and reputational risk.', 'Enforce NDAs upon marriage or household integration.', FALSE, NULL, 3),
('00000000-0000-0000-0002-000000000005', 'E3a', 'Please attach copies of any relevant supporting documentation, if available.', 'fillable', NULL, NULL, NULL, NULL, 'Validates existence, completeness, and currency of governance materials.', 'Review for gaps, inconsistencies, and legal alignment; update and centralize documents securely.', TRUE, NULL, 4),
('00000000-0000-0000-0002-000000000005', 'E4', 'Are there support structures (legal, counseling, mediation) for relationship transitions?', 'scored_0_3', 'None', 'Ad hoc', 'Pre-vetted', 'Embedded', 'Unmanaged transitions destabilize families and enterprises.', 'Pre-vet legal, mediation, and counseling resources.', FALSE, NULL, 5)
ON CONFLICT (section_id, question_number) DO NOTHING;

-- ============================================================
-- QUESTIONS — CYBERSECURITY
-- ============================================================

INSERT INTO questions (section_id, question_number, question_text, answer_type, answer_0, answer_1, answer_2, answer_3, why_this_matters, recommended_actions, is_sub_question, cross_reference, display_order) VALUES

-- Section A
('00000000-0000-0000-0003-000000000001', 'A1', 'Who manages passwords, devices, and updates?', 'scored_0_3', 'No ownership', 'Informal', 'Assigned', 'Centralized and audited', 'When no one is accountable, updates get skipped, passwords get reused, and small gaps compound into major exposure.', 'Designate a household cybersecurity owner or engage a managed security provider.', FALSE, NULL, 1),
('00000000-0000-0000-0003-000000000001', 'A2', 'Has your family agreed on basic dos and don''ts for online activity?', 'scored_0_3', 'None', 'Verbal', 'Documented', 'Documented and reinforced', 'Shared norms reduce accidental risk (e.g., clicking unknown links, oversharing on social media). Without alignment, the least cautious household member becomes the entry point for attackers.', 'Implement parental controls and monitoring for gaming and social platforms.', FALSE, NULL, 2),
('00000000-0000-0000-0003-000000000001', 'A2a', 'Please attach copies of any relevant supporting documentation, if available.', 'fillable', NULL, NULL, NULL, NULL, 'Validates existence, completeness, and currency of governance materials.', 'Review for gaps, inconsistencies, and legal alignment; update and centralize documents securely.', TRUE, NULL, 3),
('00000000-0000-0000-0003-000000000001', 'A3', 'Have family members received any guidance or education on how to stay safe online?', 'scored_0_3', 'None', 'One-time', 'Periodic', 'Ongoing and role-based', 'Education is one of the strongest risk reducers. Most cyber incidents exploit human behavior, not technology—training dramatically lowers susceptibility to phishing and scams.', 'Implement regular phishing and social-engineering awareness training for all family members.', FALSE, NULL, 4),
('00000000-0000-0000-0003-000000000001', 'A4', 'How familiar are family members with basic cyber risks (phishing, scams)?', 'scored_0_3', 'Low', 'Basic', 'Moderate', 'High and tested', 'This gauges vulnerability to social engineering. Low awareness increases the likelihood of financial loss, identity theft, or account takeover.', 'Conduct baseline cyber awareness assessments and tailor training accordingly.', FALSE, NULL, 5),
('00000000-0000-0000-0003-000000000001', 'A5', 'Do you have personal or family cybersecurity insurance?', 'scored_0_3', 'None', 'Exploring', 'Active policy', 'Active and aligned to risk', 'Insurance can offset financial losses, cover forensic services, and provide crisis response. Its absence means incidents may result in unplanned emergency spending and reputational damage.', 'Obtain or review a personal cyber liability policy tailored to household exposure.', FALSE, NULL, 6),
('00000000-0000-0000-0003-000000000001', 'A6', 'What additional cybersecurity practices do family members utilize while traveling domestically or internationally?', 'scored_0_3', 'None', 'Minimal', 'Defined', 'Strict protocols', 'Travel increases exposure to insecure Wi-Fi, border searches, and device theft. This question identifies gaps during the household''s highest-risk periods.', 'Establish and enforce a travel security protocol including VPN use, device encryption, and data minimization.', FALSE, NULL, 7),
('00000000-0000-0000-0003-000000000001', 'A7', 'Have you or your family members ever been the victim of phishing or social engineering scams?', 'scored_0_3', 'Frequent and unresolved', 'Occasional', 'Rare', 'None and training applied', 'Past incidents are strong predictors of future risk. This helps identify recurring patterns and whether lessons were applied—or ignored.', 'Conduct post-incident review and apply lessons to training and controls.', FALSE, NULL, 8),
('00000000-0000-0000-0003-000000000001', 'A8', 'Are staff or service providers (nannies, house managers, IT help) trained on cybersecurity, privacy, and confidentiality practices?', 'scored_0_3', 'None or unvetted', 'Basic awareness', 'Trained', 'Certified and periodically retrained', 'Third-party access without proper training is a significant insider threat vector.', 'Require cyber awareness training for all household staff with access to networks, devices, or sensitive information.', FALSE, NULL, 9),

-- ============================================================
-- QUESTIONS — CYBERSECURITY (continued from B1)
-- ============================================================

-- Section B — Devices & Network
('00000000-0000-0000-0003-000000000002', 'B1', 'Do you have an inventory of all household devices—computers, phones, tablets, smart TVs, IoT devices, and routers?', 'scored_0_3', 'None', 'Partial', 'Complete', 'Dynamic and maintained', 'You can''t protect what you don''t know exists. Unknown or forgotten devices are common attack vectors.', 'Create and maintain a full household device inventory; assign ownership for each device.', FALSE, NULL, 1),
('00000000-0000-0000-0003-000000000002', 'B2', 'Are all devices running current software updates?', 'scored_0_3', 'Outdated', 'Manual', 'Current', 'Automated and enforced', 'Updates patch known vulnerabilities. Unpatched devices are one of the easiest targets for attackers.', 'Enable automatic updates on all devices; verify compliance monthly.', FALSE, NULL, 2),
('00000000-0000-0000-0003-000000000002', 'B3', 'Are all devices set to auto-update?', 'scored_0_3', 'None', 'Some devices', 'Most devices', 'All devices', 'Manual updating fails over time. Auto-updates reduce reliance on memory and discipline.', 'Enforce auto-updates across all household devices as a baseline security standard.', FALSE, NULL, 3),
('00000000-0000-0000-0003-000000000002', 'B4', 'Are separate networks used for guests, home automation, IoT, and critical devices?', 'scored_0_3', 'None', 'Limited', 'Partially segmented', 'Fully segmented', 'Network segmentation limits damage if one device or guest network is compromised.', 'Configure separate Wi-Fi networks for work/family, guests, and IoT/smart home devices.', FALSE, NULL, 4),
('00000000-0000-0000-0003-000000000002', 'B5', 'Is antivirus/endpoint protection installed on all applicable devices?', 'scored_0_3', 'None', 'Some', 'Installed', 'Managed and regularly updated', 'Endpoint protection is a foundational layer against malware, surveillance, and unsecured networks—especially for travel and remote work.', 'Deploy managed endpoint protection and ensure VPN use on all devices during travel and remote work.', FALSE, NULL, 5),

-- Section C — Accounts & Access
('00000000-0000-0000-0003-000000000003', 'C1', 'How many online accounts exist across the household (email, banking, social media, subscriptions)?', 'scored_0_3', 'Unknown', 'Partial', 'Known', 'Fully mapped and maintained', 'Account sprawl increases risk. Every unused or forgotten account is a potential breach point.', 'Conduct a full account audit; close unused accounts and document all active ones.', FALSE, NULL, 1),
('00000000-0000-0000-0003-000000000003', 'C2', 'Are password managers used, and are they secure?', 'scored_0_3', 'Reused or weak passwords', 'Some complexity', 'Password manager in use', 'Enterprise-grade and enforced', 'Password managers reduce reuse and weak passwords—two of the biggest causes of account compromise.', 'Deploy a password manager for all family members; enforce use for all sensitive accounts.', FALSE, NULL, 2),
('00000000-0000-0000-0003-000000000003', 'C3', 'Is MFA enabled on sensitive accounts?', 'scored_0_3', 'None', 'Limited', 'Enabled on critical accounts', 'Universal and phishing-resistant MFA', 'Multi-factor authentication dramatically lowers the chance of unauthorized access, even if passwords are stolen.', 'Enable MFA on all banking, investment, and email accounts; prioritize phishing-resistant methods (hardware keys, passkeys).', FALSE, NULL, 3),
('00000000-0000-0000-0003-000000000003', 'C4', 'Who else has access to sensitive accounts (spouse, children, staff)?', 'scored_0_3', 'Uncontrolled', 'Informal', 'Defined', 'Least-privilege enforced', 'Shared access without structure creates confusion, accountability gaps, and insider risk—especially with staff or former employees.', 'Document all shared account access; apply least-privilege principles and revoke access upon staff departure.', FALSE, NULL, 4),

-- Section D — Data & Privacy
('00000000-0000-0000-0003-000000000004', 'D1', 'Are sensitive and important files backed up securely?', 'scored_0_3', 'None', 'Irregular', 'Regular', 'Automated and redundant', 'Backups protect against ransomware, device loss, and accidental deletion. Without them, recovery may be impossible.', 'Implement automated, encrypted, and offsite/cloud backups for all critical household data.', FALSE, NULL, 1),
('00000000-0000-0000-0003-000000000004', 'D2', 'How often are backups tested?', 'scored_0_3', 'Never', 'Rare', 'Periodic', 'Scheduled and validated', 'Untested backups often fail when needed. Testing confirms recovery is actually possible.', 'Schedule quarterly backup restoration tests; document results and resolve any failures immediately.', FALSE, NULL, 2),
('00000000-0000-0000-0003-000000000004', 'D3', 'Is sensitive personal data (SSN, DOB, account numbers) stored securely with controlled access?', 'scored_0_3', 'Unsecured', 'Basic', 'Secured', 'Encrypted and access-controlled', 'Sensitive data exposure enables identity theft, fraud, and account takeover.', 'Store sensitive documents in encrypted vaults with tiered access controls; eliminate insecure storage (email, unencrypted files).', FALSE, NULL, 3),
('00000000-0000-0000-0003-000000000004', 'D4', 'Are privacy settings reviewed on social media?', 'scored_0_3', 'Open or public', 'Basic', 'Reviewed', 'Strict and monitored', 'Oversharing exposes family routines, locations, relationships, and assets—fuel for social engineering and physical risk.', 'Conduct a full social media privacy audit; apply maximum appropriate privacy settings on all platforms.', FALSE, NULL, 4),

-- Section E — Financial & Identity Risk
('00000000-0000-0000-0003-000000000005', 'E1', 'Are financial alerts, identity theft monitoring, and credit monitoring enabled?', 'scored_0_3', 'None', 'Partial', 'Active', 'Real-time and centralized', 'Early detection reduces loss severity. Delayed discovery significantly increases financial and legal exposure.', 'Enable real-time transaction alerts on all financial accounts; enroll in identity theft and credit monitoring services.', FALSE, NULL, 1),
('00000000-0000-0000-0003-000000000005', 'E2', 'Is there online reputation monitoring or dark web monitoring in place?', 'scored_0_3', 'None', 'Basic', 'Active', 'Comprehensive and alert-driven', 'These tools identify compromised credentials, impersonation, or emerging reputational threats before they escalate.', 'Deploy dark web monitoring for all family member identities; set up reputation monitoring alerts.', FALSE, NULL, 2),
('00000000-0000-0000-0003-000000000005', 'E3', 'How often are bank/credit card accounts reviewed for alerts and unusual transactions, and by whom?', 'scored_0_3', 'None', 'Irregular', 'Regular', 'Segregated duties with dual review', 'Clear review responsibility prevents missed fraud and ensures alerts are acted on promptly.', 'Assign clear responsibility for regular account review; establish a minimum weekly review cadence for all financial accounts.', FALSE, NULL, 3),

-- Section F — Incident Response & Recovery
('00000000-0000-0000-0003-000000000006', 'F1', 'Is there a plan in place to freeze credit or respond to financial fraud?', 'scored_0_3', 'None', 'Informal', 'Defined', 'Documented and rehearsed', 'Speed matters. Pre-planned actions reduce panic, delays, and financial damage during an incident.', 'Document a fraud response checklist including credit freeze contacts, bank escalation numbers, and legal contacts; rehearse annually.', FALSE, NULL, 1),
('00000000-0000-0000-0003-000000000006', 'F1a', 'Please attach copies of any relevant supporting documentation, if available.', 'fillable', NULL, NULL, NULL, NULL, 'Validates existence, completeness, and currency of documented policies and materials.', 'Review for gaps, inconsistencies, and legal alignment; update and centralize documents securely.', TRUE, NULL, 2),
('00000000-0000-0000-0003-000000000006', 'F2', 'Is there a plan for lost or stolen devices?', 'scored_0_3', 'None', 'Basic', 'Defined', 'Remote wipe and tracking enabled', 'Lost devices can expose accounts and sensitive data if not quickly locked or wiped.', 'Enable remote wipe and device tracking on all household devices; document the response procedure.', FALSE, NULL, 3),
('00000000-0000-0000-0003-000000000006', 'F3', 'Is there a plan for account compromise or hacked accounts?', 'scored_0_3', 'None', 'Basic', 'Defined', 'Documented and rehearsed', 'Without a plan, account compromise leads to prolonged access by attackers and greater financial and reputational damage.', 'Develop an account compromise response playbook covering isolation, notification, and recovery steps.', FALSE, NULL, 4),
('00000000-0000-0000-0003-000000000006', 'F3a', 'Please attach copies of any relevant supporting documentation, if available.', 'fillable', NULL, NULL, NULL, NULL, 'Validates existence, completeness, and currency of documented policies and materials.', 'Review for gaps, inconsistencies, and legal alignment; update and centralize documents securely.', TRUE, NULL, 5),
('00000000-0000-0000-0003-000000000006', 'F4', 'Are backup credentials and account recovery information stored securely?', 'scored_0_3', 'Insecure', 'Basic', 'Secure', 'Encrypted and access-controlled', 'Poor storage of recovery credentials undermines all other security controls.', 'Store all recovery codes, backup credentials, and emergency access information in an encrypted vault with controlled access.', FALSE, NULL, 6),
('00000000-0000-0000-0003-000000000006', 'F5', 'Have past incidents been reviewed and lessons applied?', 'scored_0_3', 'None', 'Informal', 'Occasional', 'Formal, with continuous improvement applied', 'Failure to learn from incidents guarantees recurrence. This signals whether the household is improving its risk posture over time.', 'Conduct a formal post-incident review for every cyber event; track action items to closure.', FALSE, NULL, 7)
ON CONFLICT (section_id, question_number) DO NOTHING;

-- ============================================================
-- QUESTIONS — PHYSICAL SECURITY
-- ============================================================

INSERT INTO questions (section_id, question_number, question_text, answer_type, answer_0, answer_1, answer_2, answer_3, why_this_matters, recommended_actions, is_sub_question, cross_reference, display_order) VALUES

-- Section A — Household Travel and Security
('00000000-0000-0000-0004-000000000001', 'A1', 'Who is responsible for overall family physical security oversight?', 'scored_0_3', 'None', 'Informal', 'Assigned', 'Centralized and coordinated', 'Lack of clear accountability can lead to inconsistent security practices, gaps, and delayed response to threats. When responsibility is unclear, risks are assumed to be handled by someone else, increasing exposure during travel or emergencies.', 'Designate a primary security officer or responsible party; clarify roles and responsibilities; ensure communication channels are established.', FALSE, NULL, 1),
('00000000-0000-0000-0004-000000000001', 'A2', 'Are there security systems (cameras, alarms, access control) at all primary and secondary residences?', 'scored_0_3', 'None', 'Partial', 'Installed', 'Layered and redundant', 'Security systems deter and detect threats. Absence or inconsistency across properties creates exploitable gaps.', 'Install and maintain integrated security systems across all residences; test systems quarterly.', FALSE, NULL, 2),
('00000000-0000-0000-0004-000000000001', 'A3', 'Do family members receive personal security awareness training or briefings?', 'scored_0_3', 'None', 'One-time', 'Periodic', 'Regular and scenario-based', 'Awareness training helps family members recognize and respond to physical threats before they escalate.', 'Provide regular personal security briefings tailored to current travel destinations and threat environments.', FALSE, NULL, 3),
('00000000-0000-0000-0004-000000000001', 'A4', 'Is there a vetted secure transportation protocol for travel (domestic and international)?', 'scored_0_3', 'None', 'Ad hoc', 'Defined', 'Documented and enforced', 'Unvetted transportation is a leading source of physical security incidents during travel.', 'Establish pre-vetted transportation providers and protocols for all travel, especially international.', FALSE, NULL, 4),
('00000000-0000-0000-0004-000000000001', 'A4a', 'Please attach copies of any relevant supporting documentation, if available.', 'fillable', NULL, NULL, NULL, NULL, 'Validates existence, completeness, and currency of documented policies and materials.', 'Review for gaps, inconsistencies, and legal alignment; update and centralize documents securely.', TRUE, NULL, 5),
('00000000-0000-0000-0004-000000000001', 'A5', 'Have there been any prior security incidents (break-ins, threats, stalking, harassment)?', 'scored_0_3', 'None', 'Anecdotal', 'Logged', 'Logged and analyzed', 'Past incidents often indicate elevated or recurring risk. This helps identify patterns that need corrective controls.', 'Document all past incidents; review for patterns; adjust security measures accordingly.', FALSE, NULL, 6),

-- Section B — Residence & Property
('00000000-0000-0000-0004-000000000002', 'B1', 'Are residences equipped with intrusion detection, fire suppression, and safe rooms?', 'scored_0_3', 'None', 'Partial', 'Installed', 'Layered and redundant', 'Layered protections reduce harm from both criminal activity and environmental emergencies.', 'Install intrusion alarms, fire suppression systems, and safe rooms in high-risk residences; conduct regular drills.', FALSE, NULL, 1),
('00000000-0000-0000-0004-000000000002', 'B2', 'Are properties reviewed periodically by a security professional?', 'scored_0_3', 'Never', 'One-time', 'Periodic', 'Scheduled and risk-based', 'Threats evolve. Regular reviews ensure systems remain effective and aligned with current risk.', 'Schedule annual professional security assessments for all primary and secondary residences.', FALSE, NULL, 2),

-- Section C — Staff & Vendor Management
('00000000-0000-0000-0004-000000000003', 'C1', 'Are all household staff and vendors subject to background checks and reference verification?', 'scored_0_3', 'None', 'Informal', 'Standard', 'Comprehensive and periodic', 'Staff and vendors with unvetted access represent a primary insider threat vector.', 'Implement comprehensive background checks, reference verification, and ongoing monitoring of all personnel.', FALSE, NULL, 1),
('00000000-0000-0000-0004-000000000003', 'C2', 'Is access to residences and offices restricted and documented?', 'scored_0_3', 'Full or unrestricted access', 'Informal', 'Restricted', 'Logged with least-privilege access enforced', 'Controlled access ensures only authorized individuals can enter sensitive areas, reducing liability and exposure.', 'Implement keycard or fob systems, visitor logs, and access permission protocols; review access rights periodically.', FALSE, NULL, 2),
('00000000-0000-0000-0004-000000000003', 'C3', 'Are visitors escorted and logged during visits?', 'scored_0_3', 'None', 'Informal', 'Escorted', 'Logged and analyzed', 'Visitor management prevents unauthorized access and provides accountability if an incident occurs.', 'Require visitor sign-ins, ID verification, and escort policies for all residences and offices.', FALSE, NULL, 3),
('00000000-0000-0000-0004-000000000003', 'C4', 'Do family members or staff have panic/emergency response training?', 'scored_0_3', 'None', 'Minimal', 'Provided', 'Regular and scenario-based', 'Training enables calm, coordinated responses during high-stress events, reducing harm and confusion.', 'Provide emergency response training for staff and family, including evacuation, lockdown, and communication procedures.', FALSE, NULL, 4),
('00000000-0000-0000-0004-000000000003', 'C5', 'Is there a defined escalation process for suspicious activity or threats?', 'scored_0_3', 'None', 'Informal', 'Defined', 'Documented and enforced', 'Clear escalation paths prevent hesitation and ensure concerns are addressed before they escalate into incidents.', 'Develop clear reporting and escalation procedures for all staff; ensure all family members know who to contact.', FALSE, NULL, 5),
('00000000-0000-0000-0004-000000000003', 'C5a', 'Please attach copies of any relevant supporting documentation, if available.', 'fillable', NULL, NULL, NULL, NULL, 'Validates existence, completeness, and currency of documented policies and materials.', 'Review for gaps, inconsistencies, and legal alignment; update and centralize documents securely.', TRUE, NULL, 6),

-- Section D — Extended & Business Exposure
('00000000-0000-0000-0004-000000000004', 'D1', 'Are business activities or public roles assessed for physical security threats?', 'scored_0_3', 'None', 'Informal', 'Assessed', 'Integrated into planning', 'Business exposure can create personal security threats. Public-facing roles increase the likelihood of targeted harassment, stalking, or physical confrontation.', 'Conduct risk assessments related to business exposure; mitigate using protective measures and secure communications.', FALSE, NULL, 1),
('00000000-0000-0000-0004-000000000004', 'D2', 'Are there protocols for social media exposure and public postings regarding travel or location?', 'scored_0_3', 'None', 'Informal', 'Defined', 'Enforced and monitored', 'Real-time location sharing increases the risk of stalking, burglary, or targeted harassment.', 'Implement social media guidance; limit sharing of locations; provide staff and family training on digital privacy.', FALSE, NULL, 2),

-- Section E — Incident Management & Response
('00000000-0000-0000-0004-000000000005', 'E1', 'Is there an emergency response plan for each residence?', 'scored_0_3', 'None', 'Generic', 'Defined', 'Location-specific and tested', 'Plans reduce panic and confusion, enabling faster and more effective response during crises.', 'Develop and document comprehensive emergency response plans for each property, including roles, communication trees, and evacuation routes.', FALSE, NULL, 1),
('00000000-0000-0000-0004-000000000005', 'E2', 'Are local law enforcement contacts known and relationships established?', 'scored_0_3', 'None', 'Reactive', 'Known contacts', 'Established relationships', 'Pre-existing relationships improve response times and coordination during emergencies.', 'Maintain updated local law enforcement contacts for each property; establish professional relationships for rapid support.', FALSE, NULL, 2),
('00000000-0000-0000-0004-000000000005', 'E3', 'Are medical emergencies included in response planning?', 'scored_0_3', 'None', 'Basic', 'Included', 'Integrated and trained', 'Medical events are more likely than security incidents and require rapid, well-coordinated action.', 'Include medical protocols, emergency contacts, and first-aid resources in all security plans; train relevant staff in first aid.', FALSE, NULL, 3),
('00000000-0000-0000-0004-000000000005', 'E4', 'Are evacuation routes and assembly points identified for each property?', 'scored_0_3', 'None', 'Informal', 'Defined', 'Practiced and drilled', 'Clear routes and meeting points reduce panic and confusion during emergencies.', 'Map and post evacuation routes and assembly points at each residence; conduct annual drills.', FALSE, NULL, 4),
('00000000-0000-0000-0004-000000000005', 'E5', 'Are incidents logged and reviewed for pattern analysis?', 'scored_0_3', 'None', 'Informal', 'Logged', 'Reviewed and lessons applied', 'Pattern analysis ensures lessons are applied and prevents repeat failures.', 'Maintain detailed incident logs; conduct post-incident reviews; update security policies accordingly.', FALSE, NULL, 5)
ON CONFLICT (section_id, question_number) DO NOTHING;

-- ============================================================
-- QUESTIONS — INSURANCE
-- ============================================================

INSERT INTO questions (section_id, question_number, question_text, answer_type, answer_0, answer_1, answer_2, answer_3, why_this_matters, recommended_actions, is_sub_question, cross_reference, display_order) VALUES

-- Section A — Insurance Governance & Oversight
('00000000-0000-0000-0005-000000000001', 'A1', 'Who oversees insurance coverage across personal, business, and nonprofit activities?', 'scored_0_3', 'None', 'Informal', 'Assigned', 'Centralized and accountable', 'Clear oversight prevents fragmented coverage, duplicate policies, and gaps between personal and entity risks. Without a single accountable owner, insurance decisions tend to be reactive and inconsistent, increasing the likelihood of uncovered losses.', 'Designate a single accountable owner for all insurance oversight; document scope and responsibilities.', FALSE, NULL, 1),
('00000000-0000-0000-0005-000000000001', 'A2', 'Is there a centralized inventory of all active insurance policies?', 'scored_0_3', 'None', 'Partial', 'Complete', 'Centralized and regularly updated', 'Without a complete inventory, policies lapse unnoticed, gaps go undetected, and claims are missed.', 'Create and maintain a master policy register including carrier, policy number, limits, renewal dates, and covered entities.', FALSE, NULL, 2),
('00000000-0000-0000-0005-000000000001', 'A3', 'Are insurance structures aligned with ownership entities (trusts, LLCs, etc.)?', 'scored_0_3', 'Misaligned', 'Some alignment', 'Aligned', 'Cross-checked and coordinated', 'Misalignment between entity structures and insurance can invalidate coverage or create unintended liability exposure. Coordination ensures policies respond as intended in a claim scenario.', 'Cross-check policy ownership against entity and trust structures; coordinate changes with legal and tax advisors; flag mismatches for remediation.', FALSE, NULL, 3),
('00000000-0000-0000-0005-000000000001', 'A4', 'Is there a formal process for notifying insurers of material changes?', 'scored_0_3', 'None', 'Informal', 'Defined', 'Documented and enforced', 'Failure to disclose changes (new assets, drivers, activities, residences) is a common reason for denied claims. A formal process protects coverage integrity.', 'Define what constitutes a material change; assign responsibility for notifications; maintain evidence of all disclosures.', FALSE, NULL, 4),
('00000000-0000-0000-0005-000000000001', 'A4a', 'Please attach copies of any relevant supporting documentation, if available.', 'fillable', NULL, NULL, NULL, NULL, 'Validates existence, completeness, and currency of documented policies and materials.', 'Review for gaps, inconsistencies, and legal alignment; update and centralize documents securely.', TRUE, NULL, 5),

-- Section B — Personal Coverage and Asset Alignment
('00000000-0000-0000-0005-000000000002', 'B1', 'Do you have copies of all personal insurance policies compiled and organized?', 'scored_0_3', 'None', 'Partial', 'Complete', 'Centralized and digitized', 'Policy review confirms actual coverage terms, exclusions, and limits—summaries alone often omit critical restrictions that affect claim outcomes.', 'Collect declarations pages and endorsements; validate active status and limits; confirm named insured accuracy.', FALSE, NULL, 1),
('00000000-0000-0000-0005-000000000002', 'B2', 'Are your residences insured in a manner consistent with their ownership structure (individual, trust, LLC)?', 'scored_0_3', 'Misaligned', 'Some alignment', 'Mostly aligned', 'Fully aligned and reviewed', 'Incorrectly titled insurance can result in partial or total denial of property or liability claims.', 'Compare property title to policy named insured; correct misalignments with broker and legal counsel.', FALSE, NULL, 2),
('00000000-0000-0000-0005-000000000002', 'B3', 'Are scheduled personal property, art, jewelry, and collectibles properly valued and insured?', 'scored_0_3', 'Unknown or unscheduled', 'Partial', 'Scheduled', 'Regularly appraised and updated', 'Unscheduled valuables are often underinsured or excluded entirely, leading to significant unrecoverable losses.', 'Inventory all valuables exceeding sublimits; schedule items individually where required; confirm valuation and appraisal currency.', FALSE, NULL, 3),
('00000000-0000-0000-0005-000000000002', 'B4', 'Is umbrella or excess liability coverage in place and comprehensive?', 'scored_0_3', 'None', 'Basic', 'Adequate', 'Stress-tested', 'Primary policies rarely provide sufficient limits for high-net-worth exposure. Umbrella coverage protects against catastrophic liability claims.', 'Confirm umbrella sits over all underlying policies; validate limits relative to net worth and exposure; identify any excluded entities or assets.', FALSE, NULL, 4),
('00000000-0000-0000-0005-000000000002', 'B5', 'Where are your insurance policies stored—electronically, physically, or both?', 'scored_0_3', 'Unknown or missing', 'Scattered', 'Organized', 'Secure and immediately accessible', 'Immediate access is critical during claims or emergencies. Poor documentation increases delays, confusion, and financial exposure.', 'Print physical copies and store in a fireproof safe; maintain electronic copies on a private secure drive with access controls.', FALSE, NULL, 5),
('00000000-0000-0000-0005-000000000002', 'B6', 'Do you track insurance renewals, premium changes, and policy updates? Is there a structured process in place?', 'scored_0_3', 'None', 'Manual', 'Structured', 'Automated and monitored', 'Missed renewals or unnoticed coverage changes can silently eliminate protection without awareness.', 'Set an annual schedule to review all insurance coverages; consider consolidating renewal dates; use calendar reminders or broker alerts.', FALSE, NULL, 6),

-- Section C — Business Insurance & Asset Alignment
('00000000-0000-0000-0005-000000000003', 'C1', 'Do you have insurance policies compiled for each operating entity?', 'scored_0_3', 'Missing', 'Partial', 'Complete', 'Optimized by risk', 'Entity-specific policies confirm that business risks are isolated properly and not unintentionally pushed onto personal coverage.', 'Collect declarations pages and endorsements for each entity; validate active status; confirm named insured accuracy.', FALSE, NULL, 1),
('00000000-0000-0000-0005-000000000003', 'C2', 'Are GL, professional liability, cyber, EPLI, and D&O coverages in place where applicable?', 'scored_0_3', 'None', 'Partial', 'Implemented', 'Compliant, documented, and audited', 'Failure to follow governance formalities can weaken liability protections and D&O coverage enforceability.', 'Review operating agreements and state requirements to ensure compliance; execute corrective tasks if out of compliance; set an annual review schedule.', FALSE, NULL, 2),
('00000000-0000-0000-0005-000000000003', 'C2a', 'Please attach copies of any relevant supporting documentation, if available.', 'fillable', NULL, NULL, NULL, NULL, 'Validates existence, completeness, and currency of documented policies and materials.', 'Review for gaps, inconsistencies, and legal alignment; update and centralize documents securely.', TRUE, NULL, 3),
('00000000-0000-0000-0005-000000000003', 'C3', 'Are shared or intercompany risks addressed?', 'scored_0_3', 'None', 'Informal', 'Addressed', 'Structured and documented', 'Intercompany exposure is often excluded unless explicitly addressed—creating hidden gaps between entities.', 'Map intercompany relationships and confirm coverage extends or is coordinated appropriately.', FALSE, NULL, 4),
('00000000-0000-0000-0005-000000000003', 'C3a', 'Please attach copies of any relevant supporting documentation, if available.', 'fillable', NULL, NULL, NULL, NULL, 'Validates existence, completeness, and currency of documented policies and materials.', 'Review for gaps, inconsistencies, and legal alignment; update and centralize documents securely.', TRUE, NULL, 5),
('00000000-0000-0000-0005-000000000003', 'C4', 'Do you have employees on your commercial auto policy? What is the process for updating the policy when someone starts or leaves?', 'scored_0_3', 'None', 'Informal', 'Defined', 'Enforced and audited', 'Unlisted drivers are a frequent cause of denied auto claims.', 'Establish an HR-triggered process to update the commercial auto policy within 24–48 hours of any driver change.', FALSE, NULL, 6),
('00000000-0000-0000-0005-000000000003', 'C5', 'If you have employees on your commercial policy, what is your process and frequency for checking their driving records?', 'scored_0_3', 'None', 'Occasional', 'Periodic', 'Continuous monitoring', 'Failure to monitor driving history increases accident risk and insurance exposure.', 'Enroll in a motor vehicle records (MVR) monitoring service for all listed drivers; review records at minimum annually.', FALSE, NULL, 7),

-- Section D — Executive & Professional Liability
('00000000-0000-0000-0005-000000000004', 'D1', 'Do you understand the scope and limitations of your company-provided D&O or professional liability coverage?', 'scored_0_3', 'None', 'Partial', 'Included', 'Reviewed and negotiated', 'Company-provided coverage is often misunderstood and may be limited, conditional, or revocable without notice.', 'Request and review the full D&O policy; clarify scope, exclusions, and tail coverage provisions.', FALSE, NULL, 1),
('00000000-0000-0000-0005-000000000004', 'D2', 'Are you named in any executive indemnification agreements or D&O policies?', 'scored_0_3', 'None', 'Partial', 'Included', 'Reviewed and negotiated', 'Executives face personal liability for decisions made in their role; gaps expose personal assets to claims.', 'Confirm named insured status and indemnification provisions; engage personal legal counsel to review terms.', FALSE, NULL, 2),
('00000000-0000-0000-0005-000000000004', 'D3', 'When does coverage terminate upon role change or retirement?', 'scored_0_3', 'Unknown', 'Unclear', 'Defined', 'Planned and portable', 'Many executives assume coverage continues post-departure when it does not, leaving a significant gap in personal liability protection.', 'Confirm termination provisions and negotiate extended reporting period (tail) coverage as part of any role transition.', FALSE, NULL, 3),
('00000000-0000-0000-0005-000000000004', 'D4', 'Do you have a company vehicle or drive your personal vehicle for work purposes?', 'scored_0_3', 'Misaligned', 'Partial', 'Aligned', 'Explicitly documented', 'Mixed-use vehicles create liability ambiguity and insurance conflicts if not structured correctly.', 'Confirm vehicle use is explicitly addressed in both personal and commercial auto policies; document any mixed-use arrangements.', FALSE, NULL, 4),
('00000000-0000-0000-0005-000000000004', 'D4a', 'Please attach copies of any relevant supporting documentation, if available.', 'fillable', NULL, NULL, NULL, NULL, 'Validates existence, completeness, and currency of documented policies and materials.', 'Review for gaps, inconsistencies, and legal alignment; update and centralize documents securely.', TRUE, NULL, 5),

-- Section E — Non-Profit Board Service Coverage
('00000000-0000-0000-0005-000000000005', 'E1', 'What nonprofit or board roles do you currently hold?', 'scored_0_3', 'None', 'Partial', 'Complete', 'Maintained and reviewed', 'Each board role creates personal liability exposure that must be individually assessed and covered.', 'Maintain a current list of all board memberships; confirm D&O coverage exists for each; assess indemnification provisions.', FALSE, NULL, 1),
('00000000-0000-0000-0005-000000000005', 'E2', 'Are coverage limits appropriate for the exposure each board role creates?', 'scored_0_3', 'Unknown', 'Assumed adequate', 'Reviewed', 'Benchmarked against exposure', 'Reputational, regulatory, and financial risks often exceed the limits of standard nonprofit D&O policies.', 'Review limits relative to the size, profile, and risk of each organization; supplement with personal excess coverage where gaps exist.', FALSE, NULL, 2),

-- Section F — Umbrella Liability Coverage
('00000000-0000-0000-0005-000000000006', 'F1', 'Is umbrella or excess liability coverage in place?', 'scored_0_3', 'None', 'Basic', 'Adequate', 'Comprehensive', 'Umbrella coverage is the primary defense against catastrophic personal lawsuits that exceed primary policy limits.', 'Confirm umbrella coverage is in place with limits commensurate with net worth and lifestyle exposure.', FALSE, NULL, 1),
('00000000-0000-0000-0005-000000000006', 'F2', 'Does umbrella coverage extend across personal, trust, and business assets?', 'scored_0_3', 'None', 'Partial', 'Integrated', 'Fully coordinated', 'Misalignment between umbrella and underlying policies can leave large asset pools completely unprotected.', 'Confirm umbrella coverage follows form over all underlying personal, trust, and entity policies; identify and close any gaps.', FALSE, NULL, 2),
('00000000-0000-0000-0005-000000000006', 'F3', 'Are there gaps between primary and excess liability layers?', 'scored_0_3', 'Significant gaps', 'Some gaps', 'Minimal gaps', 'Gaps eliminated', 'Coverage gaps between layers are common and often only discovered after a loss occurs.', 'Conduct a coordinated review of all primary and umbrella policies to identify and eliminate coverage gaps.', FALSE, NULL, 3),
('00000000-0000-0000-0005-000000000006', 'F4', 'Will there be any new drivers in the household in the next 12 months?', 'scored_0_3', 'Unmanaged', 'Aware', 'Addressed', 'Proactively managed', 'New drivers—especially young or inexperienced ones—materially increase auto and umbrella liability exposure.', 'Notify broker of any anticipated new drivers; review and adjust auto and umbrella limits as needed.', FALSE, NULL, 4),

-- Section G — Claims History & Future Planning
('00000000-0000-0000-0005-000000000007', 'G1', 'Have any claims been denied? If so, what rationale was given, and were corrective actions taken?', 'scored_0_3', 'None or unaware', 'Aware', 'Addressed', 'Systematically improved', 'Uncorrected denial causes often lead to repeat uncovered losses in future claims.', 'Document all prior denials; analyze root cause; implement corrective actions to prevent recurrence.', FALSE, NULL, 1),
('00000000-0000-0000-0005-000000000007', 'G2', 'If you have filed a claim, did you do so independently or with the assistance of a broker or agent?', 'scored_0_3', 'Filed independently, no broker', 'Inconsistent', 'Broker supported', 'Strategically managed', 'Broker involvement typically improves claim outcomes, documentation quality, and coverage interpretation.', 'Establish a standing practice of engaging your broker for all claims regardless of size.', FALSE, NULL, 2),
('00000000-0000-0000-0005-000000000007', 'G3', 'What is the family threshold for filing a claim versus self-insuring a loss?', 'scored_0_3', 'None', 'Informal', 'Defined', 'Strategically applied', 'Unclear thresholds lead to inconsistent decisions, unexpected premium increases, and strategic missteps.', 'Document a claims filing threshold policy in consultation with your broker; consider premium impact, deductibles, and loss history.', FALSE, NULL, 3),
('00000000-0000-0000-0005-000000000007', 'G4', 'Looking at your family, business, and career, do you foresee any coverage needs that don''t currently exist?', 'scored_0_3', 'No awareness', 'Limited awareness', 'Identified', 'Proactively planned', 'Insurance must anticipate future life, business, and visibility changes—not just cover today''s risks.', 'Conduct an annual forward-looking coverage needs assessment; engage broker to identify emerging exposures.', FALSE, NULL, 4)
ON CONFLICT (section_id, question_number) DO NOTHING;

-- ============================================================
-- QUESTIONS — GEOGRAPHIC RISK
-- ============================================================

INSERT INTO questions (section_id, question_number, question_text, answer_type, answer_0, answer_1, answer_2, answer_3, why_this_matters, recommended_actions, is_sub_question, cross_reference, display_order) VALUES

-- Section A — Property Location & Distribution
('00000000-0000-0000-0006-000000000001', 'A1', 'Do you maintain a complete, centralized inventory of properties you currently own or lease (primary, secondary, vacation, investment)?', 'scored_0_3', 'None', 'Partial', 'Complete', 'Centralized and maintained', 'A complete inventory is foundational to understanding aggregate geographic exposure. Undocumented properties create blind spots in insurance, emergency planning, and asset concentration risk.', 'Create and maintain a centralized property register including location, usage, ownership entity, insurance coverage, and emergency contacts. Review annually.', FALSE, NULL, 1),
('00000000-0000-0000-0006-000000000001', 'A2', 'Is there significant concentration of assets in a single region, state, or jurisdiction?', 'scored_0_3', 'High concentration, unassessed', 'Some awareness', 'Assessed', 'Strategically diversified', 'Geographic concentration amplifies correlated risk from regional disasters, regulatory changes, or economic downturns affecting multiple assets simultaneously.', 'Evaluate geographic concentration against risk thresholds; identify diversification options for future acquisitions.', FALSE, NULL, 2),
('00000000-0000-0000-0006-000000000001', 'A3', 'Are international properties or holdings subject to geopolitical or regulatory risk assessment?', 'scored_0_3', 'Unknown', 'Anecdotal', 'Assessed', 'Monitored with contingency plans', 'Political and civil risk can affect personal safety, access, insurability, property values, and the ability to exit or liquidate assets.', 'Implement enhanced travel security protocols, exit strategies, and insurance review for affected regions; reassess holding strategy if instability increases.', FALSE, NULL, 3),

-- Section B — Climate & Environmental Risk
('00000000-0000-0000-0006-000000000002', 'B1', 'Are floodplain and elevation maps reviewed before property purchase or construction?', 'scored_0_3', 'None', 'Basic awareness', 'Reviewed', 'Integrated into all decisions', 'Flood risk is frequently underestimated and often excluded from standard insurance policies, making it a leading cause of uninsured loss.', 'Mandate flood modeling and elevation analysis prior to purchase or renovation; secure flood insurance; elevate or flood-proof structures where feasible.', FALSE, NULL, 1),
('00000000-0000-0000-0006-000000000002', 'B2', 'Is wildfire risk mitigated through defensible space and vegetation management?', 'scored_0_3', 'None', 'Minimal', 'Implemented', 'Maintained and regularly inspected', 'Wildfire losses escalate rapidly and often overwhelm emergency response. Proactive mitigation materially reduces loss severity and may reduce insurance premiums.', 'Establish defensible space standards; use fire-resistant materials; engage annual vegetation management services.', FALSE, NULL, 2),
('00000000-0000-0000-0006-000000000002', 'B3', 'Are storm surge, wind, or hail exposures mitigated through construction standards or retrofits?', 'scored_0_3', 'None', 'Partial', 'Implemented', 'Engineered and regularly upgraded', 'Structural resilience determines whether a property survives or sustains catastrophic loss during an extreme weather event.', 'Assess structural resilience for each property relative to its regional hazard profile; invest in code-exceeding retrofits where warranted.', FALSE, NULL, 3)
ON CONFLICT (section_id, question_number) DO NOTHING;

-- ============================================================
-- PATCH: Geographic Risk — Sections C, D, E (missing questions)
-- Matches section UUIDs already defined in the schema
-- ============================================================

INSERT INTO questions (
    section_id, question_number, question_text, answer_type,
    answer_0, answer_1, answer_2, answer_3,
    why_this_matters, recommended_actions,
    is_sub_question, cross_reference, display_order
) VALUES

-- ============================================================
-- SECTION C — Infrastructure & Access Risk
-- section_id = '00000000-0000-0000-0006-000000000003'
-- ============================================================
(
    '00000000-0000-0000-0006-000000000003', 'C1',
    'Are critical infrastructure risks (power, water, internet, transportation) assessed for each property?',
    'scored_0_3',
    'None', 'Informal', 'Formally assessed', 'Documented and regularly updated',
    'Infrastructure fragility increases the likelihood of prolonged outages and isolation during emergencies.',
    'Conduct infrastructure dependency assessments for each property and prioritize mitigation for single-point-of-failure risks.',
    FALSE, NULL, 1
),
(
    '00000000-0000-0000-0006-000000000003', 'C2',
    'Are backup power systems (generators, batteries) available and tested regularly?',
    'scored_0_3',
    'None', 'Portable or basic only', 'Installed', 'Redundant and tested',
    'Backup systems that fail when needed create a false sense of security and increase risk to safety, property, and continuity.',
    'Install generators or battery systems where needed and test them at least semi-annually under load conditions.',
    FALSE, NULL, 2
),
(
    '00000000-0000-0000-0006-000000000003', 'C3',
    'Are properties accessible during emergencies (fire, flood, civil unrest)?',
    'scored_0_3',
    'Unreliable', 'Limited', 'Accessible', 'Assured under multiple scenarios',
    'Limited access can prevent evacuation, emergency response, or timely repairs, escalating both safety and financial risk.',
    'Map evacuation routes, identify access constraints, and coordinate with local authorities where access is limited.',
    FALSE, NULL, 3
),
(
    '00000000-0000-0000-0006-000000000003', 'C4',
    'Is the emergency response time from fire, police, and medical services known for each property?',
    'scored_0_3',
    'Unknown', 'General estimate', 'Known', 'Verified and planned around',
    'Long response times require greater self-sufficiency and preparedness to reduce loss severity.',
    'Document response times for each property and adjust preparedness levels (on-site equipment, training, staffing) accordingly.',
    FALSE, NULL, 4
),
(
    '00000000-0000-0000-0006-000000000003', 'C5',
    'Is there redundancy for essential utilities or supply routes?',
    'scored_0_3',
    'None', 'Minimal', 'Available', 'Redundant and diversified',
    'Single points of failure increase vulnerability during regional disruptions.',
    'Add redundancy for water, fuel, internet, and critical supplies where outages would materially impact safety or operations.',
    FALSE, NULL, 5
),

-- ============================================================
-- SECTION D — Insurance & Mitigation Planning
-- section_id = '00000000-0000-0000-0006-000000000004'
-- ============================================================
(
    '00000000-0000-0000-0006-000000000004', 'D1',
    'Are appropriate insurance policies in place for geographic-specific hazards (flood, earthquake, windstorm, wildfire)?',
    'scored_0_3',
    'None', 'Partial', 'In place', 'Comprehensive and coordinated',
    'Standard property policies often exclude geographic-specific hazards, leading to uncovered losses.',
    'Review coverage annually to confirm inclusion of flood, earthquake, wildfire, windstorm, or specialty policies as required by each property''s location.',
    FALSE, NULL, 1
),
(
    '00000000-0000-0000-0006-000000000004', 'D2',
    'Are insurance coverage limits aligned with current asset value and regional risk levels?',
    'scored_0_3',
    'Misaligned', 'Some alignment', 'Aligned', 'Stress-tested against worst-case scenarios',
    'Underinsurance is common in high-risk areas due to rising replacement costs and policy sublimits.',
    'Update replacement cost valuations regularly and stress-test limits against worst-case regional loss scenarios.',
    FALSE, NULL, 2
),
(
    '00000000-0000-0000-0006-000000000004', 'D3',
    'Are mitigation investments (storm shutters, fireproof roofing, drainage systems) documented?',
    'scored_0_3',
    'None', 'Ad hoc', 'Implemented', 'Documented and optimized',
    'Documentation supports underwriting, premium reductions, and faster claims resolution after an event.',
    'Maintain a mitigation log with photos, invoices, and inspection reports to support underwriting and claims.',
    FALSE, NULL, 3
),
(
    '00000000-0000-0000-0006-000000000004', 'D3a',
    'Please attach copies of any relevant supporting documentation, if available.',
    'fillable',
    NULL, NULL, NULL, NULL,
    'Validates existence, completeness, and currency of documented policies and materials.',
    'Review for gaps, inconsistencies, and legal alignment; update and centralize documents securely.',
    TRUE, NULL, 4
),
(
    '00000000-0000-0000-0006-000000000004', 'D4',
    'Are emergency funds allocated for rapid relocation or repair following a geographic event?',
    'scored_0_3',
    'None', 'Limited', 'Available', 'Pre-allocated and accessible',
    'Liquidity gaps delay response, increase displacement costs, and force reactive financial decisions.',
    'Designate and segregate liquidity specifically for relocation, repairs, or rapid response following geographic events.',
    FALSE, NULL, 5
),
(
    '00000000-0000-0000-0006-000000000004', 'D5',
    'Do you work with insurers or brokers who specialize in high-value or multi-residence portfolios?',
    'scored_0_3',
    'None', 'Generalist', 'Specialist engaged', 'Specialist and fully coordinated',
    'Specialized expertise improves coverage structure, claims advocacy, and risk modeling for complex portfolios.',
    'Work with advisors experienced in high-value, multi-location portfolios to optimize coverage structure and claims advocacy.',
    FALSE, NULL, 6
),

-- ============================================================
-- SECTION E — Resilience & Long-Term Planning
-- section_id = '00000000-0000-0000-0006-000000000005'
-- ============================================================
(
    '00000000-0000-0000-0006-000000000005', 'E1',
    'Have future climate projections been reviewed for long-term property sustainability?',
    'scored_0_3',
    'None', 'General awareness', 'Reviewed', 'Modeled into long-term strategy',
    'Long-term climate trends affect insurability, livability, resale value, and exit timing.',
    'Incorporate climate modeling into long-term hold/sell decisions and capital improvement planning.',
    FALSE, NULL, 1
),
(
    '00000000-0000-0000-0006-000000000005', 'E2',
    'Are secondary or backup residences identified for relocation if a primary property becomes uninhabitable?',
    'scored_0_3',
    'None', 'Informal', 'Identified', 'Operationalized and ready',
    'Pre-identified alternatives reduce disruption to family, business, and schooling during displacement.',
    'Pre-designate secondary locations for temporary or permanent relocation and ensure readiness (utilities, access, furnishings).',
    FALSE, NULL, 2
),
(
    '00000000-0000-0000-0006-000000000005', 'E3',
    'Are asset values stress-tested under different geographic risk scenarios?',
    'scored_0_3',
    'None', 'Limited', 'Performed', 'Ongoing scenario-based modeling',
    'Stress testing highlights concentration risk and informs diversification, divestment, or reinvestment decisions.',
    'Model downside scenarios for asset values, insurance availability, and repair timelines to inform diversification or exit strategies.',
    FALSE, NULL, 3
),
(
    '00000000-0000-0000-0006-000000000005', 'E4',
    'Are new property acquisitions subject to standardized geographic risk screening?',
    'scored_0_3',
    'None', 'Informal', 'Defined process', 'Enforced as a prerequisite',
    'Consistent screening prevents incremental risk accumulation across the portfolio.',
    'Adopt a formal geographic risk checklist and approval threshold before acquiring any new property.',
    FALSE, NULL, 4
),
(
    '00000000-0000-0000-0006-000000000005', 'E5',
    'Is there an annual review or update of geographic risk exposure across the entire portfolio?',
    'scored_0_3',
    'None', 'Ad hoc', 'Annual', 'Continuous and integrated into planning',
    'Geographic risk evolves over time as climate patterns shift, regulations change, and asset values fluctuate.',
    'Schedule an annual portfolio-wide geographic risk review integrating climate data, insurance changes, and property condition assessments.',
    FALSE, NULL, 5
)
ON CONFLICT (section_id, question_number) DO NOTHING;

-- QUESTIONS — REPUTATIONAL & SOCIAL RISK
-- ============================================================

INSERT INTO questions (section_id, question_number, question_text, answer_type, answer_0, answer_1, answer_2, answer_3, why_this_matters, recommended_actions, is_sub_question, cross_reference, display_order) VALUES

-- Section 1 — Digital Footprint & Discoverability
('00000000-0000-0000-0007-000000000001', '1.1', 'Have you ever conducted a review of your online search results (Google, Bing, etc.)?', 'scored_0_3', 'Never', 'One-time', 'Periodic', 'Ongoing monitoring', 'Unknown search exposure is unmanaged risk. What exists online defines perception for anyone researching you—clients, journalists, adversaries, or counterparties.', 'Perform a full search audit across Google, Bing, and image search; document findings and prioritize remediation.', FALSE, NULL, 1),
('00000000-0000-0000-0007-000000000001', '1.2', 'Are there any search results you believe are inaccurate, outdated, or damaging? (Y/N + describe)', 'scored_0_3', 'Significant', 'Some', 'Minor', 'None', 'Inaccurate or damaging search results cause direct reputational harm and narrative distortion that compounds over time if left unaddressed.', 'Suppress, remove, or counter damaging content with authoritative positive content; engage specialist if needed.', FALSE, NULL, 2),
('00000000-0000-0000-0007-000000000001', '1.3', 'Do you control the top 5–10 search results for your name (personal site, LinkedIn, press, etc.)? (1–5 scale)', 'scale_1_5', 'None controlled', 'Limited', 'Majority controlled', 'Fully controlled', 'First-page search results define public perception for anyone researching you. Unowned results are vulnerable to negative content displacement.', 'Build and optimize owned assets including a personal website, LinkedIn profile, and press placements to dominate first-page results.', FALSE, NULL, 3),
('00000000-0000-0000-0007-000000000001', '1.4', 'Are there duplicate, outdated, or unmanaged profiles online?', 'scored_0_3', 'Many', 'Some', 'Few', 'None', 'Fragmented digital identity increases confusion, credibility risk, and the surface area for impersonation or negative association.', 'Consolidate, delete, or formally claim all online profiles; ensure consistent and current information across platforms.', FALSE, NULL, 4),
('00000000-0000-0000-0007-000000000001', '1.5', 'Do you own or control a personal domain/website?', 'scored_0_3', 'None', 'Domain reserved only', 'Basic site live', 'Optimized and actively maintained hub', 'Owning your personal domain is the single most important step in controlling your online narrative. Without it, others define your digital presence.', 'Secure your personal domain immediately if not owned; develop and maintain a professional personal website as a narrative anchor.', FALSE, NULL, 5),

-- Section 2 — Media & Public Narrative
('00000000-0000-0000-0007-000000000002', '2.1', 'Have you been featured in media (positive or negative) in the past 5 years?', 'scored_0_3', 'Unknown', 'Partial awareness', 'Known and cataloged', 'Fully mapped and assessed', 'Past media coverage—positive or negative—shapes current public perception and resurfaces in future searches or due diligence reviews.', 'Catalog and assess all media mentions; develop a strategy to amplify positive coverage and address or suppress negative coverage.', FALSE, NULL, 1),
('00000000-0000-0000-0007-000000000002', '2.2', 'Is there any history of negative press, controversy, or public disputes?', 'scored_0_3', 'Active unmanaged issues', 'Historical unresolved', 'Addressed', 'None', 'Latent reputational risk from past controversies can resurface at any time, especially during high-visibility events such as transactions, appointments, or litigation.', 'Develop a mitigation or response strategy for any unresolved issues; engage PR or legal counsel where needed.', FALSE, NULL, 2),
('00000000-0000-0000-0007-000000000002', '2.3', 'Is your public narrative aligned with your current professional or personal positioning? (1–5 scale)', 'scale_1_5', 'Misaligned', 'Partially aligned', 'Mostly aligned', 'Fully aligned', 'Narrative misalignment creates credibility risk and undermines trust with clients, partners, and the public.', 'Audit current public narrative against desired positioning; develop a targeted content and messaging strategy to close gaps.', FALSE, NULL, 3),
('00000000-0000-0000-0007-000000000002', '2.4', 'Are there legacy stories or content that no longer reflect your current situation?', 'scored_0_3', 'Significant legacy content', 'Some', 'Minimal', 'None', 'Old narratives distort current identity and can create confusion or reputational risk if they conflict with your current position or values.', 'Identify and update or suppress outdated content; replace with current, accurate narrative assets.', FALSE, NULL, 4),

-- Section 3 — Social Media Exposure
('00000000-0000-0000-0007-000000000003', '3.1', 'Which platforms do you actively use? (LinkedIn, X, Instagram, TikTok, etc.)', 'scored_0_3', 'Unknown or untracked', 'Broad and unmanaged', 'Defined and purposeful', 'Strategic with active governance', 'Each additional platform increases the attack surface for reputational damage, impersonation, and data exposure.', 'Inventory all platforms in use; rationalize to only those that serve a clear purpose; deactivate or delete unused accounts.', FALSE, NULL, 1),
('00000000-0000-0000-0007-000000000003', '3.2', 'Do you personally manage your social media accounts?', 'scored_0_3', 'No ownership', 'Shared or delegated without oversight', 'Controlled by self or trusted manager', 'Professionally managed with defined governance', 'Third-party or inconsistent account control increases the risk of unauthorized posts, credential theft, and off-brand content.', 'Centralize account control or establish clear governance for any delegated management; review access rights regularly.', FALSE, NULL, 2),
('00000000-0000-0000-0007-000000000003', '3.3', 'Have you ever posted content that could be viewed as controversial or polarizing?', 'scored_0_3', 'Significant content exists', 'Some content exists', 'Minimal', 'None', 'Past posts are one of the most common triggers for reputational incidents, particularly when resurfaced out of context.', 'Conduct a full historical content audit; remove or archive high-risk posts; establish a content approval process going forward.', FALSE, NULL, 3),
('00000000-0000-0000-0007-000000000003', '3.4', 'Are privacy settings consistently applied across all social media accounts?', 'scored_0_3', 'None; accounts fully public', 'Inconsistent', 'Applied', 'Strict, reviewed, and enforced', 'Public profiles expose family routines, locations, relationships, and assets—critical fuel for social engineering, physical security risks, and targeted harassment.', 'Standardize privacy controls across all platforms; review settings quarterly or after any platform updates.', FALSE, NULL, 4),
('00000000-0000-0000-0007-000000000003', '3.5', 'Do family members or close associates tag or post about you publicly?', 'scored_0_3', 'Uncontrolled', 'Limited awareness', 'Managed with guidelines', 'Fully controlled with monitoring', 'Indirect exposure through others is beyond your direct control and often overlooked. A single post by a family member can create significant reputational or physical security risk.', 'Set tagging permissions on all platforms; provide family members and close associates with social media guidance; implement monitoring.', FALSE, NULL, 5),

-- Section 4 — Affiliations & Associations
('00000000-0000-0000-0007-000000000004', '4.1', 'What board memberships, investments, or advisory roles do you currently hold?', 'scored_0_3', 'None or unknown', 'Partial list', 'Complete list', 'Continuously updated and assessed', 'Every affiliation creates potential reputational exposure through association. Unknown affiliations cannot be monitored or managed.', 'Maintain a centralized, current list of all affiliations; assess reputational exposure for each; update upon any change.', FALSE, NULL, 1),
('00000000-0000-0000-0007-000000000004', '4.2', 'Are there any affiliations with politically exposed or controversial organizations?', 'scored_0_3', 'Active high-risk affiliations', 'Potential risk present', 'Minimal exposure', 'None', 'Third-party reputational risk can transfer directly to you through association, regardless of your personal conduct.', 'Review all affiliations for reputational risk; reassess high-risk associations and consider reducing or exiting where exposure is disproportionate.', FALSE, NULL, 2),
('00000000-0000-0000-0007-000000000004', '4.3', 'Are there any partnerships or investments that could create reputational spillover?', 'scored_0_3', 'None or not assessed', 'Informal assessment', 'Structured review', 'Ongoing monitoring with defined thresholds', 'Business ties create direct reputational linkage. A partner''s scandal, failure, or controversy can become your headline.', 'Conduct reputational due diligence on all material business relationships; establish ongoing monitoring for significant partners.', FALSE, NULL, 3),

-- Section 5 — Personal Conduct & Legal Sensitivity
('00000000-0000-0000-0007-000000000005', '5.1', 'Is there any past or ongoing litigation involving you or your business?', 'scored_0_3', 'Active and unmanaged', 'Known but unaddressed', 'Managed', 'None', 'Legal matters—even those ultimately resolved in your favor—often become public narratives and can be weaponized by adversaries or journalists.', 'Document and assess all past and current litigation for public exposure risk; develop a coordinated legal and communications strategy.', FALSE, NULL, 1),
('00000000-0000-0000-0007-000000000005', '5.2', 'Are there any regulatory, compliance, or ethical investigations (past or present)?', 'scored_0_3', 'Active', 'Historical and unresolved', 'Addressed', 'None', 'Regulatory investigations carry high reputational amplification risk—even preliminary inquiries can become public and define perception before resolution.', 'Coordinate a joint legal and PR strategy for any current or potential regulatory matters; proactively manage the narrative.', FALSE, NULL, 2),
('00000000-0000-0000-0007-000000000005', '5.3', 'Are there any personal matters that could become public and impact reputation? (Y/N — optional/confidential)', 'scored_0_3', 'High exposure', 'Potential exposure', 'Limited exposure', 'None', 'Personal issues that become public—even when private in nature—can become defining reputational triggers particularly for high-profile individuals.', 'Scenario-plan for potential exposure events; develop a containment and response strategy in advance.', FALSE, NULL, 3),
('00000000-0000-0000-0007-000000000005', '5.4', 'Have you ever had content removed or suppressed online?', 'scored_0_3', 'Frequent', 'Occasional', 'Rare', 'None', 'A history of content removal indicates prior reputational issues and may signal ongoing vulnerability to similar content resurfacing.', 'Analyze the root cause of all prior removal requests; implement preventive controls to reduce recurrence.', FALSE, NULL, 4),

-- Section 6 — Monitoring, Controls & Preparedness
('00000000-0000-0000-0007-000000000006', '6.1', 'Do you actively monitor your name or brand online?', 'scored_0_3', 'None', 'Manual and occasional', 'Automated monitoring', 'Real-time with structured triage', 'Passive or absent monitoring leads to delayed response. The faster a reputational threat is detected, the more options exist to contain it.', 'Implement automated online monitoring tools or services covering name, brand, business, and key family members.', FALSE, NULL, 1),
('00000000-0000-0000-0007-000000000006', '6.2', 'Do you have Google Alerts or similar monitoring tools set up?', 'scored_0_3', 'None', 'Basic or incomplete', 'Configured', 'Comprehensive and regularly reviewed', 'Early detection of emerging mentions—positive or negative—dramatically expands the window to respond effectively before an issue escalates.', 'Set up comprehensive Google Alerts and supplementary monitoring tools for your name, business names, and key family members.', FALSE, NULL, 2),
('00000000-0000-0000-0007-000000000006', '6.3', 'Do you have a crisis communication plan?', 'scored_0_3', 'None', 'Informal', 'Defined', 'Documented, tested, and scenario-based', 'Response speed and message quality in the first hours of a reputational crisis determine its ultimate impact. Improvised responses under pressure almost always make situations worse.', 'Develop a crisis communication playbook with pre-approved messaging for likely scenarios; test with a tabletop exercise annually.', FALSE, NULL, 3),
('00000000-0000-0000-0007-000000000006', '6.3a', 'Please attach copies of any relevant supporting documentation, if available.', 'fillable', NULL, NULL, NULL, NULL, 'Validates existence, completeness, and currency of documented policies and materials.', 'Review for gaps, inconsistencies, and legal alignment; update and centralize documents securely.', TRUE, NULL, 4),
('00000000-0000-0000-0007-000000000006', '6.4', 'Do you have a PR or communications advisor available?', 'scored_0_3', 'None', 'Ad hoc only', 'Retained advisor', 'On-call and fully integrated', 'Without expert communications support, reputational incidents are typically mishandled—worsening outcomes through poor timing, messaging, or channel choices.', 'Retain or pre-qualify a PR advisor or communications firm with crisis experience; ensure they understand your profile and risk areas.', FALSE, NULL, 5),
('00000000-0000-0000-0007-000000000006', '6.5', 'Have you ever conducted a formal reputational risk audit?', 'scored_0_3', 'Never', 'One-time', 'Periodic', 'Integrated into annual risk review', 'Without a baseline audit, reputational exposure is unmeasured and unmapped—making it impossible to prioritize or remediate effectively.', 'Conduct a comprehensive reputational risk audit covering digital footprint, media history, affiliations, and legal sensitivity; repeat annually or after any major life or business event.', FALSE, NULL, 6)
ON CONFLICT (section_id, question_number) DO NOTHING;

-- Optional manual checks (run in psql / Neon SQL editor after seed):
-- SELECT c.name, COUNT(DISTINCT s.id) AS sections, COUNT(q.id) AS questions
--   FROM categories c
--   JOIN sections s ON s.category_id = c.id
--   JOIN questions q ON q.section_id = s.id
--  GROUP BY c.name, c.display_order ORDER BY c.display_order;

