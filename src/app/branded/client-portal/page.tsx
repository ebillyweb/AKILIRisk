import { headers } from 'next/headers';
import { getAdvisorBrandingBySubdomain } from '@/lib/advisor/subdomain';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, FileText, Users, TrendingUp, ArrowRight, Phone, Mail, Globe } from 'lucide-react';
import Link from 'next/link';
import { brandedPortalLogoImgSrc } from '@/lib/branding/branded-portal-logo';

export default async function BrandedClientPortalPage() {
  const headersList = await headers();
  const subdomain = headersList.get('x-subdomain');

  if (!subdomain) {
    return <div>Error: Invalid subdomain</div>;
  }

  const branding = await getAdvisorBrandingBySubdomain(subdomain);

  if (!branding) {
    return <div>Error: Branding not found</div>;
  }

  const brandName = branding.brandName || 'Risk Management Services';
  const primaryColor = branding.primaryColor || '#1a1a2e';
  const secondaryColor = branding.secondaryColor || '#f5f5f5';
  const logoSrc = brandedPortalLogoImgSrc(branding);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header
        className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50"
        style={{ borderBottomColor: primaryColor + '20' }}
      >
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoSrc ? (
              <img
                src={logoSrc}
                alt={`${brandName} logo`}
                className="h-8 w-auto max-w-[160px] object-contain object-left"
              />
            ) : null}
            <div>
              <h1 className="text-xl font-bold" style={{ color: primaryColor }}>
                {brandName}
              </h1>
              {branding.tagline && (
                <p className="text-sm text-muted-foreground">{branding.tagline}</p>
              )}
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/signin"
              className="text-sm hover:underline"
              style={{ color: primaryColor }}
            >
              Sign In
            </Link>
            <Button
              style={{
                backgroundColor: primaryColor,
                borderColor: primaryColor
              }}
              className="text-white hover:opacity-90"
              asChild
            >
              <Link href="/signup">
                Get started
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4" style={{ color: primaryColor }}>
            Comprehensive Family Risk Assessment
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Protect what matters most with our professional risk analysis and governance recommendations
            tailored specifically for your family's unique situation.
          </p>

          {/* Quick Access Card */}
          <Card className="max-w-md mx-auto mb-12">
            <CardHeader>
              <CardTitle className="text-lg">Access Your Assessment</CardTitle>
              <CardDescription>
                Enter your invitation code to continue or start a new assessment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invitation-code">Invitation Code</Label>
                <Input
                  id="invitation-code"
                  placeholder="Enter 6-digit code"
                  className="text-center tracking-wider font-mono"
                  maxLength={6}
                />
              </div>
              <Button
                className="w-full text-white"
                style={{
                  backgroundColor: primaryColor,
                  borderColor: primaryColor
                }}
              >
                Continue Assessment
              </Button>
              <div className="text-center">
                <Link
                  href="/signup"
                  className="text-sm hover:underline"
                  style={{ color: primaryColor }}
                >
                  Have an invitation link? Sign up
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto">
          <h3 className="text-2xl font-bold text-center mb-12" style={{ color: primaryColor }}>
            Comprehensive Risk Analysis
          </h3>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card>
              <CardHeader>
                <Shield className="h-8 w-8 mb-2" style={{ color: primaryColor }} />
                <CardTitle className="text-lg">Security Assessment</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Comprehensive analysis of physical, digital, and personal security vulnerabilities.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Users className="h-8 w-8 mb-2" style={{ color: primaryColor }} />
                <CardTitle className="text-lg">Family Governance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Evaluation of family structures, decision-making processes, and governance frameworks.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <TrendingUp className="h-8 w-8 mb-2" style={{ color: primaryColor }} />
                <CardTitle className="text-lg">Financial Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Analysis of financial exposures, investment risks, and wealth protection strategies.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <FileText className="h-8 w-8 mb-2" style={{ color: primaryColor }} />
                <CardTitle className="text-lg">Detailed Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Professional reports with actionable recommendations and implementation guidance.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      {(branding.supportEmail || branding.supportPhone || branding.websiteUrl) && (
        <section className="py-16 px-4">
          <div className="container mx-auto text-center">
            <h3 className="text-2xl font-bold mb-8" style={{ color: primaryColor }}>
              Get in Touch
            </h3>

            <div className="flex justify-center gap-8 flex-wrap">
              {branding.supportEmail && (
                <a
                  href={`mailto:${branding.supportEmail}`}
                  className="flex items-center gap-2 hover:underline"
                  style={{ color: primaryColor }}
                >
                  <Mail className="h-4 w-4" />
                  {branding.supportEmail}
                </a>
              )}

              {branding.supportPhone && (
                <a
                  href={`tel:${branding.supportPhone}`}
                  className="flex items-center gap-2 hover:underline"
                  style={{ color: primaryColor }}
                >
                  <Phone className="h-4 w-4" />
                  {branding.supportPhone}
                </a>
              )}

              {branding.websiteUrl && (
                <a
                  href={branding.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:underline"
                  style={{ color: primaryColor }}
                >
                  <Globe className="h-4 w-4" />
                  Visit Website
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer
        className="border-t py-8 px-4"
        style={{ borderTopColor: primaryColor + '20' }}
      >
        <div className="container mx-auto text-center">
          <p className="text-sm text-muted-foreground mb-2">
            {branding.emailFooterText || `© ${new Date().getFullYear()} ${brandName}. All rights reserved.`}
          </p>
          <p className="text-xs text-muted-foreground">
            Powered by AkiliRisk Platform
          </p>
        </div>
      </footer>
    </div>
  );
}
