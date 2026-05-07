/**
 * Cyber Risk Question Bank
 *
 * Questions roll up under comprehensive assessment `cybersecurity` (and access-control blocks).
 * Client worksheet sections A–F are defined in `cyber-rubric.ts` (Household governance through
 * Incident response & recovery) for roadmap alignment; this bank uses four thematic groups below.
 */

import { Question, Pillar } from '../assessment/types';
import { CYBER_PILLAR_ID } from './types';

// ============================================================================
// SUB-CATEGORY 1: DIGITAL HYGIENE (6 questions, weight: 3)
// ============================================================================

const digitalHygieneQuestions: Question[] = [
  {
    id: 'cyber-dh-01',
    text: 'Do you use a password manager to generate and store unique passwords?',
    helpText: 'Password managers create strong, unique passwords for each account.',
    type: 'maturity-scale',
    options: [
      { value: 0, label: 'No password manager', description: 'Reuse passwords across sites' },
      { value: 1, label: 'Some unique passwords', description: 'Mix of unique and reused passwords' },
      { value: 2, label: 'Password manager for most accounts', description: 'Use password manager for important accounts' },
      { value: 3, label: 'Password manager for all accounts', description: 'All passwords are unique and managed' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 5,
    scoreMap: { 0: 0, 1: 3, 2: 7, 3: 10 },
  },
  {
    id: 'cyber-dh-02',
    text: 'What is the typical length of your passwords?',
    helpText: 'Longer passwords provide exponentially better protection against attacks.',
    type: 'single-choice',
    options: [
      { value: 'short', label: '8 characters or less' },
      { value: 'medium', label: '9-12 characters' },
      { value: 'long', label: '13-16 characters' },
      { value: 'very-long', label: '17+ characters' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 3,
    scoreMap: { 'short': 0, 'medium': 3, 'long': 7, 'very-long': 10 },
    branchingRule: {
      dependsOn: 'cyber-dh-01',
      showIf: (answer) => answer !== 3,
    },
  },
  {
    id: 'cyber-dh-03',
    text: 'How often do you update the software on your devices (computer, phone, tablet)?',
    helpText: 'Software updates include critical security patches that fix vulnerabilities.',
    type: 'maturity-scale',
    options: [
      { value: 0, label: 'Rarely or never', description: 'Updates are postponed indefinitely' },
      { value: 1, label: 'When reminded multiple times', description: 'Update eventually after several prompts' },
      { value: 2, label: 'Within a few weeks of release', description: 'Update regularly but not immediately' },
      { value: 3, label: 'Automatic updates enabled', description: 'Updates install automatically' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 4,
    scoreMap: { 0: 0, 1: 2, 2: 6, 3: 10 },
  },
  {
    id: 'cyber-dh-04',
    text: 'Are your devices protected with screen locks (PIN, password, fingerprint, or face recognition)?',
    helpText: 'Screen locks prevent unauthorized access if your device is lost or stolen.',
    type: 'yes-no',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 4,
    scoreMap: { 'yes': 10, 'no': 0 },
  },
  {
    id: 'cyber-dh-05',
    text: 'Do you have full-disk encryption enabled on your computers and devices?',
    helpText: 'Full-disk encryption protects your data if your device is stolen or compromised.',
    type: 'single-choice',
    options: [
      { value: 'none', label: 'No encryption' },
      { value: 'some', label: 'Some devices encrypted' },
      { value: 'all', label: 'All devices encrypted' },
      { value: 'unknown', label: 'Not sure' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 3,
    scoreMap: { 'none': 0, 'some': 5, 'all': 10, 'unknown': 2 },
  },
  {
    id: 'cyber-dh-06',
    text: 'How current is your main computer\'s operating system?',
    helpText: 'Outdated operating systems lack security patches and become vulnerable.',
    type: 'single-choice',
    options: [
      { value: 'very-old', label: '3+ years behind' },
      { value: 'old', label: '1-2 years behind' },
      { value: 'recent', label: 'Within 6 months of current' },
      { value: 'current', label: 'Latest version' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 3,
    scoreMap: { 'very-old': 0, 'old': 2, 'recent': 7, 'current': 10 },
  },
];

// ============================================================================
// SUB-CATEGORY 2: IDENTITY PROTECTION (5 questions, weight: 3)
// ============================================================================

const identityProtectionQuestions: Question[] = [
  {
    id: 'cyber-ip-01',
    text: 'Do you use multi-factor authentication (MFA) on your important accounts?',
    helpText: 'MFA adds a second layer of security beyond just passwords.',
    type: 'maturity-scale',
    options: [
      { value: 0, label: 'No MFA anywhere', description: 'Only use passwords' },
      { value: 1, label: 'MFA on a few accounts', description: 'Limited MFA usage' },
      { value: 2, label: 'MFA on financial accounts', description: 'Use MFA for banking and investments' },
      { value: 3, label: 'MFA on all important accounts', description: 'Comprehensive MFA coverage' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 5,
    scoreMap: { 0: 0, 1: 3, 2: 7, 3: 10 },
  },
  {
    id: 'cyber-ip-02',
    text: 'What type of multi-factor authentication do you primarily use?',
    helpText: 'Hardware keys are most secure, followed by authenticator apps, then SMS.',
    type: 'single-choice',
    options: [
      { value: 'sms', label: 'Text messages (SMS)' },
      { value: 'app', label: 'Authenticator app (Google Authenticator, Authy)' },
      { value: 'hardware', label: 'Hardware security key (YubiKey, etc.)' },
      { value: 'mixed', label: 'Mix of methods' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 3,
    scoreMap: { 'sms': 3, 'app': 7, 'hardware': 10, 'mixed': 8 },
    branchingRule: {
      dependsOn: 'cyber-ip-01',
      showIf: (answer) => answer !== 0,
    },
  },
  {
    id: 'cyber-ip-03',
    text: 'How well do you recognize and avoid phishing emails and suspicious links?',
    helpText: 'Phishing is the most common way attackers steal credentials and access accounts.',
    type: 'maturity-scale',
    options: [
      { value: 0, label: 'Often click without thinking', description: 'Click links and attachments freely' },
      { value: 1, label: 'Sometimes suspicious', description: 'Question obvious spam but not sophisticated attempts' },
      { value: 2, label: 'Usually cautious', description: 'Verify sender before clicking links' },
      { value: 3, label: 'Always verify', description: 'Never click suspicious links, independently verify requests' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 4,
    scoreMap: { 0: 0, 1: 2, 2: 6, 3: 10 },
  },
  {
    id: 'cyber-ip-04',
    text: 'Do you use a separate email address for financial accounts?',
    helpText: 'Separate financial email reduces exposure if your main email is compromised.',
    type: 'yes-no',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 2,
    scoreMap: { 'yes': 10, 'no': 0 },
  },
  {
    id: 'cyber-ip-05',
    text: 'How restrictive are your social media privacy settings?',
    helpText: 'Public social media profiles provide information attackers use for identity theft.',
    type: 'single-choice',
    options: [
      { value: 'public', label: 'Mostly public profiles' },
      { value: 'mixed', label: 'Some privacy controls' },
      { value: 'private', label: 'Friends/connections only' },
      { value: 'minimal', label: 'Very limited social media presence' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 2,
    scoreMap: { 'public': 0, 'mixed': 3, 'private': 7, 'minimal': 10 },
  },
];

// ============================================================================
// SUB-CATEGORY 3: BANKING SECURITY (6 questions, weight: 4)
// ============================================================================

const bankingSecurityQuestions: Question[] = [
  {
    id: 'cyber-bs-01',
    text: 'How do you typically access your bank accounts?',
    helpText: 'Bank apps and websites are more secure than financial aggregators for sensitive actions.',
    type: 'single-choice',
    options: [
      { value: 'aggregator-only', label: 'Only through financial apps (Mint, Personal Capital, etc.)' },
      { value: 'mixed-aggregator', label: 'Mostly aggregators, some direct bank access' },
      { value: 'mixed-direct', label: 'Mostly direct bank access, some aggregators' },
      { value: 'direct-only', label: 'Only through bank websites/apps directly' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 4,
    scoreMap: { 'aggregator-only': 3, 'mixed-aggregator': 5, 'mixed-direct': 8, 'direct-only': 10 },
  },
  {
    id: 'cyber-bs-02',
    text: 'Have you enabled account alerts and notifications for all your financial accounts?',
    helpText: 'Real-time alerts help you detect unauthorized transactions quickly.',
    type: 'maturity-scale',
    options: [
      { value: 0, label: 'No alerts enabled', description: 'Rely on monthly statements' },
      { value: 1, label: 'Basic alerts only', description: 'Large transactions and low balances' },
      { value: 2, label: 'Comprehensive alerts', description: 'All transactions and account changes' },
      { value: 3, label: 'Real-time alerts across all accounts', description: 'Immediate notifications for any activity' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 4,
    scoreMap: { 0: 0, 1: 3, 2: 7, 3: 10 },
  },
  {
    id: 'cyber-bs-03',
    text: 'How often do you review your bank and credit card statements?',
    helpText: 'Regular monitoring helps catch unauthorized transactions early.',
    type: 'single-choice',
    options: [
      { value: 'rarely', label: 'Rarely or never' },
      { value: 'quarterly', label: 'Every few months' },
      { value: 'monthly', label: 'Monthly' },
      { value: 'weekly', label: 'Weekly or more often' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 3,
    scoreMap: { 'rarely': 0, 'quarterly': 2, 'monthly': 7, 'weekly': 10 },
  },
  {
    id: 'cyber-bs-04',
    text: 'Who has authorized access to your bank accounts (joint accounts, authorized users)?',
    helpText: 'Limiting authorized access reduces the risk of account compromise.',
    type: 'single-choice',
    options: [
      { value: 'many', label: 'Multiple family members and others' },
      { value: 'some', label: 'Spouse and 1-2 family members' },
      { value: 'spouse-only', label: 'Spouse only' },
      { value: 'self-only', label: 'Only myself' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 3,
    scoreMap: { 'many': 0, 'some': 3, 'spouse-only': 7, 'self-only': 10 },
  },
  {
    id: 'cyber-bs-05',
    text: 'How do you verify wire transfer requests and other large transactions?',
    helpText: 'Verification procedures prevent business email compromise and fraud.',
    type: 'single-choice',
    options: [
      { value: 'no-verification', label: 'No special verification' },
      { value: 'email-only', label: 'Email confirmation only' },
      { value: 'phone-callback', label: 'Phone callback to known number' },
      { value: 'in-person', label: 'In-person or multi-person approval' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 4,
    scoreMap: { 'no-verification': 0, 'email-only': 2, 'phone-callback': 7, 'in-person': 10 },
  },
  {
    id: 'cyber-bs-06',
    text: 'Do your financial accounts have multi-factor authentication specifically enabled?',
    helpText: 'Financial accounts are high-value targets requiring strong authentication.',
    type: 'maturity-scale',
    options: [
      { value: 0, label: 'No MFA on financial accounts', description: 'Password-only access' },
      { value: 1, label: 'MFA on primary bank only', description: 'Limited financial MFA' },
      { value: 2, label: 'MFA on all bank accounts', description: 'Banking covered but not investments' },
      { value: 3, label: 'MFA on all financial accounts', description: 'Banks, investments, and financial services' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 5,
    scoreMap: { 0: 0, 1: 3, 2: 7, 3: 10 },
  },
];

// ============================================================================
// SUB-CATEGORY 4: PAYMENT RISK (5 questions, weight: 3)
// ============================================================================

const paymentRiskQuestions: Question[] = [
  {
    id: 'cyber-pr-01',
    text: 'What is your primary method for making purchases?',
    helpText: 'Credit cards offer better fraud protection than debit cards or cash alternatives.',
    type: 'single-choice',
    options: [
      { value: 'debit', label: 'Debit card' },
      { value: 'mixed', label: 'Mix of debit and credit' },
      { value: 'credit', label: 'Credit card' },
      { value: 'digital-wallet', label: 'Digital wallet (Apple Pay, Google Pay)' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 4,
    scoreMap: { 'debit': 0, 'mixed': 4, 'credit': 7, 'digital-wallet': 10 },
  },
  {
    id: 'cyber-pr-02',
    text: 'Do you use virtual credit card numbers or dedicated cards for online shopping?',
    helpText: 'Virtual cards limit exposure if card numbers are stolen from merchants.',
    type: 'single-choice',
    options: [
      { value: 'same-card', label: 'Use same card everywhere' },
      { value: 'dedicated-online', label: 'Separate card for online purchases' },
      { value: 'virtual-sometimes', label: 'Virtual cards for some purchases' },
      { value: 'virtual-always', label: 'Virtual cards for all online purchases' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 3,
    scoreMap: { 'same-card': 0, 'dedicated-online': 5, 'virtual-sometimes': 7, 'virtual-always': 10 },
  },
  {
    id: 'cyber-pr-03',
    text: 'How often do you review your recurring payments and subscriptions?',
    helpText: 'Regular review helps catch unauthorized charges and forgotten subscriptions.',
    type: 'single-choice',
    options: [
      { value: 'never', label: 'Never review' },
      { value: 'annually', label: 'Yearly' },
      { value: 'quarterly', label: 'Every 3-4 months' },
      { value: 'monthly', label: 'Monthly' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 2,
    scoreMap: { 'never': 0, 'annually': 3, 'quarterly': 7, 'monthly': 10 },
  },
  {
    id: 'cyber-pr-04',
    text: 'How do you secure peer-to-peer payment apps (Venmo, Zelle, PayPal, etc.)?',
    helpText: 'P2P payment apps should be secured and not linked to primary bank accounts.',
    type: 'single-choice',
    options: [
      { value: 'dont-use', label: 'Don\'t use P2P payments' },
      { value: 'basic-security', label: 'Default settings, linked to main account' },
      { value: 'enhanced-security', label: 'Private settings, limited account linking' },
      { value: 'maximum-security', label: 'Private, dedicated funding source, transaction limits' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 3,
    scoreMap: { 'dont-use': 5, 'basic-security': 0, 'enhanced-security': 7, 'maximum-security': 10 },
  },
  {
    id: 'cyber-pr-05',
    text: 'Do you have credit monitoring services to detect identity theft?',
    helpText: 'Credit monitoring alerts you to new accounts or changes to your credit profile.',
    type: 'single-choice',
    options: [
      { value: 'none', label: 'No credit monitoring' },
      { value: 'free', label: 'Free credit monitoring (Credit Karma, etc.)' },
      { value: 'paid', label: 'Paid credit monitoring service' },
      { value: 'comprehensive', label: 'Comprehensive identity theft protection' },
    ],
    required: true,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 3,
    scoreMap: { 'none': 0, 'free': 5, 'paid': 7, 'comprehensive': 10 },
  },
];

// ============================================================================
// EXPORTS
// ============================================================================

// Combine all questions into a flat array
export const cyberRiskQuestions: Question[] = [
  ...digitalHygieneQuestions,
  ...identityProtectionQuestions,
  ...bankingSecurityQuestions,
  ...paymentRiskQuestions,
];

/** Standalone pillar config for legacy scoring/API tests; questions live under family-governance + `cybersecurity` in the main assessment. */
export const cyberRiskPillar: Pillar = {
  id: CYBER_PILLAR_ID,
  name: 'Cyber Risk',
  slug: 'cyber-risk',
  description: 'Assessment of digital security practices and cyber risk exposure',
  estimatedMinutes: 15,
  subCategories: [
    {
      id: 'cyber-digital',
      name: 'Cybersecurity',
      description: 'Digital hygiene, identity protection, banking and payment security',
      weight: 100,
      questionIds: cyberRiskQuestions.map((q) => q.id),
    },
  ],
};

// Alias for compatibility
export const allCyberQuestions = cyberRiskQuestions;