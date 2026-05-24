/**
 * Complete working example of cybersecurity assessment
 * Based on your actual Belvedere spreadsheet structure
 */

import './load-example-env';
import { EnhancedScoringEngine } from '@/lib/assessment/engines/enhanced-scoring-engine';
import { RecommendationEngine } from '@/lib/assessment/engines/recommendation-engine';
import { loadGovernanceQuestionsMerged } from '@/lib/assessment/bank/load-bank';
import { prisma } from '@/lib/db';
import { resolveExampleAssessmentUserId } from './resolve-example-user';

// Example assessment answers based on your question structure
const EXAMPLE_FAMILY_ANSWERS = {
  // Category A: Household Governance
  'cyber_a_password_device_management': 'informal',              // Score: 1
  'cyber_a_family_online_rules': 'verbal',                       // Score: 1
  'cyber_a_family_education': 'one_time',                        // Score: 1
  'cyber_a_risk_awareness': 'basic',                             // Score: 1
  'cyber_a_cyber_insurance': 'none',                             // Score: 0
  'cyber_a_travel_practices': 'minimal',                         // Score: 1

  // Category B: Devices & Network
  'cyber_b_device_inventory': 'partial',                         // Score: 1
  'cyber_b_software_updates': 'manual',                          // Score: 1
  'cyber_b_auto_updates': 'some_devices',                        // Score: 1
  'cyber_b_network_segmentation': 'none',                        // Score: 0
  'cyber_b_wifi_security': 'moderate',                           // Score: 1

  // Category C: Accounts & Access
  'cyber_c_password_manager': 'some_complexity',                 // Score: 1
  'cyber_c_mfa_enabled': 'limited',                              // Score: 1
  'cyber_c_account_access_control': 'informal',                  // Score: 1

  // Category D: Data & Privacy
  'cyber_d_backup_security': 'irregular',                        // Score: 1
  'cyber_d_backup_testing': 'rare',                              // Score: 1
  'cyber_d_sensitive_data_sharing': 'occasional',                // Score: 1
  'cyber_d_privacy_settings': 'basic',                           // Score: 1

  // Category E: Financial & Identity Risk
  'cyber_e_financial_monitoring': 'partial',                     // Score: 1
  'cyber_e_reputation_monitoring': 'none',                       // Score: 0
  'cyber_e_account_review': 'irregular',                         // Score: 1

  // Category F: Incident Response & Recovery
  'cyber_f_fraud_response_plan': 'informal',                     // Score: 1
  'cyber_f_device_loss_plan': 'basic',                           // Score: 1
  'cyber_f_account_compromise_plan': 'ad_hoc',                   // Score: 1
  'cyber_f_recovery_contacts': 'scattered',                      // Score: 1
  'cyber_f_credential_storage': 'basic',                         // Score: 1
  'cyber_f_lessons_learned': 'none'                              // Score: 0
};

