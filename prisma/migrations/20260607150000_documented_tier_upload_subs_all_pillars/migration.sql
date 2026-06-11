-- Document-upload subs for all scored_0_3 parents whose 3rd/4th tiers reference documentation.
-- Safe reorder: assign unique high temp orders, insert subs, then set final order.

WITH affected AS (
  SELECT unnest(ARRAY[
    '00000000-0000-0000-0003-000000000006'::uuid,
    '00000000-0000-0000-0004-000000000001'::uuid,
    '00000000-0000-0000-0004-000000000003'::uuid,
    '00000000-0000-0000-0005-000000000001'::uuid,
    '00000000-0000-0000-0005-000000000003'::uuid,
    '00000000-0000-0000-0005-000000000004'::uuid,
    '00000000-0000-0000-0006-000000000004'::uuid,
    '00000000-0000-0000-0007-000000000006'::uuid
  ]) AS section_id
),
ranked AS (
  SELECT
    q.id,
    ROW_NUMBER() OVER (
      PARTITION BY q.section_id
      ORDER BY q.display_order, q.question_number NULLS LAST
    ) * 10000 AS temp_order
  FROM questions q
  INNER JOIN affected a ON a.section_id = q.section_id
)
UPDATE questions q
SET display_order = r.temp_order
FROM ranked r
WHERE q.id = r.id;

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
  v.section_id::uuid,
  v.question_number,
  'Please attach copies of any relevant supporting documentation, if available.',
  'fillable',
  NULL,
  NULL,
  NULL,
  NULL,
  'Validates existence, completeness, and currency of documented policies and materials.',
  'Review for gaps, inconsistencies, and legal alignment; update and centralize documents securely.',
  TRUE,
  NULL,
  v.temp_order
FROM (
  VALUES
    ('00000000-0000-0000-0003-000000000006', 'F1a', 95001),
    ('00000000-0000-0000-0003-000000000006', 'F3a', 95002),
    ('00000000-0000-0000-0004-000000000001', 'A4a', 95001),
    ('00000000-0000-0000-0004-000000000003', 'C5a', 95001),
    ('00000000-0000-0000-0005-000000000001', 'A4a', 95001),
    ('00000000-0000-0000-0005-000000000003', 'C2a', 95001),
    ('00000000-0000-0000-0005-000000000003', 'C3a', 95002),
    ('00000000-0000-0000-0005-000000000004', 'D4a', 95001),
    ('00000000-0000-0000-0006-000000000004', 'D3a', 95001),
    ('00000000-0000-0000-0007-000000000006', '6.3a', 95001)
) AS v(section_id, question_number, temp_order)
WHERE EXISTS (
  SELECT 1 FROM sections s WHERE s.id = v.section_id::uuid
)
AND NOT EXISTS (
  SELECT 1 FROM questions q
  WHERE q.section_id = v.section_id::uuid
    AND q.question_number = v.question_number
)
ON CONFLICT (section_id, question_number) DO UPDATE SET
  question_text = EXCLUDED.question_text,
  answer_type = EXCLUDED.answer_type,
  is_sub_question = EXCLUDED.is_sub_question,
  why_this_matters = EXCLUDED.why_this_matters,
  recommended_actions = EXCLUDED.recommended_actions;

UPDATE questions q SET display_order = v.new_order
FROM (
  VALUES
    -- Cyber F
    ('00000000-0000-0000-0003-000000000006', 'F1',  1),
    ('00000000-0000-0000-0003-000000000006', 'F1a', 2),
    ('00000000-0000-0000-0003-000000000006', 'F2',  3),
    ('00000000-0000-0000-0003-000000000006', 'F3',  4),
    ('00000000-0000-0000-0003-000000000006', 'F3a', 5),
    ('00000000-0000-0000-0003-000000000006', 'F4',  6),
    ('00000000-0000-0000-0003-000000000006', 'F5',  7),
    -- Physical A
    ('00000000-0000-0000-0004-000000000001', 'A1',  1),
    ('00000000-0000-0000-0004-000000000001', 'A2',  2),
    ('00000000-0000-0000-0004-000000000001', 'A3',  3),
    ('00000000-0000-0000-0004-000000000001', 'A4',  4),
    ('00000000-0000-0000-0004-000000000001', 'A4a', 5),
    ('00000000-0000-0000-0004-000000000001', 'A5',  6),
    -- Physical C
    ('00000000-0000-0000-0004-000000000003', 'C1',  1),
    ('00000000-0000-0000-0004-000000000003', 'C2',  2),
    ('00000000-0000-0000-0004-000000000003', 'C3',  3),
    ('00000000-0000-0000-0004-000000000003', 'C4',  4),
    ('00000000-0000-0000-0004-000000000003', 'C5',  5),
    ('00000000-0000-0000-0004-000000000003', 'C5a', 6),
    -- Insurance A
    ('00000000-0000-0000-0005-000000000001', 'A1',  1),
    ('00000000-0000-0000-0005-000000000001', 'A2',  2),
    ('00000000-0000-0000-0005-000000000001', 'A3',  3),
    ('00000000-0000-0000-0005-000000000001', 'A4',  4),
    ('00000000-0000-0000-0005-000000000001', 'A4a', 5),
    -- Insurance C
    ('00000000-0000-0000-0005-000000000003', 'C1',  1),
    ('00000000-0000-0000-0005-000000000003', 'C2',  2),
    ('00000000-0000-0000-0005-000000000003', 'C2a', 3),
    ('00000000-0000-0000-0005-000000000003', 'C3',  4),
    ('00000000-0000-0000-0005-000000000003', 'C3a', 5),
    ('00000000-0000-0000-0005-000000000003', 'C4',  6),
    ('00000000-0000-0000-0005-000000000003', 'C5',  7),
    -- Insurance D
    ('00000000-0000-0000-0005-000000000004', 'D1',  1),
    ('00000000-0000-0000-0005-000000000004', 'D2',  2),
    ('00000000-0000-0000-0005-000000000004', 'D3',  3),
    ('00000000-0000-0000-0005-000000000004', 'D4',  4),
    ('00000000-0000-0000-0005-000000000004', 'D4a', 5),
    -- Geographic D
    ('00000000-0000-0000-0006-000000000004', 'D1',  1),
    ('00000000-0000-0000-0006-000000000004', 'D2',  2),
    ('00000000-0000-0000-0006-000000000004', 'D3',  3),
    ('00000000-0000-0000-0006-000000000004', 'D3a', 4),
    ('00000000-0000-0000-0006-000000000004', 'D4',  5),
    ('00000000-0000-0000-0006-000000000004', 'D5',  6),
    -- Reputational section 6
    ('00000000-0000-0000-0007-000000000006', '6.1',  1),
    ('00000000-0000-0000-0007-000000000006', '6.2',  2),
    ('00000000-0000-0000-0007-000000000006', '6.3',  3),
    ('00000000-0000-0000-0007-000000000006', '6.3a', 4),
    ('00000000-0000-0000-0007-000000000006', '6.4',  5),
    ('00000000-0000-0000-0007-000000000006', '6.5',  6)
) AS v(section_id, question_number, new_order)
WHERE q.section_id = v.section_id::uuid
  AND q.question_number = v.question_number;
