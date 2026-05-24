/**
 * Complete Multi-Pillar Assessment Example
 *
 * Demonstrates the full assessment system across all 6 pillars
 * with realistic family scenarios and comprehensive reporting
 */

import './load-example-env';
import { RecommendationEngine } from '@/lib/assessment/engines/recommendation-engine';
import { calculatePillarScore, getRiskLevel as aggregateMaturityRiskLevel } from '@/lib/assessment/scoring';
import { loadGovernanceQuestionsMerged } from '@/lib/assessment/bank/load-bank';
import { pillarForBankRiskArea } from '@/lib/assessment/bank/pillar-for-risk-area';
import { prisma } from '@/lib/db';
import { resolveExampleAssessmentUserId } from './resolve-example-user';

// Example family profiles with different risk characteristics
const FAMILY_PROFILES = {
  highRiskFamily: {
    name: 'High-Risk Technology Executive Family',
    profile: {
      netWorth: 50000000,
      householdSize: 5,
      publicProfile: 'high',
      businessOwnership: 0.8,
      internationalPresence: true,
      travelFrequency: 'frequent'
    },
    answers: {
      // Governance - Poor
      'governance_decision_authority': 'unclear_undefined',
      'governance_family_charter': 'none',
      'governance_next_gen_engagement': 'no_preparation',
      'governance_advisor_coordination': 'siloed',
      'governance_conflict_resolution': 'none',
      'governance_family_meetings': 'never',

      // Cybersecurity - Poor (from previous example)
      'cyber_a_password_device_management': 'no_ownership',
      'cyber_a_family_online_rules': 'none',
      'cyber_c_password_manager': 'reused_simple',
      'cyber_c_mfa_enabled': 'none',

      // Physical Security - Minimal
      'physical_home_security': 'basic_minimal',
      'physical_travel_security': 'none',
      'physical_staff_vetting': 'none',
      'physical_emergency_plans': 'none',
      'physical_information_protection': 'minimal',

      // Insurance - Outdated
      'insurance_coverage_review': 'never',
      'insurance_umbrella_coverage': 'basic',
      'insurance_asset_titling': 'individual',
      'insurance_estate_planning': 'none_outdated',
      'insurance_business_protection': 'minimal',

      // Geographic - Concentrated
      'geographic_location_assessment': 'not_assessed',
      'geographic_climate_preparedness': 'unprepared',
      'geographic_political_stability': 'not_considered',
      'geographic_regulatory_compliance': 'limited',
      'geographic_diversification': 'concentrated',

      // Social - Unmanaged
      'social_media_policies': 'none',
      'social_public_exposure': 'unmanaged',
      'social_family_conduct': 'none',
      'social_crisis_communication': 'none',
      'social_staff_confidentiality': 'none'
    }
  },

  moderateRiskFamily: {
    name: 'Moderate-Risk Professional Family',
    profile: {
      netWorth: 15000000,
      householdSize: 4,
      publicProfile: 'moderate',
      businessOwnership: 0.2,
      internationalPresence: false,
      travelFrequency: 'moderate'
    },
    answers: {
      // Governance - Moderate
      'governance_decision_authority': 'patriarch_matriarch',
      'governance_family_charter': 'informal',
      'governance_next_gen_engagement': 'informal_exposure',
      'governance_advisor_coordination': 'ad_hoc',
      'governance_conflict_resolution': 'informal',
      'governance_family_meetings': 'crisis_only',

      // Cybersecurity - Moderate
      'cyber_a_password_device_management': 'assigned',
      'cyber_a_family_online_rules': 'verbal',
      'cyber_c_password_manager': 'password_manager',
      'cyber_c_mfa_enabled': 'critical_enabled',

      // Physical Security - Basic
      'physical_home_security': 'enhanced',
      'physical_travel_security': 'basic',
      'physical_staff_vetting': 'basic',
      'physical_emergency_plans': 'basic',
      'physical_information_protection': 'secure_storage',

      // Insurance - Adequate
      'insurance_coverage_review': 'periodic',
      'insurance_umbrella_coverage': 'adequate',
      'insurance_asset_titling': 'joint_simple',
      'insurance_estate_planning': 'basic_current',
      'insurance_business_protection': 'standard',

      // Geographic - Basic
      'geographic_location_assessment': 'basic_awareness',
      'geographic_climate_preparedness': 'basic',
      'geographic_political_stability': 'basic_monitoring',
      'geographic_regulatory_compliance': 'adequate',
      'geographic_diversification': 'limited',

      // Social - Managed
      'social_media_policies': 'informal',
      'social_public_exposure': 'basic_awareness',
      'social_family_conduct': 'informal',
      'social_crisis_communication': 'basic',
      'social_staff_confidentiality': 'basic'
    }
  },

  lowRiskFamily: {
    name: 'Low-Risk Well-Managed Family',
    profile: {
      netWorth: 100000000,
      householdSize: 6,
      publicProfile: 'moderate',
      businessOwnership: 0.4,
      internationalPresence: true,
      travelFrequency: 'frequent'
    },
    answers: {
      // Governance - Excellent
      'governance_decision_authority': 'family_council',
      'governance_family_charter': 'comprehensive_reviewed',
      'governance_next_gen_engagement': 'leadership_pipeline',
      'governance_advisor_coordination': 'integrated_team',
      'governance_conflict_resolution': 'formal_process',
      'governance_family_meetings': 'quarterly',

      // Cybersecurity - Strong
      'cyber_a_password_device_management': 'centralized_audited',
      'cyber_a_family_online_rules': 'documented_reinforced',
      'cyber_c_password_manager': 'enterprise_grade',
      'cyber_c_mfa_enabled': 'universal_phishing_resistant',

      // Physical Security - Professional
      'physical_home_security': 'executive_protection',
      'physical_travel_security': 'professional',
      'physical_staff_vetting': 'ongoing',
      'physical_emergency_plans': 'tested',
      'physical_information_protection': 'professional_grade',

      // Insurance - Comprehensive
      'insurance_coverage_review': 'annual',
      'insurance_umbrella_coverage': 'comprehensive',
      'insurance_asset_titling': 'sophisticated',
      'insurance_estate_planning': 'dynamic_updated',
      'insurance_business_protection': 'sophisticated',

      // Geographic - Professional
      'geographic_location_assessment': 'comprehensive_ongoing',
      'geographic_climate_preparedness': 'resilient_systems',
      'geographic_political_stability': 'dynamic_planning',
      'geographic_regulatory_compliance': 'expert_managed',
      'geographic_diversification': 'well_diversified',

      // Social - Professional
      'social_media_policies': 'comprehensive',
      'social_public_exposure': 'professional',
      'social_family_conduct': 'enforced',
      'social_crisis_communication': 'professional',
      'social_staff_confidentiality': 'comprehensive'
    }
  }
};

