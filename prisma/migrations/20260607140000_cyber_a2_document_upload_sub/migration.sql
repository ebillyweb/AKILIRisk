-- Cybersecurity A2: document-upload sub when client selects Documented tier (score >= 2).

UPDATE questions q
SET display_order = q.display_order + 1000
WHERE q.section_id = '00000000-0000-0000-0003-000000000001'::uuid;

INSERT INTO questions (
  section_id,
  question_number,
  question_text,
  answer_type,
  answer_0,
  answer_1,
  answer_2,
  answer_3,
  why_this_matters,
  recommended_actions,
  is_sub_question,
  cross_reference,
  display_order
)
SELECT
  '00000000-0000-0000-0003-000000000001'::uuid,
  'A2a',
  'Please attach copies of any relevant supporting documentation, if available.',
  'fillable',
  NULL,
  NULL,
  NULL,
  NULL,
  'Validates existence, completeness, and currency of governance materials.',
  'Review for gaps, inconsistencies, and legal alignment; update and centralize documents securely.',
  TRUE,
  NULL,
  1099
WHERE NOT EXISTS (
  SELECT 1 FROM questions
  WHERE section_id = '00000000-0000-0000-0003-000000000001'::uuid
    AND question_number = 'A2a'
)
ON CONFLICT (section_id, question_number) DO UPDATE SET
  question_text = EXCLUDED.question_text,
  answer_type = EXCLUDED.answer_type,
  is_sub_question = EXCLUDED.is_sub_question,
  why_this_matters = EXCLUDED.why_this_matters,
  recommended_actions = EXCLUDED.recommended_actions;

UPDATE questions q
SET display_order = v.new_order
FROM (
  VALUES
    ('00000000-0000-0000-0003-000000000001', 'A1',  1),
    ('00000000-0000-0000-0003-000000000001', 'A2',  2),
    ('00000000-0000-0000-0003-000000000001', 'A2a', 3),
    ('00000000-0000-0000-0003-000000000001', 'A3',  4),
    ('00000000-0000-0000-0003-000000000001', 'A4',  5),
    ('00000000-0000-0000-0003-000000000001', 'A5',  6),
    ('00000000-0000-0000-0003-000000000001', 'A6',  7),
    ('00000000-0000-0000-0003-000000000001', 'A7',  8),
    ('00000000-0000-0000-0003-000000000001', 'A8',  9)
) AS v(section_id, question_number, new_order)
WHERE q.section_id = v.section_id::uuid
  AND q.question_number = v.question_number;
