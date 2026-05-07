/**
 * Flexible Rule Engine
 *
 * Supports complex business logic through JSON-defined rules
 * that can be updated without code changes.
 */

export interface Rule {
  id: string;
  name: string;
  description: string;
  type: 'scoring' | 'recommendation' | 'branching' | 'validation';
  priority: number;
  conditions: RuleCondition;
  actions: RuleAction[];
  metadata?: Record<string, any>;
}

export interface RuleCondition {
  operator: 'and' | 'or';
  conditions: Array<SimpleCondition | RuleCondition>;
}

export interface SimpleCondition {
  type: 'answer' | 'score' | 'profile' | 'aggregate';
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'in' | 'contains' | 'exists';
  value: any;
  questionId?: string;
  pillarId?: string;
}

export interface RuleAction {
  type: 'modify_score' | 'add_recommendation' | 'set_flag' | 'trigger_rule';
  parameters: Record<string, any>;
}

export class RuleEngine {
  private rules: Map<string, Rule> = new Map();

  constructor() {
    this.loadRules();
  }

  /**
   * Evaluate all rules for a given context
   */
  async evaluateRules(context: RuleContext): Promise<RuleExecutionResult[]> {
    const results: RuleExecutionResult[] = [];

    // Sort rules by priority
    const sortedRules = Array.from(this.rules.values())
      .filter(rule => this.isRuleApplicable(rule, context))
      .sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      try {
        const conditionsMet = this.evaluateConditions(rule.conditions, context);

        if (conditionsMet) {
          const actionResults = await this.executeActions(rule.actions, context);
          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            executed: true,
            actionResults,
            timestamp: new Date()
          });
        }
      } catch (error) {
        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          executed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        });
      }
    }

    return results;
  }

  /**
   * Evaluate rule conditions recursively
   */
  private evaluateConditions(condition: RuleCondition, context: RuleContext): boolean {
    if (condition.operator === 'and') {
      return condition.conditions.every(c =>
        this.isSimpleCondition(c) ?
          this.evaluateSimpleCondition(c, context) :
          this.evaluateConditions(c, context)
      );
    } else {
      return condition.conditions.some(c =>
        this.isSimpleCondition(c) ?
          this.evaluateSimpleCondition(c, context) :
          this.evaluateConditions(c, context)
      );
    }
  }

  private evaluateSimpleCondition(condition: SimpleCondition, context: RuleContext): boolean {
    let actualValue: any;

    switch (condition.type) {
      case 'answer':
        actualValue = context.answers[condition.questionId || condition.field];
        break;
      case 'score':
        actualValue = context.scores[condition.pillarId || condition.field];
        break;
      case 'profile':
        actualValue = this.getNestedValue(context.profile, condition.field);
        break;
      case 'aggregate':
        actualValue = this.calculateAggregate(condition.field, context);
        break;
      default:
        return false;
    }

    return this.compareValues(actualValue, condition.operator, condition.value);
  }

  private compareValues(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'not_equals':
        return actual !== expected;
      case 'greater_than':
        return Number(actual) > Number(expected);
      case 'less_than':
        return Number(actual) < Number(expected);
      case 'in':
        return Array.isArray(expected) && expected.includes(actual);
      case 'contains':
        return Array.isArray(actual) && actual.includes(expected);
      case 'exists':
        return actual !== undefined && actual !== null;
      default:
        return false;
    }
  }

  private async executeActions(actions: RuleAction[], context: RuleContext): Promise<any[]> {
    const results = [];

    for (const action of actions) {
      try {
        const result = await this.executeAction(action, context);
        results.push(result);
      } catch (error) {
        results.push({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return results;
  }

  private async executeAction(action: RuleAction, context: RuleContext): Promise<any> {
    switch (action.type) {
      case 'modify_score':
        return this.modifyScore(action.parameters, context);
      case 'add_recommendation':
        return this.addRecommendation(action.parameters, context);
      case 'set_flag':
        return this.setFlag(action.parameters, context);
      case 'trigger_rule':
        return this.triggerRule(action.parameters, context);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private modifyScore(params: any, context: RuleContext): any {
    // Implementation for score modification
    return { action: 'modify_score', params, context: context.assessmentId };
  }

  private addRecommendation(params: any, context: RuleContext): any {
    // Implementation for adding recommendations
    return { action: 'add_recommendation', params, context: context.assessmentId };
  }

  private setFlag(params: any, context: RuleContext): any {
    // Implementation for setting flags
    return { action: 'set_flag', params, context: context.assessmentId };
  }

  private triggerRule(params: any, context: RuleContext): any {
    // Implementation for triggering other rules
    return { action: 'trigger_rule', params, context: context.assessmentId };
  }

  private isRuleApplicable(rule: Rule, context: RuleContext): boolean {
    // Check if rule should be evaluated for this context
    return true; // Implement filtering logic based on context
  }

  private isSimpleCondition(condition: any): condition is SimpleCondition {
    return 'type' in condition && 'field' in condition;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private calculateAggregate(field: string, context: RuleContext): any {
    // Implement aggregate calculations (sum, average, count, etc.)
    return 0;
  }

  private async loadRules(): Promise<void> {
    // Load rules from database
    // This would be implemented to fetch from your database
  }
}

export interface RuleContext {
  assessmentId: string;
  userId: string;
  answers: Record<string, unknown>;
  scores: Record<string, number>;
  profile: any;
  metadata?: Record<string, any>;
}

export interface RuleExecutionResult {
  ruleId: string;
  ruleName: string;
  executed: boolean;
  actionResults?: any[];
  error?: string;
  timestamp: Date;
}

// Example rule definitions:

export const EXAMPLE_SCORING_RULE: Rule = {
  id: "cyber_multi_factor_bonus",
  name: "Multi-Factor Authentication Bonus",
  description: "Increase cyber score when multiple MFA methods are used",
  type: "scoring",
  priority: 100,
  conditions: {
    operator: "and",
    conditions: [
      {
        type: "answer",
        questionId: "cyber_mfa_enabled",
        field: "cyber_mfa_enabled",
        operator: "equals",
        value: "yes"
      },
      {
        type: "answer",
        questionId: "cyber_mfa_methods_count",
        field: "cyber_mfa_methods_count",
        operator: "greater_than",
        value: 1
      }
    ]
  },
  actions: [
    {
      type: "modify_score",
      parameters: {
        pillarId: "cyber-digital",
        modifier: "add",
        value: 0.5
      }
    }
  ]
};

export const EXAMPLE_RECOMMENDATION_RULE: Rule = {
  id: "high_net_worth_estate_planning",
  name: "Estate Planning for High Net Worth",
  description: "Recommend estate planning services for high net worth families",
  type: "recommendation",
  priority: 90,
  conditions: {
    operator: "and",
    conditions: [
      {
        type: "profile",
        field: "netWorth",
        operator: "greater_than",
        value: 10000000
      },
      {
        type: "score",
        pillarId: "governance",
        field: "governance",
        operator: "less_than",
        value: 2.0
      }
    ]
  },
  actions: [
    {
      type: "add_recommendation",
      parameters: {
        serviceId: "estate_planning_comprehensive",
        priority: "high",
        customMessage: "Given your family's wealth level, comprehensive estate planning is critical."
      }
    }
  ]
};

export const EXAMPLE_CONDITIONAL_SCORING_RULE: Rule = {
  id: "family_business_governance_weight",
  name: "Family Business Governance Weighting",
  description: "Increase governance weight for families with business interests",
  type: "scoring",
  priority: 85,
  conditions: {
    operator: "or",
    conditions: [
      {
        type: "answer",
        questionId: "governance_family_business",
        field: "governance_family_business",
        operator: "equals",
        value: "yes"
      },
      {
        type: "profile",
        field: "businessOwnership",
        operator: "greater_than",
        value: 0.25
      }
    ]
  },
  actions: [
    {
      type: "modify_score",
      parameters: {
        pillarId: "governance",
        weightMultiplier: 1.5
      }
    }
  ]
};