/**
 * Setup cybersecurity recommendation rules based on Belvedere risk tiers
 *
 * Maps your risk classification (80-100, 60-79, 40-59, <40) to specific actions
 */

import { prisma, disconnectPrismaScript } from './lib/prisma-for-scripts';

async function setupCybersecurityRules() {
  console.log('Setting up cybersecurity recommendation rules...');

  // Based on your spreadsheet risk tiers:
  // 80-100: Low Risk / Resilient -> Annual testing
  // 60-79: Moderate Risk -> Targeted remediation
  // 40-59: Elevated Risk -> Full cybersecurity uplift
  // <40: High/Critical Risk -> Immediate intervention

  const recommendationRules = [
    {
      id: 'cyber_annual_testing_low_risk',
      serviceRecommendationId: 'cyber_phishing_training',
      ruleName: 'Annual Testing for Low Risk Families',
      description: 'Phishing simulations and backup validation for resilient families',
      triggerConditions: [
        {
          type: 'score_threshold',
          pillarId: 'cyber-digital',
          operator: 'greater_than',
          value: 2.4, // 80/100 * 3.0 scale = 2.4
          weight: 4
        }
      ],
      pillarThresholds: {
        "cyber-digital": { min: 2.4, max: 3.0 }
      },
      questionConditions: null,
      priority: 1,
      isActive: true
    },
    {
      id: 'cyber_targeted_remediation_moderate',
      serviceRecommendationId: 'cyber_targeted_remediation',
      ruleName: 'Targeted Remediation for Moderate Risk',
      description: 'MFA rollout, device hardening, and training for moderate risk families',
      triggerConditions: [
        {
          type: 'score_threshold',
          pillarId: 'cyber-digital',
          operator: 'greater_than',
          value: 1.8, // 60/100 * 3.0 = 1.8
          weight: 3
        },
        {
          type: 'score_threshold',
          pillarId: 'cyber-digital',
          operator: 'less_than',
          value: 2.4, // 80/100 * 3.0 = 2.4
          weight: 3
        }
      ],
      pillarThresholds: {
        "cyber-digital": { min: 1.8, max: 2.37 }
      },
      questionConditions: {
        // Trigger if MFA is not universal or password manager not deployed
        'cyber_mfa_enabled': { 'not_equals': 'universal_phishing_resistant' },
        'cyber_password_manager': { 'not_equals': 'enterprise_grade' }
      },
      priority: 2,
      isActive: true
    },
    {
      id: 'cyber_full_uplift_elevated',
      serviceRecommendationId: 'cyber_full_uplift',
      ruleName: 'Full Uplift for Elevated Risk',
      description: 'Complete cybersecurity overhaul for elevated risk families',
      triggerConditions: [
        {
          type: 'score_threshold',
          pillarId: 'cyber-digital',
          operator: 'greater_than',
          value: 1.2, // 40/100 * 3.0 = 1.2
          weight: 4
        },
        {
          type: 'score_threshold',
          pillarId: 'cyber-digital',
          operator: 'less_than',
          value: 1.8, // 60/100 * 3.0 = 1.8
          weight: 4
        }
      ],
      pillarThresholds: {
        "cyber-digital": { min: 1.2, max: 1.77 }
      },
      questionConditions: {
        // Trigger if multiple foundational controls missing
        'cyber_device_inventory': { 'in': ['none', 'partial'] },
        'cyber_network_segmentation': { 'in': ['none', 'limited'] },
        'cyber_software_updates': { 'in': ['outdated', 'manual'] }
      },
      priority: 3,
      isActive: true
    },
    {
      id: 'cyber_immediate_intervention_critical',
      serviceRecommendationId: 'cyber_immediate_intervention',
      ruleName: 'Immediate Intervention for Critical Risk',
      description: 'Emergency response for high/critical risk families',
      triggerConditions: [
        {
          type: 'score_threshold',
          pillarId: 'cyber-digital',
          operator: 'less_than',
          value: 1.2, // <40/100 * 3.0 = 1.2
          weight: 5
        }
      ],
      pillarThresholds: {
        "cyber-digital": { min: 0.0, max: 1.19 }
      },
      questionConditions: {
        // Trigger if critical basics are missing
        'cyber_password_manager': { 'equals': 'reused_simple' },
        'cyber_mfa_enabled': { 'in': ['none', 'limited'] },
        'cyber_software_updates': { 'equals': 'outdated' }
      },
      priority: 4,
      isActive: true
    },

    // Specific conditional rules based on question patterns
    {
      id: 'cyber_password_manager_urgent',
      serviceRecommendationId: 'cyber_targeted_remediation',
      ruleName: 'Urgent Password Manager Deployment',
      description: 'Immediate password manager deployment for families using weak passwords',
      triggerConditions: [
        {
          type: 'answer_match',
          questionId: 'cyber_password_manager',
          operator: 'equals',
          value: 'reused_simple',
          weight: 5
        }
      ],
      priority: 1,
      isActive: true
    },
    {
      id: 'cyber_mfa_deployment',
      serviceRecommendationId: 'cyber_targeted_remediation',
      ruleName: 'MFA Deployment for Unprotected Accounts',
      description: 'Multi-factor authentication setup for families without MFA',
      triggerConditions: [
        {
          type: 'answer_match',
          questionId: 'cyber_mfa_enabled',
          operator: 'in',
          value: ['none', 'limited'],
          weight: 4
        },
        {
          type: 'score_threshold',
          pillarId: 'cyber-digital',
          operator: 'less_than',
          value: 2.0,
          weight: 2
        }
      ],
      priority: 2,
      isActive: true
    },
    {
      id: 'cyber_incident_response_planning',
      serviceRecommendationId: 'cyber_full_uplift',
      ruleName: 'Incident Response Planning',
      description: 'Comprehensive incident response planning for unprepared families',
      triggerConditions: [
        {
          type: 'answer_match',
          questionId: 'cyber_incident_plan_compromise',
          operator: 'in',
          value: ['none', 'ad_hoc'],
          weight: 3
        },
        {
          type: 'answer_match',
          questionId: 'cyber_recovery_contacts',
          operator: 'in',
          value: ['unknown', 'scattered'],
          weight: 3
        }
      ],
      priority: 3,
      isActive: true
    }
  ];

  // Advanced scoring rules for cybersecurity
  const scoringRules = [
    {
      id: 'cyber_travel_risk_multiplier',
      questionId: 'cyber_travel_practices',
      ruleName: 'Travel Risk Multiplier',
      description: 'Increase weight for families who travel frequently with poor cyber practices',
      conditions: [
        {
          type: 'answer_equals',
          questionId: 'cyber_travel_practices',
          operator: 'in',
          value: ['none', 'minimal']
        },
        {
          type: 'profile_condition',
          field: 'travelFrequency',
          operator: 'greater_than',
          value: 'frequent'
        }
      ],
      scoreModifiers: [
        {
          type: 'apply_weight',
          value: 1.5,
          target: 'question_score'
        }
      ],
      priority: 90,
      isActive: true
    },
    {
      id: 'cyber_family_size_governance_weight',
      questionId: 'cyber_family_online_rules',
      ruleName: 'Large Family Governance Weight',
      description: 'Increase governance importance for large families',
      conditions: [
        {
          type: 'profile_condition',
          field: 'householdSize',
          operator: 'greater_than',
          value: 4
        }
      ],
      scoreModifiers: [
        {
          type: 'apply_weight',
          value: 1.3,
          target: 'category_weight'
        }
      ],
      priority: 85,
      isActive: true
    },
    {
      id: 'cyber_previous_incident_penalty',
      questionId: 'cyber_phishing_victim',
      ruleName: 'Previous Incident Risk Increase',
      description: 'Penalize families with history of cyber incidents',
      conditions: [
        {
          type: 'answer_equals',
          questionId: 'cyber_phishing_victim',
          operator: 'in',
          value: ['frequent_unresolved', 'occasional']
        }
      ],
      scoreModifiers: [
        {
          type: 'multiply',
          value: 0.8,
          target: 'pillar_weight'
        }
      ],
      priority: 95,
      isActive: true
    }
  ];

  // Insert recommendation rules
  await prisma.$transaction(async (tx) => {
    console.log('Inserting recommendation rules...');
    for (const rule of recommendationRules) {
      await tx.recommendationRule.upsert({
        where: { id: rule.id },
        create: rule,
        update: rule
      });
    }

    console.log('Inserting scoring rules...');
    for (const rule of scoringRules) {
      await tx.scoringRule.upsert({
        where: { id: rule.id },
        create: {
          id: rule.id,
          questionId: rule.questionId,
          ruleName: rule.ruleName,
          description: rule.description,
          priority: rule.priority,
          conditions: rule.conditions,
          scoreModifiers: rule.scoreModifiers,
          isActive: rule.isActive
        },
        update: {
          ruleName: rule.ruleName,
          description: rule.description,
          priority: rule.priority,
          conditions: rule.conditions,
          scoreModifiers: rule.scoreModifiers,
          isActive: rule.isActive
        }
      });
    }

    console.log('Updating pillar configuration for cybersecurity...');
    await tx.pillarConfiguration.upsert({
      where: { pillarId: 'cyber-digital' },
      create: {
        pillarId: 'cyber-digital',
        name: 'Cyber Security',
        description: 'Digital security, data protection, and online risk management',
        baseWeight: 1.0,
        thresholds: {
          low: { min: 2.4, max: 3.0 },      // 80-100%
          medium: { min: 1.8, max: 2.37 },  // 60-79%
          high: { min: 1.2, max: 1.77 },    // 40-59%
          critical: { min: 0.0, max: 1.19 } // <40%
        },
        isActive: true
      },
      update: {
        thresholds: {
          low: { min: 2.4, max: 3.0 },
          medium: { min: 1.8, max: 2.37 },
          high: { min: 1.2, max: 1.77 },
          critical: { min: 0.0, max: 1.19 }
        }
      }
    });
  });

  console.log(`✅ Setup complete!`);
  console.log(`   - ${recommendationRules.length} recommendation rules`);
  console.log(`   - ${scoringRules.length} scoring rules`);
  console.log(`   - Updated cybersecurity pillar configuration`);
}

async function main() {
  try {
    await setupCybersecurityRules();
    console.log('🎉 Cybersecurity rules setup completed successfully!');
  } catch (error) {
    console.error('💥 Setup failed:', error);
    process.exit(1);
  } finally {
    await disconnectPrismaScript();
  }
}

if (require.main === module) {
  main();
}

export { setupCybersecurityRules };