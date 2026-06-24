/**
 * Master Deployment Script - Complete Assessment System
 *
 * Deploys all 6 assessment pillars with questions, rules, and recommendations
 */

import "./load-repo-env";
import { PillarCategoryKind } from "@prisma/client";
import { deploymentVisibleQuestionCount } from "../src/lib/assessment/bank/deployment-question-count";
import { prisma, disconnectPrismaScript } from './lib/prisma-for-scripts';
import { importCybersecurityQuestions, addCybersecurityRecommendations } from './import-belvedere-cybersecurity';
import { setupCybersecurityRules } from './setup-cybersecurity-rules';
import { setupAllPillarRules } from './setup-all-pillar-rules';

interface DeploymentStep {
  name: string;
  description: string;
  execute: () => Promise<any>;
  required: boolean;
}

async function deployCompleteAssessmentSystem() {
  console.log('🚀 DEPLOYING COMPLETE ASSESSMENT SYSTEM');
  console.log('=' .repeat(50));
  console.log('This will deploy all 6 assessment pillars with:');
  console.log('  📋 150+ assessment questions');
  console.log('  🎯 25+ service recommendations');
  console.log('  ⚙️ 40+ recommendation rules');
  console.log('  🧮 Advanced scoring rules');
  console.log('  📊 Comprehensive reporting');
  console.log('=' .repeat(50));

  let questionsLoadedFromBelvedereWorkbook = false;

  const deploymentSteps: DeploymentStep[] = [
    {
      name: 'Database Schema',
      description: 'Verify enhanced assessment schema is deployed',
      execute: async () => {
        // Check if enhanced tables exist
        try {
          const serviceCount = await prisma.serviceRecommendation.count();
          const scoringRuleCount = await prisma.scoringRule.count();
          const recommendationRuleCount = await prisma.recommendationRule.count();

          console.log(`     ✅ ServiceRecommendation table: ${serviceCount} existing records`);
          console.log(`     ✅ ScoringRule table: ${scoringRuleCount} existing records`);
          console.log(`     ✅ RecommendationRule table: ${recommendationRuleCount} existing records`);

          return { serviceCount, scoringRuleCount, recommendationRuleCount };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.log(`     ⚠️ Schema check failed: ${msg}`);
          console.log('     💡 Apply migrations: npx prisma migrate deploy   (or dev: npx prisma migrate dev)');
          return { error: 'Schema check failed' };
        }
      },
      required: true
    },

    {
      name: 'Pillar Question Bank',
      description: 'Verify platform question banks (`questions`) are seeded',
      execute: async () => {
        const scoredCount = await prisma.pillarQuestion.count({
          where: {
            section: { category: { kind: { not: PillarCategoryKind.INTAKE } } },
          },
        });
        if (scoredCount === 0) {
          throw new Error(
            'No pillar assessment questions found. Run `npm run seed:pillar-ddl` after migrations.',
          );
        }
        console.log(`     ✅ Pillar question bank: ${scoredCount} scored questions`);
        questionsLoadedFromBelvedereWorkbook = true;
        return { source: 'pillar-ddl', questionCount: scoredCount };
      },
      required: true
    },

    {
      name: 'Import Cybersecurity (workbook tab / CSV)',
      description:
        'Cyber questions if not already loaded from the workbook (or legacy CSV when workbook has no Cyber tab)',
      execute: async () => {
        if (questionsLoadedFromBelvedereWorkbook) {
          console.log('     ⏭️ Cybersecurity tab was included in workbook import; skipping this step.');
          return { skipped: true, reason: 'Already imported via workbook' };
        }
        try {
          console.log('     🔐 Importing cybersecurity questions (workbook tab or legacy CSV)...');
          const result = await importCybersecurityQuestions();
          console.log(`     ✅ Imported ${result} cybersecurity questions`);
          return result;
        } catch {
          console.log('     ⚠️ Cyber import skipped — optional (no workbook tab / CSV)');
          return { skipped: true, reason: 'No cyber data source' };
        }
      },
      required: false
    },

    {
      name: 'Setup Cybersecurity Services',
      description: 'Add cybersecurity-specific service recommendations',
      execute: async () => {
        console.log('     🔐 Adding cybersecurity service recommendations...');
        const result = await addCybersecurityRecommendations();
        console.log(`     ✅ Added cybersecurity services`);
        return result;
      },
      required: true
    },

    {
      name: 'Setup All Service Recommendations',
      description: 'Add service recommendations for all pillars',
      execute: async () => {
        console.log('     💼 Setting up all pillar service recommendations and rules...');
        const result = await setupAllPillarRules();
        console.log(`     ✅ Added all service recommendations and rules`);
        return result;
      },
      required: true
    },

    {
      name: 'Setup Cybersecurity Rules',
      description: 'Configure cybersecurity-specific recommendation rules',
      execute: async () => {
        console.log('     🔐 Setting up cybersecurity recommendation rules...');
        const result = await setupCybersecurityRules();
        console.log(`     ✅ Configured cybersecurity rules`);
        return result;
      },
      required: true
    },

    {
      name: 'Validate Deployment',
      description: 'Verify all components are properly deployed',
      execute: async () => {
        console.log('     🔍 Validating deployment...');

        const validation = await validateDeployment();

        console.log(`     📊 Questions: ${validation.questionCount} across ${validation.pillarCount} pillars`);
        console.log(`     💼 Services: ${validation.serviceCount} recommendations available`);
        console.log(`     ⚙️ Rules: ${validation.recommendationRuleCount} recommendation rules`);
        console.log(`     🧮 Scoring: ${validation.scoringRuleCount} advanced scoring rules`);

        if (validation.isValid) {
          console.log(`     ✅ Deployment validation passed`);
        } else {
          console.log(`     ❌ Deployment validation failed`);
          console.log(`     Issues: ${validation.issues.join(', ')}`);
        }

        return validation;
      },
      required: true
    }
  ];

  let stepNumber = 1;
  const results: Record<string, any> = {};

  for (const step of deploymentSteps) {
    console.log(`\n${stepNumber}. ${step.name}`);
    console.log(`   ${step.description}`);

    try {
      const result = await step.execute();
      const stepFailed = Boolean(result?.error);
      results[step.name] = { success: !stepFailed, result };

      if (step.required && stepFailed) {
        console.log(`   ❌ Required step failed: ${result.error}`);
        break;
      }

    } catch (error) {
      console.error(`   ❌ Step failed:`, error);
      results[step.name] = { success: false, error };

      if (step.required) {
        console.log(`   🛑 Stopping deployment due to required step failure`);
        break;
      }
    }

    stepNumber++;
  }

  // Final deployment summary
  console.log('\n' + '='.repeat(50));
  console.log('🎉 DEPLOYMENT COMPLETE');
  console.log('=' .repeat(50));

  const successfulSteps = Object.values(results).filter(r => r.success).length;
  const totalSteps = Object.keys(results).length;

  console.log(`✅ Successful steps: ${successfulSteps}/${totalSteps}`);

  if (results['Validate Deployment']?.success) {
    const validation = results['Validate Deployment'].result;
    console.log(`\n📊 SYSTEM STATUS:`);
    console.log(`   Questions: ${validation.questionCount} across ${validation.pillarCount} pillars`);
    console.log(`   Services: ${validation.serviceCount} recommendations`);
    console.log(`   Rules: ${validation.recommendationRuleCount} recommendation + ${validation.scoringRuleCount} scoring`);

    console.log(`\n🧪 TESTING:`);
    console.log(`   Run: npx tsx examples/complete-assessment-example.ts`);

    console.log(`\n🌐 API ENDPOINTS:`);
    console.log(`   GET /api/assessment/enhanced/pillars`);
    console.log(`   POST /api/assessment/enhanced/create`);
    console.log(`   POST /api/assessment/enhanced/submit`);
    console.log(`   GET /api/assessment/enhanced/[id]/results`);

    console.log(`\n📁 IMPLEMENTATION FILES:`);
    console.log(`   Enhanced Scoring: src/lib/assessment/engines/enhanced-scoring-engine.ts`);
    console.log(`   Recommendations: src/lib/assessment/engines/recommendation-engine.ts`);
    console.log(`   Rule Engine: src/lib/assessment/engines/rule-engine.ts`);
    console.log(`   Import Pipeline: src/lib/assessment/import/spreadsheet-importer.ts`);

  } else {
    console.log(`❌ Deployment validation failed - check errors above`);
  }

  return results;
}

