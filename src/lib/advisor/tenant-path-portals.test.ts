import { afterEach, describe, expect, it } from 'vitest';
import {
  buildStagingTenantPathPrefix,
  buildStagingTenantPortalUrl,
  buildTenantScopedPublicPath,
  parseStagingTenantPathRoute,
  usesStagingTenantPathPortals,
} from './tenant-path-portals';

describe('tenant-path-portals', () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it('parses /t/{slug} and nested paths', () => {
    expect(parseStagingTenantPathRoute('/t/northbridgeelite')).toEqual({
      slug: 'northbridgeelite',
      restPath: '/',
    });
    expect(parseStagingTenantPathRoute('/t/northbridgeelite/signin')).toEqual({
      slug: 'northbridgeelite',
      restPath: '/signin',
    });
    expect(parseStagingTenantPathRoute('/pricing')).toBeNull();
    expect(parseStagingTenantPathRoute('/t/www')).toBeNull();
  });

  it('builds staging portal URLs', () => {
    process.env.PRODUCTION_DOMAIN = 'akilirisk.com';
    expect(buildStagingTenantPortalUrl('ebilly')).toBe(
      'https://preview.akilirisk.com/t/ebilly',
    );
    expect(buildStagingTenantPathPrefix('ebilly')).toBe('/t/ebilly');
  });

  it('scopes public paths under /t/{slug}', () => {
    expect(buildTenantScopedPublicPath('/signin', '/t/ebilly')).toBe('/t/ebilly/signin');
    expect(buildTenantScopedPublicPath('/', '/t/ebilly')).toBe('/t/ebilly');
    expect(buildTenantScopedPublicPath('/signin', null)).toBe('/signin');
  });

  it('defaults path portals on Vercel preview', () => {
    process.env.VERCEL_ENV = 'preview';
    delete process.env.TENANT_PATH_PORTALS;
    expect(usesStagingTenantPathPortals()).toBe(true);

    process.env.TENANT_PATH_PORTALS = 'false';
    expect(usesStagingTenantPathPortals()).toBe(false);
  });
});
