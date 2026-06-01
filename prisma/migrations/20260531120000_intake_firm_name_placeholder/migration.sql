-- KAN-2: first intake question should reference the assigned advisor's firm at runtime.
-- Store a placeholder in the bank; app substitutes {{firmName}} per client assignment.

UPDATE questions
SET question_text = 'How did your financial advisor describe what we do at {{firmName}}?'
WHERE section_id = '00000000-0000-0000-0001-000000000001'
  AND question_number = '1';