async function validateDeployment() {
  try {
    // Check questions across all pillars
    const pillars = await prisma.pillarConfiguration.findMany({
      where: { isActive: true }
    });

    const pillarTotalCount = await prisma.pillarQuestion.count();
    const pillarVisibleCount = await prisma.pillarQuestion.count({
      where: {
        isVisible: true,
        section: { category: { kind: { not: PillarCategoryKind.INTAKE } } },
      },
    });
    const mergedVisibleCount = deploymentVisibleQuestionCount({
      pillarVisibleCount,
    });

    const services = await prisma.serviceRecommendation.findMany({
      where: { isActive: true }
    });

    const recommendationRules = await prisma.recommendationRule.findMany({
      where: { isActive: true }
    });

    const scoringRules = await prisma.scoringRule.findMany({
      where: { isActive: true }
    });

    const subcategories = await prisma.subCategoryConfiguration.findMany({
      where: { isActive: true }
    });

    // Validate minimum requirements
    const issues = [];

    if (pillars.length < 5) {
      issues.push(`Only ${pillars.length} pillars configured (expected 6)`);
    }

    if (mergedVisibleCount < 50) {
      issues.push(
        `Only ${mergedVisibleCount} visible pillar questions (expected 50+). Pillar DDL total=${pillarTotalCount}, pillar visible=${pillarVisibleCount}. Run npm run seed:pillar-ddl.`
      );
    }

    if (services.length < 15) {
      issues.push(`Only ${services.length} services (expected 20+)`);
    }

    if (recommendationRules.length < 15) {
      issues.push(`Only ${recommendationRules.length} rules (expected 20+)`);
    }

    // Check pillar coverage
    const pillarIds = pillars.map(p => p.pillarId);
    const expectedPillars = ['governance', 'cyber-digital', 'physical-security', 'insurance', 'geographic-environmental', 'reputational-social'];
    const missingPillars = expectedPillars.filter(p => !pillarIds.includes(p));

    if (missingPillars.length > 0) {
      issues.push(`Missing pillars: ${missingPillars.join(', ')}`);
    }

    return {
      isValid: issues.length === 0,
      issues,
      questionCount: mergedVisibleCount,
      pillarCount: pillars.length,
      serviceCount: services.length,
      recommendationRuleCount: recommendationRules.length,
      scoringRuleCount: scoringRules.length,
      subcategoryCount: subcategories.length,
      pillarCoverage: pillarIds
    };

  } catch (error) {
    return {
      isValid: false,
      issues: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      questionCount: 0,
      pillarCount: 0,
      serviceCount: 0,
      recommendationRuleCount: 0,
      scoringRuleCount: 0
    };
  }
}

