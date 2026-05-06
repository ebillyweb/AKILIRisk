/**
 * Setup recommendation rules and services for all assessment pillars
 */

import { prisma, disconnectPrismaScript } from './lib/prisma-for-scripts';

const SERVICE_RECOMMENDATIONS = [
  // Governance Services
  {
    id: 'governance_family_charter',
    name: 'Family Governance Charter Development',
    description: 'Professional facilitation to create comprehensive family governance charter and decision-making framework',
    category: 'governance',
    priority: 1,
    estimatedCost: '$15,000 - $40,000',
    timeframe: '2-4 months',
    provider: 'Family Governance Consultants',
    metadata: {
      services: ['Family charter development', 'Decision-making framework', 'Conflict resolution processes', 'Next generation engagement'],
      deliverables: ['Family governance charter', 'Decision-making protocols', 'Conflict resolution procedures']
    }
  },
  {
    id: 'governance_advisor_coordination',
    name: 'Advisor Coordination and Integration',
    description: 'Establishment of coordinated advisory team with regular communication protocols',
    category: 'governance',
    priority: 2,
    estimatedCost: '$8,000 - $20,000',
    timeframe: '1-2 months',
    metadata: {
      services: ['Advisor team assessment', 'Communication protocols', 'Meeting coordination', 'Performance monitoring']
    }
  },
  {
    id: 'governance_succession_planning',
    name: 'Next Generation Development Program',
    description: 'Comprehensive program to prepare next generation for governance responsibilities',
    category: 'governance',
    priority: 3,
    estimatedCost: '$25,000 - $75,000',
    timeframe: '6-12 months',
    metadata: {
      services: ['Leadership development', 'Education programs', 'Mentoring', 'Succession planning']
    }
  },

  // Physical Security Services
  {
    id: 'physical_security_assessment',
    name: 'Comprehensive Security Assessment',
    description: 'Professional security assessment of all family locations and protocols',
    category: 'security',
    priority: 1,
    estimatedCost: '$10,000 - $25,000',
    timeframe: '2-4 weeks',
    metadata: {
      services: ['Residence security audit', 'Travel security protocols', 'Personal protection assessment', 'Emergency planning']
    }
  },
  {
    id: 'physical_security_implementation',
    name: 'Executive Security Implementation',
    description: 'Implementation of comprehensive physical security measures and protocols',
    category: 'security',
    priority: 2,
    estimatedCost: '$50,000 - $200,000',
    timeframe: '1-3 months',
    metadata: {
      services: ['Security system installation', 'Staff training', 'Protocol development', 'Ongoing monitoring']
    }
  },
  {
    id: 'physical_emergency_planning',
    name: 'Emergency Response Planning',
    description: 'Development of comprehensive emergency response and evacuation procedures',
    category: 'security',
    priority: 3,
    estimatedCost: '$5,000 - $15,000',
    timeframe: '3-6 weeks',
    metadata: {
      services: ['Emergency plan development', 'Family training', 'Drill coordination', 'Annual plan updates']
    }
  },

  // Insurance & Asset Protection Services
  {
    id: 'insurance_comprehensive_review',
    name: 'Comprehensive Insurance Review',
    description: 'Complete review and optimization of all insurance coverage with gap analysis',
    category: 'insurance',
    priority: 1,
    estimatedCost: '$5,000 - $15,000',
    timeframe: '2-4 weeks',
    metadata: {
      services: ['Coverage analysis', 'Gap identification', 'Cost optimization', 'Carrier evaluation', 'Claims review']
    }
  },
  {
    id: 'insurance_estate_planning',
    name: 'Advanced Estate Planning',
    description: 'Comprehensive estate planning with tax optimization and asset protection strategies',
    category: 'legal',
    priority: 2,
    estimatedCost: '$25,000 - $100,000',
    timeframe: '3-6 months',
    metadata: {
      services: ['Estate plan design', 'Trust structures', 'Tax planning', 'Asset protection', 'Succession planning']
    }
  },
  {
    id: 'insurance_asset_protection',
    name: 'Asset Protection Strategy',
    description: 'Implementation of sophisticated asset protection and liability mitigation strategies',
    category: 'legal',
    priority: 3,
    estimatedCost: '$35,000 - $150,000',
    timeframe: '4-8 months',
    metadata: {
      services: ['Entity structuring', 'Asset titling', 'Liability mitigation', 'International planning', 'Ongoing compliance']
    }
  },

  // Geographic Risk Services
  {
    id: 'geographic_risk_assessment',
    name: 'Geographic Risk Assessment',
    description: 'Comprehensive assessment of location-specific risks across all family locations',
    category: 'advisory',
    priority: 1,
    estimatedCost: '$8,000 - $20,000',
    timeframe: '3-6 weeks',
    metadata: {
      services: ['Location risk analysis', 'Climate risk assessment', 'Political risk evaluation', 'Regulatory review']
    }
  },
  {
    id: 'geographic_climate_resilience',
    name: 'Climate Resilience Planning',
    description: 'Development of climate risk mitigation and adaptation strategies',
    category: 'advisory',
    priority: 2,
    estimatedCost: '$15,000 - $40,000',
    timeframe: '2-4 months',
    metadata: {
      services: ['Climate vulnerability assessment', 'Adaptation planning', 'Infrastructure recommendations', 'Emergency preparedness']
    }
  },
  {
    id: 'geographic_diversification',
    name: 'Geographic Diversification Strategy',
    description: 'Strategic planning for geographic diversification of assets and residences',
    category: 'advisory',
    priority: 3,
    estimatedCost: '$20,000 - $50,000',
    timeframe: '3-6 months',
    metadata: {
      services: ['Diversification analysis', 'Location selection', 'Implementation planning', 'Ongoing monitoring']
    }
  },

  // Reputational & Social Risk Services
  {
    id: 'social_reputation_management',
    name: 'Family Reputation Management',
    description: 'Comprehensive reputation monitoring and management program',
    category: 'reputation',
    priority: 1,
    estimatedCost: '$12,000 - $30,000',
    timeframe: 'Ongoing',
    metadata: {
      services: ['Reputation monitoring', 'Social media management', 'Crisis preparedness', 'Staff training']
    }
  },
  {
    id: 'social_media_governance',
    name: 'Digital Governance and Social Media Policy',
    description: 'Development of family digital governance policies and social media guidelines',
    category: 'reputation',
    priority: 2,
    estimatedCost: '$5,000 - $15,000',
    timeframe: '2-6 weeks',
    metadata: {
      services: ['Policy development', 'Family training', 'Monitoring setup', 'Compliance protocols']
    }
  },
  {
    id: 'social_crisis_response',
    name: 'Crisis Communication Planning',
    description: 'Development of comprehensive crisis communication and reputation recovery strategies',
    category: 'reputation',
    priority: 3,
    estimatedCost: '$10,000 - $25,000',
    timeframe: '4-8 weeks',
    metadata: {
      services: ['Crisis planning', 'Communication strategies', 'Media relations', 'Recovery protocols']
    }
  }
];

