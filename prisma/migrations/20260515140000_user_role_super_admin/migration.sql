-- Platform super-admin role (highest privilege). No automatic backfill:
-- promote users manually (see scripts/set-super-admin-role.js) or SQL:
--   UPDATE "User" SET role = 'SUPER_ADMIN' WHERE id = '<user id>';
ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';
