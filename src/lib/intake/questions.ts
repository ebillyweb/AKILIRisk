import { IntakeQuestion } from './types';

// Re-export for convenience
export type { IntakeQuestion };

export const INTAKE_QUESTIONS: IntakeQuestion[] = (
  [
  {
    id: 'intake-q1',
    questionNumber: 1,
    questionText: 'Can you tell me about your family structure and the key family members involved in wealth decisions?',
    context: 'Understanding family composition helps identify stakeholders and potential dynamics that impact governance decisions.',
    recordingTips: [
      'Speak clearly and at a normal pace',
      'Include names, relationships, and ages if relevant',
      'Mention anyone who plays a role in family wealth decisions'
    ]
  },
  {
    id: 'intake-q2',
    questionNumber: 2,
    questionText: 'What formal or informal governance practices does your family currently have in place?',
    context: 'Current governance structures reveal what\'s working and what gaps need to be addressed.',
    recordingTips: [
      'Think about family meetings, councils, or committees',
      'Include both written and unwritten rules',
      'Mention any documentation like family constitutions or policies'
    ]
  },
  {
    id: 'intake-q3',
    questionNumber: 3,
    questionText: 'How are important family decisions currently made, and who is typically involved?',
    context: 'Decision-making processes directly impact family harmony and wealth preservation effectiveness.',
    recordingTips: [
      'Describe the typical flow from idea to decision',
      'Identify who has final say on different types of decisions',
      'Mention any consensus-building approaches used'
    ]
  },
  {
    id: 'intake-q4',
    questionNumber: 4,
    questionText: 'What are your primary concerns about transferring wealth to the next generation?',
    context: 'Wealth transfer concerns reveal risk priorities and help focus governance recommendations.',
    recordingTips: [
      'Be honest about your biggest worries',
      'Consider both financial and relational aspects',
      'Think about readiness, responsibility, and family dynamics'
    ]
  },
  {
    id: 'intake-q5',
    questionNumber: 5,
    questionText: 'How does your family typically handle disagreements or conflicts?',
    context: 'Conflict resolution patterns predict future challenges and inform governance structure design.',
    recordingTips: [
      'Describe both successful and unsuccessful approaches',
      'Include formal mediation if applicable',
      'Think about family communication patterns during stress'
    ]
  },
  {
    id: 'intake-q6',
    questionNumber: 6,
    questionText: 'What communication challenges exist within your family, especially around money matters?',
    context: 'Communication gaps are often the root cause of wealth-related family conflicts.',
    recordingTips: [
      'Consider different generations and their communication styles',
      'Think about topics that are difficult to discuss',
      'Mention frequency and quality of family conversations'
    ]
  },
  {
    id: 'intake-q7',
    questionNumber: 7,
    questionText: 'What succession planning have you done, and what aspects feel incomplete or concerning?',
    context: 'Succession planning status helps prioritize immediate governance needs and timeline considerations.',
    recordingTips: [
      'Include both business and family wealth succession',
      'Mention estate planning documents and their status',
      'Discuss leadership transition plans and readiness'
    ]
  },
  {
    id: 'intake-q8',
    questionNumber: 8,
    questionText: 'What risks worry you most about your family\'s wealth and relationships?',
    context: 'Risk awareness drives governance priorities and helps customize recommendations to family concerns.',
    recordingTips: [
      'Consider financial, legal, tax, and relationship risks',
      'Think about external threats and internal vulnerabilities',
      'Include both likely and worst-case scenarios'
    ]
  },
  {
    id: 'intake-q9',
    questionNumber: 9,
    questionText: 'How prepared do you feel the next generation is to handle wealth responsibility?',
    context: 'Next generation readiness assessment helps determine education needs and governance timing.',
    recordingTips: [
      'Consider financial literacy, values alignment, and maturity',
      'Think about individual differences among family members',
      'Include current involvement in wealth decisions'
    ]
  },
  {
    id: 'intake-q10',
    questionNumber: 10,
    questionText: 'What would successful family governance look like for your family in five years?',
    context: 'Vision alignment ensures governance recommendations match family goals and values.',
    recordingTips: [
      'Paint a picture of ideal family dynamics',
      'Include both structures and relationship quality',
      'Think about measurable outcomes you\'d want to see'
    ]
  },
] as const satisfies ReadonlyArray<
  Omit<IntakeQuestion, "whyThisMatters" | "answerType">
>).map((q) => ({ ...q, whyThisMatters: q.context, answerType: "fillable" }));

export const TOTAL_QUESTIONS = INTAKE_QUESTIONS.length;