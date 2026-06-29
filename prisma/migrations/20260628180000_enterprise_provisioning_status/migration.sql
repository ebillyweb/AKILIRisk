-- Async enterprise provision: firm shell created immediately, heavy setup completes in background.
ALTER TYPE "AdvisorEnterpriseStatus" ADD VALUE IF NOT EXISTS 'PROVISIONING' BEFORE 'SUSPENDED';