const RECOMMENDATION_RULES = [
  // Governance Rules
  {
    id: 'governance_charter_needed',
    serviceRecommendationId: 'governance_family_charter',
    ruleName: 'Family Charter Development',
    description: 'Families without governance documentation need charter development',
    triggerConditions: [
      {
        type: 'answer_match',
        questionId: 'governance_family_charter',
        operator: 'in',
        value: ['none', 'informal'],
        weight: 4
      },
      {
        type: 'score_threshold',
        pillarId: 'governance',
        operator: 'less_than',
        value: 2.0,
        weight: 3
      }
    ],
    priority: 95
  },
  {
    id: 'governance_advisor_coordination',
    serviceRecommendationId: 'governance_advisor_coordination',
    ruleName: 'Advisor Coordination Improvement',
    description: 'Families with siloed advisors need coordination improvement',
    triggerConditions: [
      {
        type: 'answer_match',
        questionId: 'governance_advisor_coordination',
        operator: 'in',
        value: ['siloed', 'ad_hoc'],
        weight: 3
      }
    ],
    priority: 85
  },
  {
    id: 'governance_succession_planning',
    serviceRecommendationId: 'governance_succession_planning',
    ruleName: 'Next Generation Development',
    description: 'Families without next generation preparation need development programs',
    triggerConditions: [
      {
        type: 'answer_match',
        questionId: 'governance_next_gen_engagement',
        operator: 'in',
        value: ['no_preparation', 'informal_exposure'],
        weight: 4
      }
    ],
    priority: 80
  },

  // Physical Security Rules
  {
    id: 'physical_security_basic_gaps',
    serviceRecommendationId: 'physical_security_assessment',
    ruleName: 'Security Assessment for Basic Protection',
    description: 'Families with minimal security need professional assessment',
    triggerConditions: [
      {
        type: 'answer_match',
        questionId: 'physical_home_security',
        operator: 'equals',
        value: 'basic_minimal',
        weight: 4
      },
      {
        type: 'score_threshold',
        pillarId: 'physical-security',
        operator: 'less_than',
        value: 1.5,
        weight: 3
      }
    ],
    priority: 90
  },
  {
    id: 'physical_security_comprehensive_needed',
    serviceRecommendationId: 'physical_security_implementation',
    ruleName: 'Comprehensive Security Implementation',
    description: 'Families with elevated security needs require comprehensive implementation',
    triggerConditions: [
      {
        type: 'score_threshold',
        pillarId: 'physical-security',
        operator: 'less_than',
        value: 2.0,
        weight: 4
      },
      {
        type: 'answer_match',
        questionId: 'physical_staff_vetting',
        operator: 'in',
        value: ['none', 'basic'],
        weight: 3
      }
    ],
    priority: 85
  },
  {
    id: 'physical_emergency_planning_needed',
    serviceRecommendationId: 'physical_emergency_planning',
    ruleName: 'Emergency Planning Development',
    description: 'Families without emergency plans need comprehensive planning',
    triggerConditions: [
      {
        type: 'answer_match',
        questionId: 'physical_emergency_plans',
        operator: 'in',
        value: ['none', 'basic'],
        weight: 4
      }
    ],
    priority: 80
  },

  // Insurance Rules
  {
    id: 'insurance_review_overdue',
    serviceRecommendationId: 'insurance_comprehensive_review',
    ruleName: 'Overdue Insurance Review',
    description: 'Families with outdated coverage need comprehensive review',
    triggerConditions: [
      {
        type: 'answer_match',
        questionId: 'insurance_coverage_review',
        operator: 'in',
        value: ['never', 'crisis_only'],
        weight: 4
      }
    ],
    priority: 90
  },
  {
    id: 'insurance_estate_planning_needed',
    serviceRecommendationId: 'insurance_estate_planning',
    ruleName: 'Estate Planning Update',
    description: 'Families with outdated estate plans need comprehensive planning',
    triggerConditions: [
      {
        type: 'answer_match',
        questionId: 'insurance_estate_planning',
        operator: 'in',
        value: ['none_outdated', 'basic_current'],
        weight: 4
      },
      {
        type: 'score_threshold',
        pillarId: 'financial-asset-protection',
        operator: 'less_than',
        value: 2.0,
        weight: 3
      }
    ],
    priority: 85
  },
  {
    id: 'insurance_asset_protection_needed',
    serviceRecommendationId: 'insurance_asset_protection',
    ruleName: 'Asset Protection Implementation',
    description: 'Families with inadequate asset protection need sophisticated strategies',
    triggerConditions: [
      {
        type: 'answer_match',
        questionId: 'insurance_asset_titling',
        operator: 'in',
        value: ['individual', 'joint_simple'],
        weight: 4
      },
      {
        type: 'answer_match',
        questionId: 'insurance_umbrella_coverage',
        operator: 'in',
        value: ['none', 'basic'],
        weight: 3
      }
    ],
    priority: 80
  },

  // Geographic Rules
  {
    id: 'geographic_assessment_needed',
    serviceRecommendationId: 'geographic_risk_assessment',
    ruleName: 'Geographic Risk Assessment',
    description: 'Families without location risk assessment need professional evaluation',
    triggerConditions: [
      {
        type: 'answer_match',
        questionId: 'geographic_location_assessment',
        operator: 'in',
        value: ['not_assessed', 'basic_awareness'],
        weight: 4
      }
    ],
    priority: 85
  },
  {
    id: 'geographic_climate_resilience_needed',
    serviceRecommendationId: 'geographic_climate_resilience',
    ruleName: 'Climate Resilience Planning',
    description: 'Families unprepared for climate risks need resilience planning',
    triggerConditions: [
      {
        type: 'answer_match',
        questionId: 'geographic_climate_preparedness',
        operator: 'in',
        value: ['unprepared', 'basic'],
        weight: 4
      }
    ],
    priority: 80
  },
  {
    id: 'geographic_diversification_needed',
    serviceRecommendationId: 'geographic_diversification',
    ruleName: 'Geographic Diversification Strategy',
    description: 'Families with concentrated geographic exposure need diversification planning',
    triggerConditions: [
      {
        type: 'answer_match',
        questionId: 'geographic_diversification',
        operator: 'equals',
        value: 'concentrated',
        weight: 4
      },
      {
        type: 'score_threshold',
        pillarId: 'environmental-geographic-risk',
        operator: 'less_than',
        value: 1.8,
        weight: 3
      }
    ],
    priority: 75
  },

  // Social/Reputational Rules
  {
    id: 'social_reputation_management_needed',
    serviceRecommendationId: 'social_reputation_management',
    ruleName: 'Reputation Management Program',
    description: 'Families with high public exposure need reputation management',
    triggerConditions: [
      {
        type: 'answer_match',
        questionId: 'social_public_exposure',
        operator: 'in',
        value: ['unmanaged', 'basic_awareness'],
        weight: 4
      },
      {
        type: 'score_threshold',
        pillarId: 'lifestyle-behavioral-risk',
        operator: 'less_than',
        value: 2.0,
        weight: 3
      }
    ],
    priority: 85
  },
  {
    id: 'social_media_governance_needed',
    serviceRecommendationId: 'social_media_governance',
    ruleName: 'Social Media Governance',
    description: 'Families without social media policies need governance framework',
    triggerConditions: [
      {
        type: 'answer_match',
        questionId: 'social_media_policies',
        operator: 'in',
        value: ['none', 'informal'],
        weight: 4
      }
    ],
    priority: 80
  },
  {
    id: 'social_crisis_planning_needed',
    serviceRecommendationId: 'social_crisis_response',
    ruleName: 'Crisis Communication Planning',
    description: 'Families without crisis plans need communication strategy development',
    triggerConditions: [
      {
        type: 'answer_match',
        questionId: 'social_crisis_communication',
        operator: 'in',
        value: ['none', 'basic'],
        weight: 4
      }
    ],
    priority: 75
  }
];

