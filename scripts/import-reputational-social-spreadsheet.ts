/**
 * @deprecated AssessmentBankQuestion was removed. Use admin question bank or pillar DDL seed.
 */
import "./load-repo-env";

async function main(): Promise<void> {
  throw new Error(
    "import:reputational-social is deprecated. Add reputational-social questions via " +
      "/admin/question-bank or extend scripts/sql/belvedere-pillar-ddl-seed.sql.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
