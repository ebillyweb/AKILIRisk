import 'server-only';

import { headers } from 'next/headers';
import { buildTenantScopedPublicPath } from '@/lib/advisor/tenant-path-portals';

export async function getTenantPathPrefixFromHeaders(): Promise<string | null> {
  return (await headers()).get('x-tenant-path-prefix');
}

export async function tenantPublicPath(appPath: string): Promise<string> {
  const prefix = await getTenantPathPrefixFromHeaders();
  return buildTenantScopedPublicPath(appPath, prefix);
}