// Advanced scoring rules for enhanced logic
const SCORING_RULES = [
  // High net worth families get increased governance weight
  {
    id: 'governance_high_networth_weight',
    questionId: 'governance_decision_authority',
    ruleName: 'High Net Worth Governance Weight',
    description: 'Increase governance importance for high net worth families',
    conditions: [
      {
        type: 'profile_condition',
        field: 'netWorth',
        operator: 'greater_than',
        value: 25000000
      }
    ],
    scoreModifiers: [
      {
        type: 'apply_weight',
        value: 1.5,
        target: 'pillar_weight'
      }
    ],
    priority: 90
  },

  // Large families need more governance structure
  {
    id: 'governance_large_family_weight',
    questionId: 'governance_family_meetings',
    ruleName: 'Large Family Governance Weight',
    description: 'Increase meeting importance for large families',
    conditions: [
      {
        type: 'profile_condition',
        field: 'householdSize',
        operator: 'greater_than',
        value: 6
      }
    ],
    scoreModifiers: [
      {
        type: 'apply_weight',
        value: 1.3,
        target: 'question_score'
      }
    ],
    priority: 85
  },

  // High public profile increases security and reputation needs
  {
    id: 'security_public_profile_multiplier',
    questionId: 'physical_home_security',
    ruleName: 'Public Profile Security Multiplier',
    description: 'Increase security requirements for high-profile families',
    conditions: [
      {
        type: 'profile_condition',
        field: 'publicProfile',
        operator: 'in',
        value: ['high', 'celebrity']
      }
    ],
    scoreModifiers: [
      {
        type: 'apply_weight',
        value: 2.0,
        target: 'pillar_weight'
      }
    ],
    priority: 95
  },

  // International families need geographic risk emphasis
  {
    id: 'geographic_international_weight',
    questionId: 'geographic_regulatory_compliance',
    ruleName: 'International Family Geographic Weight',
    description: 'Increase geographic risk weight for international families',
    conditions: [
      {
        type: 'profile_condition',
        field: 'internationalPresence',
        operator: 'equals',
        value: true
      }
    ],
    scoreModifiers: [
      {
        type: 'apply_weight',
        value: 1.4,
        target: 'category_weight'
      }
    ],
    priority: 88
  },

  // Business-owning families need asset protection emphasis
  {
    id: 'insurance_business_owner_weight',
    questionId: 'insurance_business_protection',
    ruleName: 'Business Owner Asset Protection Weight',
    description: 'Increase asset protection importance for business owners',
    conditions: [
      {
        type: 'profile_condition',
        field: 'businessOwnership',
        operator: 'greater_than',
        value: 0.1
      }
    ],
    scoreModifiers: [
      {
        type: 'apply_weight',
        value: 1.6,
        target: 'question_score'
      }
    ],
    priority: 87
  }
];

