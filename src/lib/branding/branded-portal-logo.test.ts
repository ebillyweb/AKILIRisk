import { describe, expect, it } from 'vitest';
import {
  BRANDED_ADVISOR_LOGO_PATH,
  brandedPortalLogoImgSrc,
} from './branded-portal-logo';

describe('brandedPortalLogoImgSrc', () => {
  it('uses API route when logoS3Key is set', () => {
    expect(
      brandedPortalLogoImgSrc({
        logoS3Key: 'advisors/abc/logos/logo.png',
        logoUrl: null,
      })
    ).toBe(BRANDED_ADVISOR_LOGO_PATH);
  });

  it('uses API route for private S3 logoUrl', () => {
    expect(
      brandedPortalLogoImgSrc({
        logoUrl:
          'https://akili-branding.s3.us-east-2.amazonaws.com/advisors/abc/logos/x.png',
      })
    ).toBe(BRANDED_ADVISOR_LOGO_PATH);
  });

  it('passes through public https URLs', () => {
    const url = 'https://cdn.example.com/logo.png';
    expect(brandedPortalLogoImgSrc({ logoUrl: url })).toBe(url);
  });
});
