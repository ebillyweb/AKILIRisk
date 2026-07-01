import { afterEach, describe, expect, it } from 'vitest';
import {
  buildAdvisorPortalHostname,
  buildAdvisorPortalUrl,
  extractTenantSubdomainLabel,
  isCanonicalSubdomainSlug,
  isPlatformHostname,
  isPlatformSubdomainLabel,
  isSubdomainAutoActivateEnabled,
  toCanonicalSubdomainSlug,
  toTenantHostLabel,
} from './platform-subdomain';
import { isValidTenantPortalSlug } from './tenant-path-portals';

describe('platform-subdomain', () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it('treats preview and www as platform labels', () => {
    expect(isPlatformSubdomainLabel('preview')).toBe(true);
    expect(isPlatformSubdomainLabel('www')).toBe(true);
    expect(isPlatformSubdomainLabel('wealthfirm')).toBe(false);
  });

  it('does not extract platform labels as tenant slugs', () => {
    process.env.PRODUCTION_DOMAIN = 'akilirisk.com';
    process.env.TENANT_PATH_PORTALS = 'false';
    delete process.env.TENANT_SUBDOMAIN_SUFFIX;
    expect(extractTenantSubdomainLabel('preview.akilirisk.com')).toBeNull();
    expect(extractTenantSubdomainLabel('www.akilirisk.com')).toBeNull();
    expect(extractTenantSubdomainLabel('independent-wealth.akilirisk.com')).toBe(
      'independent-wealth'
    );
  });

  it('recognizes preview host as platform hostname', () => {
    process.env.PRODUCTION_DOMAIN = 'akilirisk.com';
    expect(isPlatformHostname('preview.akilirisk.com')).toBe(true);
    expect(isPlatformHostname('independent-wealth.akilirisk.com')).toBe(false);
  });

  it('defaults auto-activate off on Vercel preview unless opted in', () => {
    process.env.VERCEL_ENV = 'preview';
    delete process.env.SUBDOMAIN_AUTO_ACTIVATE;
    expect(isSubdomainAutoActivateEnabled()).toBe(false);

    process.env.SUBDOMAIN_AUTO_ACTIVATE = 'true';
    expect(isSubdomainAutoActivateEnabled()).toBe(true);
  });

  it('builds portal hostname from PRODUCTION_DOMAIN', () => {
    process.env.PRODUCTION_DOMAIN = 'akilirisk.com';
    delete process.env.TENANT_SUBDOMAIN_SUFFIX;
    expect(buildAdvisorPortalHostname('wealthfirm')).toBe('wealthfirm.akilirisk.com');
  });

  it('builds path-based staging portal URLs when enabled', () => {
    process.env.PRODUCTION_DOMAIN = 'akilirisk.com';
    process.env.TENANT_PATH_PORTALS = 'true';
    process.env.AUTH_URL = 'https://preview.akilirisk.com';
    expect(buildAdvisorPortalUrl('ebilly')).toBe('https://preview.akilirisk.com/t/ebilly');
  });

  it('validates canonical slugs and path-portal slugs identically', () => {
    delete process.env.PLATFORM_SUBDOMAIN_LABELS;
    for (const slug of ['ab', 'this-slug-is-way-too-long', '-lead', 'lead-', 'preview', 'www']) {
      expect(isCanonicalSubdomainSlug(slug)).toBe(false);
      expect(isValidTenantPortalSlug(slug)).toBe(false);
    }
    for (const slug of ['ebilly', 'independent-wealth', 'firm123']) {
      expect(isCanonicalSubdomainSlug(slug)).toBe(true);
      expect(isValidTenantPortalSlug(slug)).toBe(true);
    }
  });

  it('rejects host labels that are not valid canonical slugs', () => {
    delete process.env.TENANT_SUBDOMAIN_SUFFIX;
    expect(toCanonicalSubdomainSlug('-bad')).toBeNull();
    expect(toCanonicalSubdomainSlug('ab')).toBeNull();
    expect(toCanonicalSubdomainSlug('ebilly')).toBe('ebilly');
  });

  it('appends TENANT_SUBDOMAIN_SUFFIX on preview-style hosts', () => {
    process.env.PRODUCTION_DOMAIN = 'akilirisk.com';
    process.env.TENANT_PATH_PORTALS = 'false';
    process.env.TENANT_SUBDOMAIN_SUFFIX = '-staging';
    expect(toTenantHostLabel('ebilly')).toBe('ebilly-staging');
    expect(buildAdvisorPortalHostname('ebilly')).toBe('ebilly-staging.akilirisk.com');
    expect(toCanonicalSubdomainSlug('ebilly-staging')).toBe('ebilly');
    expect(extractTenantSubdomainLabel('ebilly-staging.akilirisk.com')).toBe('ebilly');
    expect(extractTenantSubdomainLabel('ebilly.akilirisk.com')).toBeNull();
  });
});
