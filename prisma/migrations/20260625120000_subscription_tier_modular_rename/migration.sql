-- Modular tier rename: STARTER→ESSENTIALS, GROWTH→PROFESSIONAL, PROFESSIONAL→BUSINESS, +PLATINUM
-- Order matters: free the PROFESSIONAL label before reusing it.
-- Idempotent: skip renames if label already exists (shadow DB replays).

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PROFESSIONAL' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'SubscriptionTier'))
     AND NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'BUSINESS' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'SubscriptionTier'))
  THEN
    ALTER TYPE "SubscriptionTier" RENAME VALUE 'PROFESSIONAL' TO 'BUSINESS';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'GROWTH' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'SubscriptionTier'))
     AND NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PROFESSIONAL' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'SubscriptionTier'))
  THEN
    ALTER TYPE "SubscriptionTier" RENAME VALUE 'GROWTH' TO 'PROFESSIONAL';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'STARTER' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'SubscriptionTier'))
     AND NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ESSENTIALS' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'SubscriptionTier'))
  THEN
    ALTER TYPE "SubscriptionTier" RENAME VALUE 'STARTER' TO 'ESSENTIALS';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PLATINUM' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'SubscriptionTier'))
  THEN
    ALTER TYPE "SubscriptionTier" ADD VALUE 'PLATINUM' BEFORE 'ENTERPRISE';
  END IF;
END $$;
