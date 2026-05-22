'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Globe,
  Check,
  X,
  Clock,
  ExternalLink,
  Info,
  Crown,
  Loader2,
  Copy,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { SubscriptionFeatures } from '@/lib/validation/branding';
import type { AdvisorSubdomainSettings } from '@/lib/advisor/subdomain';

interface SubdomainManagerProps {
  features: SubscriptionFeatures;
  currentSubdomain?: AdvisorSubdomainSettings | null;
  productionDomain: string;
  /** e.g. `-staging` on Preview; empty on Production */
  tenantSubdomainSuffix?: string;
  platformSubdomainsAutoActivate?: boolean;
  className?: string;
}

export function SubdomainManager({
  features,
  currentSubdomain,
  productionDomain,
  tenantSubdomainSuffix = '',
  platformSubdomainsAutoActivate = true,
  className = '',
}: SubdomainManagerProps) {
  const domainSuffix = `.${productionDomain}`;
  const portalHost = (canonicalSlug: string) =>
    `${canonicalSlug}${tenantSubdomainSuffix}${domainSuffix}`;
  const portalUrl = (canonicalSlug: string) => `https://${portalHost(canonicalSlug)}`;
  const [subdomain, setSubdomain] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    available: boolean;
    error?: string;
    suggestions?: string[];
  } | null>(null);

  // Auto-check availability when typing
  useEffect(() => {
    const checkAvailability = async () => {
      if (subdomain.length < 3) {
        setCheckResult(null);
        return;
      }

      setIsChecking(true);
      try {
        const response = await fetch('/api/advisor/subdomain/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subdomain }),
        });

        const result = await response.json() as {
          success: boolean;
          error?: string;
          data?: { available: boolean; reason?: string; suggestions?: string[] };
        };

        if (result.success && result.data) {
          setCheckResult({
            available: result.data.available,
            error: result.data.reason,
            suggestions: result.data.suggestions,
          });
        } else {
          setCheckResult({
            available: false,
            error: result.error,
          });
        }
      } catch (error) {
        setCheckResult({
          available: false,
          error: 'Failed to check availability',
        });
      } finally {
        setIsChecking(false);
      }
    };

    const timeoutId = setTimeout(checkAvailability, 500);
    return () => clearTimeout(timeoutId);
  }, [subdomain]);

  const handleClaim = async () => {
    if (!subdomain || !checkResult?.available) return;

    setIsClaiming(true);
    try {
      const response = await fetch('/api/advisor/subdomain/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Subdomain '${subdomain}' claimed successfully!`);
        // Refresh the page to show the new subdomain
        window.location.reload();
      } else {
        toast.error(result.error || 'Failed to claim subdomain');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
      console.error('Subdomain claim error:', error);
    } finally {
      setIsClaiming(false);
    }
  };

  const handleRelease = async () => {
    if (!currentSubdomain) return;

    setIsReleasing(true);
    try {
      const response = await fetch('/api/advisor/subdomain/claim', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Subdomain released successfully');
        // Refresh the page to remove the subdomain
        window.location.reload();
      } else {
        toast.error(result.error || 'Failed to release subdomain');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
      console.error('Subdomain release error:', error);
    } finally {
      setIsReleasing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const getStatusBadge = (data: AdvisorSubdomainSettings) => {
    if (data.status === 'active' || (data.dnsVerified && data.sslProvisioned)) {
      return (
        <Badge variant="default" className="bg-green-600">
          <Check className="h-3 w-3 mr-1" />
          Active
        </Badge>
      );
    }
    if (data.dnsVerified && !data.sslProvisioned) {
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          SSL Pending
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Custom Subdomain
          {!features.customSubdomainEnabled && (
            <Crown className="h-4 w-4 text-amber-500" />
          )}
        </CardTitle>
        <CardDescription>
          Claim your custom subdomain for a fully branded client experience
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!features.customSubdomainEnabled ? (
          <Alert>
            <Crown className="h-4 w-4 text-amber-500" />
            <AlertDescription>
              Custom subdomains are available on Growth and Professional plans.
              <Button
                variant="link"
                className="h-auto p-0 ml-1 text-amber-600 hover:text-amber-700"
              >
                Upgrade your plan
              </Button>
            </AlertDescription>
          </Alert>
        ) : currentSubdomain ? (
          // Show current subdomain management
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{portalHost(currentSubdomain.subdomain)}</span>
                  {getStatusBadge(currentSubdomain)}
                </div>
                <p className="text-sm text-muted-foreground">
                  Your branded client portal URL
                </p>
              </div>
              <div className="flex items-center gap-2">
                {currentSubdomain.dnsVerified && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(portalUrl(currentSubdomain.subdomain), '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Visit
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(portalHost(currentSubdomain.subdomain))}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
              </div>
            </div>

            {!platformSubdomainsAutoActivate &&
              !currentSubdomain.dnsVerified &&
              currentSubdomain.verificationInstructions && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-3">
                      <p className="font-medium">Activation pending</p>
                      <p>{currentSubdomain.verificationInstructions.instructions}</p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

            {platformSubdomainsAutoActivate && currentSubdomain.dnsVerified && (
              <p className="text-sm text-muted-foreground">
                Your portal is active on our platform domain. Share{' '}
                <span className="font-mono">{portalHost(currentSubdomain.subdomain)}</span>{' '}
                with clients.
              </p>
            )}

            <Separator />

            {/* Change subdomain */}
            <div className="space-y-4">
              <h4 className="font-medium">Change Subdomain</h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="new-subdomain">New Subdomain</Label>
                  <div className="flex">
                    <Input
                      id="new-subdomain"
                      value={subdomain}
                      onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                      placeholder="yourname"
                      className="rounded-r-none font-mono"
                      maxLength={20}
                    />
                    <div className="px-3 py-2 bg-muted text-sm rounded-r-md border border-l-0 flex items-center">
                      {domainSuffix}
                    </div>
                  </div>
                </div>

                {subdomain && (
                  <div className="flex items-center gap-2">
                    {isChecking ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : checkResult?.available ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm">
                      {isChecking ? 'Checking...' :
                       checkResult?.available ? 'Available!' :
                       checkResult?.error || 'Not available'}
                    </span>
                  </div>
                )}

                {checkResult?.suggestions && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Suggestions:</p>
                    <div className="flex flex-wrap gap-2">
                      {checkResult.suggestions.map((suggestion, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          onClick={() => setSubdomain(suggestion)}
                          className="text-xs"
                        >
                          {suggestion}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleClaim}
                    disabled={!subdomain || !checkResult?.available || isClaiming}
                    className="flex-1"
                  >
                    {isClaiming && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Change Subdomain
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            {/* Release subdomain */}
            <div className="space-y-2">
              <h4 className="font-medium text-destructive">Release Subdomain</h4>
              <p className="text-sm text-muted-foreground">
                Permanently release your custom subdomain. This action cannot be undone.
              </p>
              <Button
                variant="destructive"
                onClick={handleRelease}
                disabled={isReleasing}
              >
                {isReleasing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Release Subdomain
              </Button>
            </div>
          </div>
        ) : (
          // Claim new subdomain
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Claim your custom subdomain to provide clients with a fully branded portal experience.
                Your subdomain will be:{' '}
                <strong>
                  yourname{tenantSubdomainSuffix}{domainSuffix}
                </strong>
                {platformSubdomainsAutoActivate && (
                  <> It will be active immediately after you claim it.</>
                )}
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="subdomain">Choose Your Subdomain</Label>
                <div className="flex">
                  <Input
                    id="subdomain"
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                    placeholder="yourname"
                    className="rounded-r-none font-mono"
                    maxLength={20}
                  />
                  <div className="px-3 py-2 bg-muted text-sm rounded-r-md border border-l-0 flex items-center">
                    .akiliplatform.com
                  </div>
                </div>
              </div>

              {subdomain && (
                <div className="flex items-center gap-2">
                  {isChecking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : checkResult?.available ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <X className="h-4 w-4 text-red-600" />
                  )}
                  <span className="text-sm">
                    {isChecking ? 'Checking availability...' :
                     checkResult?.available ? 'Available!' :
                     checkResult?.error || 'Not available'}
                  </span>
                </div>
              )}

              {checkResult?.suggestions && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Try these instead:</p>
                  <div className="flex flex-wrap gap-2">
                    {checkResult.suggestions.map((suggestion, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => setSubdomain(suggestion)}
                        className="text-xs"
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={handleClaim}
                disabled={!subdomain || !checkResult?.available || isClaiming}
                className="w-full"
              >
                {isClaiming && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Claim Subdomain
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
