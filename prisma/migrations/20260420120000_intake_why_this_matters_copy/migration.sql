-- Intake pillar questions: warmer, shorter why_this_matters copy.
-- Targets fixed section UUIDs from the platform intake bank seed (intake category).

-- Section GEN — General Discovery
UPDATE questions SET why_this_matters = 'Helps us make sure we''re speaking the same language from the start.'
WHERE section_id = '00000000-0000-0000-0001-000000000001' AND question_number = '1';

UPDATE questions SET why_this_matters = 'Tells us how much groundwork has already been laid — so we can build on it.'
WHERE section_id = '00000000-0000-0000-0001-000000000001' AND question_number = '2';

UPDATE questions SET why_this_matters = 'Helps us calibrate how involved you want to be versus how much you''d like us to carry.'
WHERE section_id = '00000000-0000-0000-0001-000000000001' AND question_number = '3';

UPDATE questions SET why_this_matters = 'A simple but revealing question — the answer tells us a lot about where to focus first.'
WHERE section_id = '00000000-0000-0000-0001-000000000001' AND question_number = '4';

UPDATE questions SET why_this_matters = 'Your instincts about risk are a great starting point for shaping the conversation.'
WHERE section_id = '00000000-0000-0000-0001-000000000001' AND question_number = '5';

UPDATE questions SET why_this_matters = 'Real experiences often reveal gaps that a checklist never would.'
WHERE section_id = '00000000-0000-0000-0001-000000000001' AND question_number = '6';

-- Section DEM — Demographic Information
UPDATE questions SET why_this_matters = 'Knowing who''s in the household helps us think about protection holistically.'
WHERE section_id = '00000000-0000-0000-0001-000000000002' AND question_number = '7';

UPDATE questions SET why_this_matters = 'Age ranges shape everything from coverage needs to estate planning priorities.'
WHERE section_id = '00000000-0000-0000-0001-000000000002' AND question_number = '8';

UPDATE questions SET why_this_matters = 'Family members outside the home can still create exposure — it''s worth keeping them in the picture.'
WHERE section_id = '00000000-0000-0000-0001-000000000002' AND question_number = '9';

UPDATE questions SET why_this_matters = 'Your professional life often drives more risk than people expect — this helps us connect those dots.'
WHERE section_id = '00000000-0000-0000-0001-000000000002' AND question_number = '10';

UPDATE questions SET why_this_matters = 'So we can reach you quickly if something needs your attention.'
WHERE section_id = '00000000-0000-0000-0001-000000000002' AND question_number = '11';

UPDATE questions SET why_this_matters = 'So we can reach you quickly if something needs your attention.'
WHERE section_id = '00000000-0000-0000-0001-000000000002' AND question_number = '12';

-- Section LAP — Lifestyle and Asset Profile
UPDATE questions SET why_this_matters = 'Every home has its own risk profile — this gives us the full picture.'
WHERE section_id = '00000000-0000-0000-0001-000000000003' AND question_number = '13';

UPDATE questions SET why_this_matters = 'More properties means more to protect — and more to coordinate.'
WHERE section_id = '00000000-0000-0000-0001-000000000003' AND question_number = '14';

UPDATE questions SET why_this_matters = 'Location drives a lot — flood zones, wildfire risk, and insurability all vary significantly by zip code.'
WHERE section_id = '00000000-0000-0000-0001-000000000003' AND question_number = '15';

UPDATE questions SET why_this_matters = 'Coastal and wildfire areas carry unique risks that standard policies often don''t cover fully.'
WHERE section_id = '00000000-0000-0000-0001-000000000003' AND question_number = '16';

UPDATE questions SET why_this_matters = 'Staff and vendors with access to your home or systems are often an overlooked exposure.'
WHERE section_id = '00000000-0000-0000-0001-000000000003' AND question_number = '17';

UPDATE questions SET why_this_matters = 'Your digital footprint can create real-world risk — it''s worth understanding what''s out there.'
WHERE section_id = '00000000-0000-0000-0001-000000000003' AND question_number = '18';

UPDATE questions SET why_this_matters = 'Frequent travel — especially internationally — opens up a specific set of risks worth planning for.'
WHERE section_id = '00000000-0000-0000-0001-000000000003' AND question_number = '19';

-- Section PFE — Professional and Financial Exposures
UPDATE questions SET why_this_matters = 'Public-facing roles come with reputational and liability exposure that personal coverage often misses.'
WHERE section_id = '00000000-0000-0000-0001-000000000004' AND question_number = '20';

UPDATE questions SET why_this_matters = 'Board seats and business interests can create personal liability in ways that surprise people.'
WHERE section_id = '00000000-0000-0000-0001-000000000004' AND question_number = '21';

UPDATE questions SET why_this_matters = 'Company coverage rarely travels with you — knowing the gaps is half the battle.'
WHERE section_id = '00000000-0000-0000-0001-000000000004' AND question_number = '22';

UPDATE questions SET why_this_matters = 'Collections, aircraft, and watercraft need tailored coverage — standard policies often fall short.'
WHERE section_id = '00000000-0000-0000-0001-000000000004' AND question_number = '23';

UPDATE questions SET why_this_matters = 'Life changes fast — coverage that fit two years ago may have real gaps today.'
WHERE section_id = '00000000-0000-0000-0001-000000000004' AND question_number = '24';
