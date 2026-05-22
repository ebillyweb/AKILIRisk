import { describe, expect, it } from 'vitest';
import { resolveBrandingLogoS3Key } from './advisor-logo-display';

describe('resolveBrandingLogoS3Key', () => {
  it('prefers logoS3Key', () => {
    expect(
      resolveBrandingLogoS3Key({
        logoS3Key: 'advisors/id1/logos/a.png',
        logoUrl: 'https://other.example.com/b.png',
      })
    ).toBe('advisors/id1/logos/a.png');
  });

  it('parses key from private S3 logoUrl', () => {
    expect(
      resolveBrandingLogoS3Key({
        logoUrl:
          'https://test-akili-advisor-assets.s3.us-east-2.amazonaws.com/advisors/id1/logos/a.png',
      })
    ).toBe('advisors/id1/logos/a.png');
  });
});
