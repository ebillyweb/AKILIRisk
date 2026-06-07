-- Idempotent: add governance document-upload sub-questions for every parent
-- whose 3rd/4th maturity tier references documentation (answer_2 / answer_3).
-- Safe to re-run. Appends at end of section to avoid display_order collisions.

WITH to_insert AS (
  SELECT
    p.section_id,
    v.sub_number,
    p.display_order AS parent_order
  FROM questions p
  JOIN (
    VALUES
      ('00000000-0000-0000-0002-000000000001', 'A1',  'A1a'),
      ('00000000-0000-0000-0002-000000000001', 'A2',  'A2a'),
      ('00000000-0000-0000-0002-000000000001', 'A4',  'A4b'),
      ('00000000-0000-0000-0002-000000000001', 'A6',  'A6a'),
      ('00000000-0000-0000-0002-000000000002', 'B3',  'B3a'),
      ('00000000-0000-0000-0002-000000000002', 'B5',  'B5a'),
      ('00000000-0000-0000-0002-000000000003', 'C1',  'C1a'),
      ('00000000-0000-0000-0002-000000000004', 'D1',  'D1a'),
      ('00000000-0000-0000-0002-000000000004', 'D4',  'D4a'),
      ('00000000-0000-0000-0002-000000000005', 'E3',  'E3a')
  ) AS v(section_id, parent_number, sub_number)
    ON p.section_id = v.section_id::uuid AND p.question_number = v.parent_number
  WHERE p.answer_type = 'scored_0_3'
    AND (
      COALESCE(p.answer_2, '') ILIKE '%document%'
      OR COALESCE(p.answer_3, '') ILIKE '%document%'
    )
    AND NOT EXISTS (
      SELECT 1 FROM questions existing
      WHERE existing.section_id = p.section_id
        AND existing.question_number = v.sub_number
    )
),
ranked AS (
  SELECT
    section_id,
    sub_number,
    ROW_NUMBER() OVER (
      PARTITION BY section_id ORDER BY parent_order, sub_number
    ) AS insert_seq
  FROM to_insert
),
section_max AS (
  SELECT section_id, COALESCE(MAX(display_order), 0) AS max_order
  FROM questions
  GROUP BY section_id
)
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
  r.section_id,
  r.sub_number,
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
  sm.max_order + r.insert_seq
FROM ranked r
JOIN section_max sm ON sm.section_id = r.section_id
ON CONFLICT (section_id, question_number) DO UPDATE SET
  question_text = EXCLUDED.question_text,
  answer_type = EXCLUDED.answer_type,
  is_sub_question = EXCLUDED.is_sub_question,
  why_this_matters = EXCLUDED.why_this_matters,
  recommended_actions = EXCLUDED.recommended_actions;