async function setupAllPillarRules() {
  console.log('⚙️ Setting up recommendation rules and services for all pillars...');

  await prisma.$transaction(async (tx) => {
    console.log('\n📦 Adding service recommendations...');

    // C1 (BRD §4.4): set the new classification fields explicitly so
    // post-seed catalog has the BRD's tier/complexity dimensions
    // populated. tier: BASELINE because every seeded entry IS the
    // automated baseline catalog (manual ENHANCED overlays come from
    // the admin editor). complexity: MEDIUM as a sensible default —
    // admins adjust per-service through the UI.
    for (const service of SERVICE_RECOMMENDATIONS) {
      const enriched = {
        ...service,
        tier: 'BASELINE' as const,
        complexity: 'MEDIUM' as const,
      };
      await tx.serviceRecommendation.upsert({
        where: { id: service.id },
        create: enriched,
        update: enriched
      });
    }

    console.log(`   ✅ Added ${SERVICE_RECOMMENDATIONS.length} service recommendations`);

    console.log('\n📋 Adding recommendation rules...');

    for (const rule of RECOMMENDATION_RULES) {
      await tx.recommendationRule.upsert({
        where: { id: rule.id },
        create: rule,
        update: rule
      });
    }

    console.log(`   ✅ Added ${RECOMMENDATION_RULES.length} recommendation rules`);

    console.log('\n🎯 Adding scoring rules...');

    for (const rule of SCORING_RULES) {
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
          isActive: true
        },
        update: {
          ruleName: rule.ruleName,
          description: rule.description,
          priority: rule.priority,
          conditions: rule.conditions,
          scoreModifiers: rule.scoreModifiers
        }
      });
    }

    console.log(`   ✅ Added ${SCORING_RULES.length} scoring rules`);

    console.log('\n📊 Summary:');
    console.log(`   🏛️ Services by category:`);

    const servicesByCategory = SERVICE_RECOMMENDATIONS.reduce((acc, service) => {
      acc[service.category] = (acc[service.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(servicesByCategory).forEach(([category, count]) => {
      console.log(`      ${category}: ${count} services`);
    });

    const rulesByPillar = RECOMMENDATION_RULES.reduce((acc, rule) => {
      const pillar = rule.serviceRecommendationId.split('_')[0];
      acc[pillar] = (acc[pillar] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(`   📋 Rules by pillar:`);
    Object.entries(rulesByPillar).forEach(([pillar, count]) => {
      console.log(`      ${pillar}: ${count} rules`);
    });
  });

  console.log('\n🎉 All pillar rules setup completed successfully!');
}

async function main() {
  try {
    await setupAllPillarRules();
  } catch (error) {
    console.error('💥 Rules setup failed:', error);
    process.exit(1);
  } finally {
    await disconnectPrismaScript();
  }
}

if (require.main === module) {
  main();
}

export { setupAllPillarRules };