async function runCybersecurityAssessmentExample() {
  console.log('🔐 Running Cybersecurity Assessment Example');
  console.log('=' .repeat(50));

  try {
    const userId = await resolveExampleAssessmentUserId();

    // 1. Create assessment
    console.log('1. Creating assessment...');
    const assessment = await prisma.assessment.create({
      data: {
        userId,
        version: 1,
        status: 'IN_PROGRESS',
        currentPillar: 'cybersecurity'
      }
    });

    console.log(`   ✅ Created assessment: ${assessment.id}`);

    // 2. Submit answers
    console.log('\n2. Submitting answers...');
    const answerPromises = Object.entries(EXAMPLE_FAMILY_ANSWERS).map(([questionId, answer]) =>
      prisma.assessmentResponse.create({
        data: {
          assessmentId: assessment.id,
          questionId,
          pillar: 'cybersecurity',
          subCategory: getSubCategoryFromQuestionId(questionId),
          answer,
          skipped: false
        }
      })
    );

    await Promise.all(answerPromises);
    console.log(`   ✅ Submitted ${Object.keys(EXAMPLE_FAMILY_ANSWERS).length} answers`);

    // 3. Calculate enhanced score
    console.log('\n3. Calculating enhanced score...');
    const scoringEngine = new EnhancedScoringEngine();

    // Load questions for cybersecurity pillar
    const questions = await loadCybersecurityQuestions();

    const scoreResult = await scoringEngine.calculateAdvancedPillarScore({
      answers: EXAMPLE_FAMILY_ANSWERS,
      householdProfile: {
        size: 4,
        travelFrequency: 'frequent',
        netWorth: 5000000
      },
      assessmentId: assessment.id,
      pillarId: 'cybersecurity'
    }, questions);

    console.log(`   📊 Cybersecurity Score: ${scoreResult.score}/3.0`);
    console.log(`   🚨 Risk Level: ${scoreResult.riskLevel.toUpperCase()}`);
    console.log(`   ❌ Missing Controls: ${scoreResult.missingControls.length}`);

    // 4. Save pillar score
    console.log('\n4. Saving pillar score...');
    const pillarScore = await prisma.pillarScore.create({
      data: {
        assessmentId: assessment.id,
        pillar: 'cybersecurity',
        score: scoreResult.score,
        riskLevel: scoreResult.riskLevel.toUpperCase() as any,
        breakdown: scoreResult.breakdown,
        missingControls: scoreResult.missingControls
      }
    });

    console.log(`   ✅ Saved pillar score`);

    // 5. Generate recommendations
    console.log('\n5. Generating recommendations...');
    const recommendationEngine = new RecommendationEngine();

    const recommendations = await recommendationEngine.generateRecommendations({
      assessmentId: assessment.id,
      userId,
      pillarScores: {
        cybersecurity: {
          score: scoreResult.score,
          riskLevel: scoreResult.riskLevel
        }
      },
      answers: EXAMPLE_FAMILY_ANSWERS,
      householdProfile: {
        size: 4,
        travelFrequency: 'frequent',
        netWorth: 5000000
      },
      missingControls: scoreResult.missingControls
    });

    console.log(`   💡 Generated ${recommendations.length} recommendations`);

    // 6. Display detailed results
    console.log('\n' + '='.repeat(50));
    console.log('📋 ASSESSMENT RESULTS SUMMARY');
    console.log('=' .repeat(50));

    console.log(`\n📊 CYBERSECURITY SCORE: ${scoreResult.score}/3.0`);
    console.log(`🎯 RISK LEVEL: ${scoreResult.riskLevel.toUpperCase()}`);

    // Map score to your risk tier system
    const riskTier = getRiskTier(scoreResult.score);
    console.log(`📈 RISK TIER: ${riskTier.name} (${riskTier.range})`);
    console.log(`📝 REQUIRED ACTION: ${riskTier.requiredAction}`);

    console.log(`\n📂 CATEGORY BREAKDOWN:`);
    scoreResult.breakdown.forEach(category => {
      const percentage = Math.round((category.score / category.maxScore) * 100);
      console.log(`   ${category.categoryName}: ${category.score}/${category.maxScore} (${percentage}%)`);
    });

    console.log(`\n❌ MISSING CONTROLS (${scoreResult.missingControls.length}):`);
    scoreResult.missingControls.slice(0, 5).forEach((control, index) => {
      console.log(`   ${index + 1}. [${control.severity.toUpperCase()}] ${control.description}`);
      console.log(`      → ${control.recommendation}`);
    });

    console.log(`\n💡 RECOMMENDATIONS (${recommendations.length}):`);
    recommendations.slice(0, 3).forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec.name} (${rec.category})`);
      console.log(`      Cost: ${rec.estimatedCost || 'TBD'}`);
      console.log(`      Time: ${rec.timeframe || 'TBD'}`);
      console.log(`      Priority: ${rec.priority}`);
    });

    // 7. Complete assessment
    console.log('\n6. Completing assessment...');
    await prisma.assessment.update({
      where: { id: assessment.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });

    console.log(`   ✅ Assessment completed`);

    console.log('\n🎉 CYBERSECURITY ASSESSMENT COMPLETE!');
    return {
      assessmentId: assessment.id,
      score: scoreResult.score,
      riskLevel: scoreResult.riskLevel,
      riskTier,
      recommendations: recommendations.length,
      missingControls: scoreResult.missingControls.length
    };

  } catch (error) {
    console.error('❌ Assessment failed:', error);
    throw error;
  }
}

function getSubCategoryFromQuestionId(questionId: string): string {
  if (questionId.includes('_a_')) return 'household_governance';
  if (questionId.includes('_b_')) return 'devices_network';
  if (questionId.includes('_c_')) return 'accounts_access';
  if (questionId.includes('_d_')) return 'data_privacy';
  if (questionId.includes('_e_')) return 'financial_identity';
  if (questionId.includes('_f_')) return 'incident_response';
  return 'unknown';
}

function getRiskTier(score: number) {
  const percentage = (score / 3.0) * 100;

  if (percentage >= 80) {
    return {
      name: 'Low Risk / Resilient',
      range: '80-100%',
      requiredAction: 'Annual testing (phishing simulations, backup validation)',
      description: 'Strong controls; resilient to most common attack vectors'
    };
  } else if (percentage >= 60) {
    return {
      name: 'Moderate Risk',
      range: '60-79%',
      requiredAction: 'Targeted remediation (MFA rollout, device hardening, training)',
      description: 'Some exploitable gaps; requires targeted improvements'
    };
  } else if (percentage >= 40) {
    return {
      name: 'Elevated Risk',
      range: '40-59%',
      requiredAction: 'Full cybersecurity uplift (access control, network segmentation, monitoring)',
      description: 'Likely vulnerability to phishing, account takeover, or device compromise'
    };
  } else {
    return {
      name: 'High / Critical Risk',
      range: '<40%',
      requiredAction: 'Immediate intervention (incident readiness, credential reset, system hardening)',
      description: 'Significant exposure; high probability of successful attack'
    };
  }
}

async function loadCybersecurityQuestions() {
  return loadGovernanceQuestionsMerged({
    onlyVisible: true,
    riskAreaId: 'cyber-digital',
  });
}

// Quick test with different risk profiles
export async function testMultipleRiskProfiles() {
  console.log('🧪 Testing Multiple Risk Profiles');
  console.log('=' .repeat(40));

  const profiles = [
    {
      name: 'High-Risk Family',
      answers: {
        'cyber_a_password_device_management': 'no_ownership',
        'cyber_a_cyber_insurance': 'none',
        'cyber_b_network_segmentation': 'none',
        'cyber_c_password_manager': 'reused_simple',
        'cyber_c_mfa_enabled': 'none',
        'cyber_f_fraud_response_plan': 'none'
      }
    },
    {
      name: 'Moderate-Risk Family',
      answers: {
        'cyber_a_password_device_management': 'assigned',
        'cyber_a_cyber_insurance': 'exploring',
        'cyber_b_network_segmentation': 'limited',
        'cyber_c_password_manager': 'password_manager',
        'cyber_c_mfa_enabled': 'critical_enabled',
        'cyber_f_fraud_response_plan': 'defined'
      }
    },
    {
      name: 'Low-Risk Family',
      answers: {
        'cyber_a_password_device_management': 'centralized_audited',
        'cyber_a_cyber_insurance': 'active_aligned',
        'cyber_b_network_segmentation': 'fully_segmented',
        'cyber_c_password_manager': 'enterprise_grade',
        'cyber_c_mfa_enabled': 'universal_phishing_resistant',
        'cyber_f_fraud_response_plan': 'documented_rehearsed'
      }
    }
  ];

  for (const profile of profiles) {
    console.log(`\n📊 ${profile.name}:`);
    // Calculate score based on answers
    const avgScore = Object.values(profile.answers).reduce((sum, answer) => {
      const scoreMap = { 'none': 0, 'no_ownership': 0, 'reused_simple': 0, 'limited': 1, 'exploring': 1, 'assigned': 2, 'password_manager': 2, 'critical_enabled': 2, 'defined': 2, 'centralized_audited': 3, 'active_aligned': 3, 'fully_segmented': 3, 'enterprise_grade': 3, 'universal_phishing_resistant': 3, 'documented_rehearsed': 3 };
      return sum + (scoreMap[answer as keyof typeof scoreMap] || 1);
    }, 0) / Object.keys(profile.answers).length;

    const tier = getRiskTier(avgScore);
    console.log(`   Score: ${avgScore.toFixed(1)}/3.0`);
    console.log(`   Tier: ${tier.name}`);
    console.log(`   Action: ${tier.requiredAction}`);
  }
}

// Export for use in tests or other modules
export { runCybersecurityAssessmentExample, testMultipleRiskProfiles };

// Run example if called directly
if (require.main === module) {
  runCybersecurityAssessmentExample()
    .then(() => testMultipleRiskProfiles())
    .catch(console.error);
}