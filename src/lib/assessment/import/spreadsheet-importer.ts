/**
 * Spreadsheet Import Pipeline
 *
 * Converts spreadsheet data into structured assessment bank questions,
 * scoring rules, and recommendation mappings.
 */

import * as XLSX from 'xlsx';
import { prisma } from '@/lib/db';
import { z } from 'zod';

export interface SpreadsheetRow {
  pillarId: string;
  subCategoryId: string;
  questionId: string;
  questionText: string;
  helpText?: string;
  learnMore?: string;
  riskRelevance?: string;
  questionType: string;
  options?: string; // JSON string or delimited
  required: boolean;
  weight: number;
  scoreMap: string; // JSON string
  branchingLogic?: string;
  recommendationTriggers?: string;
  remediationAction?: string;
}

// Validation schema for imported rows
const SpreadsheetRowSchema = z.object({
  pillarId: z.string().min(1),
  subCategoryId: z.string().min(1),
  questionId: z.string().min(1),
  questionText: z.string().min(1),
  helpText: z.string().optional(),
  learnMore: z.string().optional(),
  riskRelevance: z.string().optional(),
  questionType: z.enum(['single-choice', 'yes-no', 'maturity-scale', 'numeric', 'short-text']),
  options: z.string().optional(),
  required: z.boolean().default(true),
  weight: z.number().min(0).max(10),
  scoreMap: z.string(),
  branchingLogic: z.string().optional(),
  recommendationTriggers: z.string().optional(),
  remediationAction: z.string().optional(),
});

export class SpreadsheetImporter {
  private validationErrors: Array<{ row: number; errors: string[] }> = [];
  private transformationLog: Array<{ action: string; details: any }> = [];