const PILLARS = [
  { id: 'governance', name: 'Governance' },
  { id: 'cybersecurity', name: 'Cybersecurity' },
  { id: 'physical-security', name: 'Physical Security' },
  { id: 'financial-asset-protection', name: 'Insurance & Asset Protection' },
  { id: 'environmental-geographic-risk', name: 'Geographic Risk' },
  { id: 'lifestyle-behavioral-risk', name: 'Reputational & Social Risk' }
];

async function runCompleteAssessment(
  familyKey: keyof typeof FAMILY_PROFILES,
  userId?: string
) {
  const uid = userId ?? (await resolveExampleAssessmentUserId());
  const family = FAMILY_PROFILES[familyKey];

  console.log(`\n🏠 ASSESSING: ${family.name}`);
  console.log('=' .repeat(60));
  console.log(`Net Worth: $${(family.profile.netWorth / 1000000).toFixed(0)}M`);
  console.log(`Household Size: ${family.profile.householdSize}`);
  console.log(`Public Profile: ${family.profile.publicProfile}`);
  console.log(`Business Ownership: ${(family.profile.businessOwnership * 100).toFixed(0)}%`);

  try {
    // Create assessment
    const assessment = await prisma.assessment.create({
      data: {
        userId: uid,
        version: 1,
        status: 'IN_PROGRESS',
      }
    });

    const pillarResults = [];
    const allRecommendations = [];
    let totalAnswers = 0;

    // Process each pillar
    for (const pillar of PILLARS) {
      console.log(`\n📋 Processing ${pillar.name}...`);

      // Filter answers for this pillar
      const pillarAnswers = Object.fromEntries(
        Object.entries(family.answers).filter(([questionId, _]) =>
          questionId.startsWith(pillar.id.replace(/-/g, '_')) ||
          (pillar.id === 'cybersecurity' && questionId.startsWith('cyber_')) ||
          (pillar.id === 'physical-security' && questionId.startsWith('physical_')) ||
          (pillar.id === 'financial-asset-protection' && questionId.startsWith('insurance_')) ||
          (pillar.id === 'environmental-geographic-risk' && questionId.startsWith('geographic_')) ||
          (pillar.id === 'lifestyle-behavioral-risk' && questionId.startsWith('social_'))
        )
      );

      if (Object.keys(pillarAnswers).length === 0) {
        console.log(`   ⚠️ No answers found for ${pillar.name}, skipping...`);
        continue;
      }

      // Save answers to database
      for (const [questionId, answer] of Object.entries(pillarAnswers)) {
        await prisma.assessmentResponse.upsert({
          where: {
            assessmentId_questionId: {
              assessmentId: assessment.id,
              questionId
            }
          },
          create: {
            assessmentId: assessment.id,
            questionId,
            pillar: pillar.id,
            subCategory: getSubCategoryFromQuestionId(questionId, pillar.id),
            answer,
            skipped: false
          },
          update: { answer }
        });
        totalAnswers++;
      }

      // Load questions for this pillar
      const questionModels = await loadGovernanceQuestionsMerged({
        onlyVisible: true,
        riskAreaId: pillar.id,
      });

      if (questionModels.length === 0) {
        console.log(`   ⚠️ No questions configured for ${pillar.name}, skipping...`);
        continue;
      }

      const pillarDef = pillarForBankRiskArea(pillar.id, pillar.name);
      const visibleIds = questionModels.map((q) => q.id);
      const scoreResult = calculatePillarScore(
        pillarAnswers,
        pillarDef,
        questionModels,
        visibleIds
      );

      console.log(`   📊 Score: ${scoreResult.score.toFixed(1)}/3.0`);
      console.log(`   🎯 Risk: ${scoreResult.riskLevel.toUpperCase()}`);
      console.log(`   ❌ Missing Controls: ${scoreResult.missingControls.length}`);

      // Save pillar score
      await prisma.pillarScore.upsert({
        where: {
          assessmentId_pillar: {
            assessmentId: assessment.id,
            pillar: pillar.id
          }
        },
        create: {
          assessmentId: assessment.id,
          pillar: pillar.id,
          score: scoreResult.score,
          riskLevel: scoreResult.riskLevel.toUpperCase() as any,
          breakdown: scoreResult.breakdown,
          missingControls: scoreResult.missingControls
        },
        update: {
          score: scoreResult.score,
          riskLevel: scoreResult.riskLevel.toUpperCase() as any,
          breakdown: scoreResult.breakdown,
          missingControls: scoreResult.missingControls
        }
      });

      pillarResults.push({
        pillar: pillar.name,
        id: pillar.id,
        score: scoreResult.score,
        riskLevel: scoreResult.riskLevel,
        questionCount: Object.keys(pillarAnswers).length,
        missingControls: scoreResult.missingControls.length
      });

      // Generate recommendations for this pillar
      const recommendationEngine = new RecommendationEngine();

      const recommendations = await recommendationEngine.generateRecommendations({
        assessmentId: assessment.id,
        userId: uid,
        pillarScores: { [pillar.id]: scoreResult },
        answers: pillarAnswers,
        householdProfile: family.profile,
        missingControls: scoreResult.missingControls
      });

      allRecommendations.push(...recommendations);
    }

    // Calculate overall assessment score
    const overallScore = pillarResults.reduce((sum, p) => sum + p.score, 0) / pillarResults.length;
    const overallRiskLevel = aggregateMaturityRiskLevel(overallScore);

    // Complete the assessment
    await prisma.assessment.update({
      where: { id: assessment.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });

    // Display comprehensive results
    displayAssessmentResults(family.name, {
      overallScore,
      overallRiskLevel,
      pillarResults,
      recommendations: allRecommendations.slice(0, 8), // Top 8 recommendations
      totalAnswers
    });

    return {
      assessmentId: assessment.id,
      family: family.name,
      overallScore,
      overallRiskLevel,
      pillarCount: pillarResults.length,
      recommendationCount: allRecommendations.length
    };

  } catch (error) {
    console.error(`❌ Assessment failed for ${family.name}:`, error);
    throw error;
  }
}

function getSubCategoryFromQuestionId(questionId: string, pillarId: string): string {
  // Map question IDs to subcategories based on prefixes
  const mapping: Record<string, Record<string, string>> = {
    'governance': {
      'governance_decision': 'decision_making',
      'governance_family_charter': 'documentation',
      'governance_next_gen': 'succession',
      'governance_advisor': 'advisor_management',
      'governance_conflict': 'conflict_resolution',
      'governance_family_meetings': 'communication'
    },
    'cybersecurity': {
      'cyber_a': 'household_governance',
      'cyber_b': 'devices_network',
      'cyber_c': 'accounts_access',
      'cyber_d': 'data_privacy',
      'cyber_e': 'financial_identity',
      'cyber_f': 'incident_response'
    },
    'physical-security': {
      'physical_home': 'home_protection',
      'physical_travel': 'travel_safety',
      'physical_staff': 'personnel_security',
      'physical_emergency': 'emergency_preparedness',
      'physical_information': 'information_security'
    },
    'financial-asset-protection': {
      'insurance_coverage': 'coverage_management',
      'insurance_umbrella': 'liability_protection',
      'insurance_asset': 'asset_protection',
      'insurance_estate': 'estate_planning',
      'insurance_business': 'business_protection'
    },
    'environmental-geographic-risk': {
      'geographic_location': 'location_risk',
      'geographic_climate': 'climate_risk',
      'geographic_political': 'political_risk',
      'geographic_regulatory': 'regulatory_risk',
      'geographic_diversification': 'diversification'
    },
    'lifestyle-behavioral-risk': {
      'social_media': 'digital_reputation',
      'social_public': 'public_profile',
      'social_family_conduct': 'conduct_standards',
      'social_crisis': 'crisis_management',
      'social_staff': 'confidentiality'
    }
  };

  const pillarMapping = mapping[pillarId] || {};
  const prefix = Object.keys(pillarMapping).find(prefix => questionId.startsWith(prefix));
  return prefix ? pillarMapping[prefix] : 'default';
}

function displayAssessmentResults(familyName: string, results: any) {
  console.log('\n' + '='.repeat(60));
  console.log(`📋 COMPREHENSIVE ASSESSMENT RESULTS: ${familyName}`);
  console.log('=' .repeat(60));

  console.log(`\n🎯 OVERALL ASSESSMENT:`);
  console.log(`   Score: ${results.overallScore.toFixed(1)}/3.0`);
  console.log(`   Risk Level: ${String(results.overallRiskLevel).toUpperCase()}`);
  console.log(`   Questions Answered: ${results.totalAnswers}`);

  console.log(`\n📊 PILLAR BREAKDOWN:`);
  results.pillarResults.forEach((pillar: any) => {
    const percentage = Math.round((pillar.score / 3.0) * 100);
    const riskIcon = pillar.riskLevel === 'low' ? '🟢' : pillar.riskLevel === 'medium' ? '🟡' : pillar.riskLevel === 'high' ? '🟠' : '🔴';

    console.log(`   ${riskIcon} ${pillar.pillar}`);
    console.log(`      Score: ${pillar.score.toFixed(1)}/3.0 (${percentage}%)`);
    console.log(`      Risk: ${pillar.riskLevel.toUpperCase()}`);
    console.log(`      Questions: ${pillar.questionCount}, Missing Controls: ${pillar.missingControls}`);
  });

  console.log(`\n💡 TOP RECOMMENDATIONS:`);
  results.recommendations.slice(0, 5).forEach((rec: any, index: number) => {
    console.log(`   ${index + 1}. ${rec.name}`);
    console.log(`      Category: ${rec.category}`);
    console.log(`      Cost: ${rec.estimatedCost || 'TBD'}`);
    console.log(`      Time: ${rec.timeframe || 'TBD'}`);
    console.log(`      Priority: ${rec.priority}`);
  });

  const riskTier = results.overallScore >= 2.4 ? 'Low Risk (Annual Reviews)' :
                   results.overallScore >= 1.8 ? 'Moderate Risk (Targeted Improvements)' :
                   results.overallScore >= 1.2 ? 'Elevated Risk (Comprehensive Uplift)' :
                   'Critical Risk (Immediate Intervention)';

  console.log(`\n📈 RISK TIER: ${riskTier}`);
}

async function runAllFamilyExamples() {
  console.log('🏠 RUNNING COMPLETE MULTI-PILLAR ASSESSMENT EXAMPLES');
  console.log('=' .repeat(60));

  const userId = await resolveExampleAssessmentUserId();
  const results = [];

  for (const familyKey of Object.keys(FAMILY_PROFILES) as Array<keyof typeof FAMILY_PROFILES>) {
    const result = await runCompleteAssessment(familyKey, userId);
    results.push(result);

    // Brief pause between assessments
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary comparison
  console.log('\n' + '='.repeat(60));
  console.log('📊 FAMILY RISK COMPARISON SUMMARY');
  console.log('=' .repeat(60));

  results.forEach(result => {
    const percentage = Math.round((result.overallScore / 3.0) * 100);
    console.log(`${result.family}:`);
    console.log(`   Overall Score: ${result.overallScore.toFixed(1)}/3.0 (${percentage}%)`);
    console.log(`   Risk Level: ${String(result.overallRiskLevel).toUpperCase()}`);
    console.log(`   Pillars Assessed: ${result.pillarCount}/6`);
    console.log(`   Recommendations: ${result.recommendationCount}`);
    console.log('');
  });

  console.log('🎉 Multi-pillar assessment examples completed successfully!');

  return results;
}

// Export for testing and usage
export { runCompleteAssessment, runAllFamilyExamples, FAMILY_PROFILES };

// Run if called directly
if (require.main === module) {
  runAllFamilyExamples().catch(console.error);
}