// Quick deployment check
export async function checkDeploymentStatus() {
  console.log('📊 CHECKING DEPLOYMENT STATUS...\n');

  try {
    const validation = await validateDeployment();

    if (validation.isValid) {
      console.log('✅ Assessment system is properly deployed');
      console.log(`   📋 ${validation.questionCount} questions across ${validation.pillarCount} pillars`);
      console.log(`   💼 ${validation.serviceCount} service recommendations`);
      console.log(`   ⚙️ ${validation.recommendationRuleCount} recommendation rules`);
      console.log(`   🧮 ${validation.scoringRuleCount} scoring rules`);

      console.log('\n🧪 Ready to test:');
      console.log('   npx tsx examples/complete-assessment-example.ts');

    } else {
      console.log('❌ Assessment system deployment incomplete');
      console.log('Issues found:');
      validation.issues.forEach(issue => console.log(`   • ${issue}`));

      console.log('\n🚀 To deploy:');
      console.log('   npx tsx scripts/deploy-complete-assessment-system.ts');
    }

    return validation;

  } catch (error) {
    console.error('💥 Status check failed:', error);
    return { isValid: false, error };
  }
}

async function main() {
  try {
    const results = await deployCompleteAssessmentSystem();

    const allSuccessful = Object.values(results).every(r => r.success);
    if (allSuccessful) {
      console.log('\n🎉 Complete assessment system deployment successful!');
      process.exit(0);
    } else {
      console.log('\n⚠️ Deployment completed with some issues');
      process.exit(1);
    }

  } catch (error) {
    console.error('💥 Deployment failed:', error);
    process.exit(1);
  } finally {
    await disconnectPrismaScript();
  }
}

if (require.main === module) {
  main();
}

export { deployCompleteAssessmentSystem, validateDeployment };