  /**
   * Import assessment questions from Excel/CSV file
   */
  async importFromFile(filePath: string, options: ImportOptions = {}): Promise<ImportResult> {
    this.validationErrors = [];
    this.transformationLog = [];

    try {
      // Read and parse spreadsheet
      const workbook = XLSX.readFile(filePath);
      const sheetName = options.sheetName || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        return {
          success: false,
          errors: [{ row: -1, errors: [`Sheet not found: "${sheetName}". Available: ${workbook.SheetNames.join(', ')}`] }],
          importedCount: 0,
          transformationLog: this.transformationLog,
        };
      }
      const rawData = XLSX.utils.sheet_to_json(worksheet);

      // Normalize column names and transform data
      const normalizedData = this.normalizeColumnNames(rawData);
      let transformedRows = this.transformRows(normalizedData);

      if (options.pillarRiskAreaId) {
        const target = options.pillarRiskAreaId;
        const before = transformedRows.length;
        transformedRows = transformedRows.filter((r) => r.pillarId === target);
        if (transformedRows.length === 0 && before > 0) {
          return {
            success: false,
            errors: [
              {
                row: -1,
                errors: [
                  `No rows matched pillarRiskAreaId "${target}" after normalizing the Pillar column (${before} row(s) in sheet).`,
                ],
              },
            ],
            importedCount: 0,
            transformationLog: this.transformationLog,
          };
        }
      }

      // Validate all rows
      const validatedRows = this.validateRows(transformedRows);

      if (this.validationErrors.length > 0) {
        return {
          success: false,
          errors: this.validationErrors,
          importedCount: 0,
          transformationLog: this.transformationLog
        };
      }

      // Begin database transaction
      const result = await prisma.$transaction(async (tx) => {
        // Import questions
        const questionCount = await this.importQuestions(validatedRows, tx, options);

        // Import scoring rules
        const scoringRulesCount = await this.importScoringRules(validatedRows, tx);

        // Import recommendation rules
        const recommendationRulesCount = await this.importRecommendationRules(validatedRows, tx);

        // Create or update pillar/subcategory configurations
        await this.updatePillarConfigurations(validatedRows, tx);

        return {
          questions: questionCount,
          scoringRules: scoringRulesCount,
          recommendationRules: recommendationRulesCount
        };
      });

      return {
        success: true,
        importedCount: result.questions,
        errors: [],
        transformationLog: this.transformationLog,
        summary: result
      };

    } catch (error) {
      return {
        success: false,
        errors: [{ row: -1, errors: [error instanceof Error ? error.message : 'Unknown error'] }],
        importedCount: 0,
        transformationLog: this.transformationLog
      };
    }
  }

  /**
   * Normalize column names to match our expected format
   */
  private normalizeColumnNames(rawData: any[]): SpreadsheetRow[] {
    const columnMappings: Record<string, string> = {
      'Pillar': 'pillarId',
      'Risk Area': 'pillarId',
      'Category': 'subCategoryId',
      'Sub-Category': 'subCategoryId',
      'SubCategory': 'subCategoryId',
      'Question ID': 'questionId',
      'ID': 'questionId',
      'Question': 'questionText',
      'Question Text': 'questionText',
      'Help': 'helpText',
      'Help Text': 'helpText',
      'Learn More': 'learnMore',
      'Risk Relevance': 'riskRelevance',
      'Type': 'questionType',
      'Question Type': 'questionType',
      'Options': 'options',
      'Answer Options': 'options',
      'Required': 'required',
      'Weight': 'weight',
      'Score Map': 'scoreMap',
      'Scoring': 'scoreMap',
      'Branching': 'branchingLogic',
      'Branching Logic': 'branchingLogic',
      'Recommendations': 'recommendationTriggers',
      'Recommendation Triggers': 'recommendationTriggers',
      'Remediation': 'remediationAction',
      'Remediation Action': 'remediationAction',
    };

    return rawData.map((row, index) => {
      const normalizedRow: any = {};

      Object.entries(row).forEach(([key, value]) => {
        const normalizedKey = columnMappings[key] || key.toLowerCase().replace(/[^a-z0-9]/g, '');
        normalizedRow[normalizedKey] = value;
      });

      this.transformationLog.push({
        action: 'normalize_columns',
        details: { rowIndex: index, originalKeys: Object.keys(row), normalizedKeys: Object.keys(normalizedRow) }
      });

      return normalizedRow as SpreadsheetRow;
    });
  }

  /**
   * Transform and clean row data
   */
  private transformRows(rows: SpreadsheetRow[]): SpreadsheetRow[] {
    return rows.map((row, index) => {
      const transformed: SpreadsheetRow = {
        ...row,
        pillarId: this.normalizePillarId(row.pillarId),
        subCategoryId: this.normalizeSubCategoryId(row.subCategoryId),
        questionId: this.normalizeQuestionId(row.questionId),
        questionType: this.normalizeQuestionType(row.questionType),
        options: this.normalizeOptions(row.options),
        scoreMap: this.normalizeScoreMap(row.scoreMap),
        required: this.normalizeBoolean(row.required, true),
        weight: Number(row.weight) || 1,
      };

      this.transformationLog.push({
        action: 'transform_row',
        details: { rowIndex: index, changes: this.getRowChanges(row, transformed) }
      });

      return transformed;
    });
  }

  private normalizePillarId(value: string): string {
    if (value === undefined || value === null) return '';
    const v = typeof value === 'string' ? value.trim() : String(value).trim();
    if (!v || v === 'undefined') return '';
    const pillarMappings: Record<string, string> = {
      Governance: 'governance',
      Cyber: 'cyber-digital',
      Cybersecurity: 'cyber-digital',
      'Cyber Security': 'cyber-digital',
      Physical: 'physical-security',
      'Physical Security': 'physical-security',
      Insurance: 'insurance',
      Financial: 'insurance',
      Geographic: 'geographic-environmental',
      Environmental: 'geographic-environmental',
      Social: 'reputational-social',
      Reputational: 'reputational-social',
      Lifestyle: 'reputational-social',
      'Reputational & Social Risk': 'reputational-social',
      'Reputational & social risk': 'reputational-social',
      'Reputational and Social Risk': 'reputational-social',
      'Lifestyle & Behavioral Risk': 'reputational-social',
      'Lifestyle and Behavioral Risk': 'reputational-social',
      'reputational-social': 'reputational-social',
    };

    return pillarMappings[v] || v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  private normalizeSubCategoryId(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }

  private normalizeQuestionId(value: string): string {
    // Ensure question IDs are unique and valid
    return value.replace(/[^a-zA-Z0-9_-]/g, '');
  }

  private normalizeQuestionType(value: string): string {
    const typeMappings: Record<string, string> = {
      'Multiple Choice': 'single-choice',
      'Single Choice': 'single-choice',
      'Yes/No': 'yes-no',
      'Boolean': 'yes-no',
      'Scale': 'maturity-scale',
      'Maturity': 'maturity-scale',
      'Number': 'numeric',
      'Numeric': 'numeric',
      'Text': 'short-text',
      'String': 'short-text',
    };

    return typeMappings[value] || value.toLowerCase().replace(/[^a-z-]/g, '');
  }

  private normalizeOptions(value: string | undefined): string | undefined {
    if (!value) return undefined;

    try {
      // Try parsing as JSON first
      JSON.parse(value);
      return value;
    } catch {
      // If not JSON, assume delimited format and convert
      const options = value.split(/[;,|]/).map((opt, index) => ({
        value: index,
        label: opt.trim()
      }));
      return JSON.stringify(options);
    }
  }

  private normalizeScoreMap(value: string): string {
    try {
      // Try parsing as JSON first
      const parsed = JSON.parse(value);
      return JSON.stringify(parsed);
    } catch {
      // Handle common score map formats
      if (value.includes('=')) {
        // Format: "low=0, medium=1, high=2"
        const scoreMap: Record<string, number> = {};
        value.split(',').forEach(pair => {
          const [key, val] = pair.split('=').map(s => s.trim());
          if (key && val !== undefined) {
            scoreMap[key] = Number(val);
          }
        });
        return JSON.stringify(scoreMap);
      } else {
        // Assume simple numeric mapping
        const values = value.split(/[,;|]/).map(v => v.trim());
        const scoreMap: Record<string, number> = {};
        values.forEach((val, index) => {
          scoreMap[val] = index;
        });
        return JSON.stringify(scoreMap);
      }
    }
  }

  private normalizeBoolean(value: any, defaultValue: boolean): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === 'yes' || lower === '1') return true;
      if (lower === 'false' || lower === 'no' || lower === '0') return false;
    }
    return defaultValue;
  }

  /**
   * Validate all rows against schema
   */
  private validateRows(rows: SpreadsheetRow[]): SpreadsheetRow[] {
    const validRows: SpreadsheetRow[] = [];

    rows.forEach((row, index) => {
      const result = SpreadsheetRowSchema.safeParse(row);
      if (result.success) {
        validRows.push(result.data);
      } else {
        this.validationErrors.push({
          row: index + 2, // +2 for 1-based indexing and header row
          errors: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        });
      }
    });

    return validRows;
  }

  /**
   * Import questions into AssessmentBankQuestion table
   */
  private async importQuestions(rows: SpreadsheetRow[], tx: any, options: ImportOptions): Promise<number> {
    let importCount = 0;

    for (const row of rows) {
      const sortBase = options.sortOrderBase ?? 0;
      const questionData = {
        questionId: row.questionId,
        riskAreaId: row.pillarId,
        sortOrderGlobal: sortBase + importCount + 1,
        isVisible: true,
        text: row.questionText,
        helpText: row.helpText,
        learnMore: row.learnMore,
        riskRelevance: row.riskRelevance,
        type: row.questionType,
        options: row.options ? JSON.parse(row.options) : null,
        required: row.required,
        weight: row.weight,
        scoreMap: JSON.parse(row.scoreMap),
        branchingDependsOn: null, // This would need more complex parsing
        branchingPredicate: null,
        profileConditionKey: null,
        omitMaturityScoreWhenYes: false, // Default value
      };

      const upsert = options.updateExisting !== false;
      if (upsert) {
        await tx.assessmentBankQuestion.upsert({
          where: { questionId: row.questionId },
          create: questionData,
          update: questionData,
        });
      } else {
        await tx.assessmentBankQuestion.create({
          data: questionData,
        });
      }

      importCount++;
    }

    return importCount;
  }

  /**
   * Import scoring rules extracted from advanced scoring logic
   */
  private async importScoringRules(rows: SpreadsheetRow[], tx: any): Promise<number> {
    // This would extract and create advanced scoring rules based on
    // complex scoring logic found in the spreadsheet
    return 0; // Placeholder
  }

  /**
   * Import recommendation rules
   */
  private async importRecommendationRules(rows: SpreadsheetRow[], tx: any): Promise<number> {
    // This would create recommendation rules based on the
    // recommendation triggers column
    return 0; // Placeholder
  }

  /**
   * Update pillar and subcategory configurations
   */
  private async updatePillarConfigurations(rows: SpreadsheetRow[], tx: any): Promise<void> {
    // Extract unique pillars and subcategories from the data
    // and create/update configuration records
  }

  private getRowChanges(original: SpreadsheetRow, transformed: SpreadsheetRow): any {
    const changes: any = {};
    Object.keys(transformed).forEach(key => {
      if (original[key as keyof SpreadsheetRow] !== transformed[key as keyof SpreadsheetRow]) {
        changes[key] = {
          from: original[key as keyof SpreadsheetRow],
          to: transformed[key as keyof SpreadsheetRow]
        };
      }
    });
    return changes;
  }
}

export interface ImportOptions {
  sheetName?: string;
  /** When true (default), upsert by questionId. When false, create-only (fails on duplicate id). */
  updateExisting?: boolean;
  /** Only import rows whose normalized pillar id equals this (e.g. `lifestyle-behavioral-risk`). */
  pillarRiskAreaId?: string;
  /** Added to each row’s `sortOrderGlobal` (use max existing order for this pillar to append). */
  sortOrderBase?: number;
  dryRun?: boolean;
  skipValidation?: boolean;
}

export interface ImportResult {
  success: boolean;
  importedCount: number;
  errors: Array<{ row: number; errors: string[] }>;
  transformationLog: Array<{ action: string; details: any }>;
  summary?: any;
}

// Example usage:
/*
const importer = new SpreadsheetImporter();
const result = await importer.importFromFile('./assessment-questions.xlsx', {
  updateExisting: true,
  sheetName: 'Questions'
});

if (result.success) {
  console.log(`Successfully imported ${result.importedCount} questions`);
} else {
  console.error('Import failed:', result.errors);
}
*/