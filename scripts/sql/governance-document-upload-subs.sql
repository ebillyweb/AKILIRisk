-- Idempotent: add governance document-upload sub-questions, then renumber sections.
-- Safe to re-run. Final display_order matches belvedere-pillar-ddl-seed.sql.

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
      ('00000000-0000-0000-0002-000000000005', 'E3',  'E3a'),
      ('00000000-0000-0000-0003-000000000001', 'A2',  'A2a')
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

-- Renumber governance sections (see governance-document-upload-reorder.sql).
UPDATE questions q
SET display_order = q.display_order + 1000
FROM sections s
WHERE q.section_id = s.id
  AND s.category_id = '00000000-0000-0000-0000-000000000002'::uuid;

UPDATE questions q
SET display_order = v.new_order
FROM (
  VALUES
    ('00000000-0000-0000-0002-000000000001', 'A1',  1),
    ('00000000-0000-0000-0002-000000000001', 'A1a', 2),
    ('00000000-0000-0000-0002-000000000001', 'A2',  3),
    ('00000000-0000-0000-0002-000000000001', 'A2a', 4),
    ('00000000-0000-0000-0002-000000000001', 'A3',  5),
    ('00000000-0000-0000-0002-000000000001', 'A3a', 6),
    ('00000000-0000-0000-0002-000000000001', 'A3b', 7),
    ('00000000-0000-0000-0002-000000000001', 'A3c', 8),
    ('00000000-0000-0000-0002-000000000001', 'A4',  9),
    ('00000000-0000-0000-0002-000000000001', 'A4a', 10),
    ('00000000-0000-0000-0002-000000000001', 'A4b', 11),
    ('00000000-0000-0000-0002-000000000001', 'A5',  12),
    ('00000000-0000-0000-0002-000000000001', 'A6',  13),
    ('00000000-0000-0000-0002-000000000001', 'A6a', 14),
    ('00000000-0000-0000-0002-000000000002', 'B1',  1),
    ('00000000-0000-0000-0002-000000000002', 'B2',  2),
    ('00000000-0000-0000-0002-000000000002', 'B3',  3),
    ('00000000-0000-0000-0002-000000000002', 'B3a', 4),
    ('00000000-0000-0000-0002-000000000002', 'B4',  5),
    ('00000000-0000-0000-0002-000000000002', 'B5',  6),
    ('00000000-0000-0000-0002-000000000002', 'B5a', 7),
    ('00000000-0000-0000-0002-000000000003', 'C1',  1),
    ('00000000-0000-0000-0002-000000000003', 'C1a', 2),
    ('00000000-0000-0000-0002-000000000003', 'C2',  3),
    ('00000000-0000-0000-0002-000000000003', 'C3',  4),
    ('00000000-0000-0000-0002-000000000003', 'C4',  5),
    ('00000000-0000-0000-0002-000000000003', 'C5',  6),
    ('00000000-0000-0000-0002-000000000004', 'D1',  1),
    ('00000000-0000-0000-0002-000000000004', 'D1a', 2),
    ('00000000-0000-0000-0002-000000000004', 'D2',  3),
    ('00000000-0000-0000-0002-000000000004', 'D3',  4),
    ('00000000-0000-0000-0002-000000000004', 'D4',  5),
    ('00000000-0000-0000-0002-000000000004', 'D4a', 6),
    ('00000000-0000-0000-0002-000000000004', 'D5',  7),
    ('00000000-0000-0000-0002-000000000005', 'E1',  1),
    ('00000000-0000-0000-0002-000000000005', 'E2',  2),
    ('00000000-0000-0000-0002-000000000005', 'E3',  3),
    ('00000000-0000-0000-0002-000000000005', 'E3a', 4),
    ('00000000-0000-0000-0002-000000000005', 'E4',  5)
) AS v(section_id, question_number, new_order)
WHERE q.section_id = v.section_id::uuid
  AND q.question_number = v.question_number;
