'use client';

import React, { createContext, useContext, useLayoutEffect, ReactNode } from 'react';
import { clientPortalBrandingDisplayTitle } from '@/lib/client/client-portal-branding';
import { AdvisorBrandingData } from '@/lib/validation/branding';
import { applyAdvisorTheme, removeAdvisorTheme, validateThemeAccessibility } from '@/lib/theming/theme-utils';

interface BrandingContextValue {
  branding: AdvisorBrandingData | null;
  subdomain: string | null;
  isThemeActive: boolean;
  applyTheme: () => void;
  removeTheme: () => void;
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

interface BrandingProviderProps {
  branding: AdvisorBrandingData | null;
  subdomain?: string | null;
  children: ReactNode;
  autoApply?: boolean;
}

export function BrandingProvider({
  branding,
  subdomain = null,
  children,
  autoApply = true,
}: BrandingProviderProps) {
  // Apply before paint so route changes between tenant layouts do not flash default tokens.
  // Do not removeAdvisorTheme on unmount — adjacent layouts (landing vs auth) remount this
  // provider in the same navigation; clearing :root vars between them caused light/dark flicker.
  useLayoutEffect(() => {
    if (!autoApply || !branding) return;

    const validation = validateThemeAccessibility(branding);
    applyAdvisorTheme(branding);
    if (!validation.isValid) {
      console.warn('Advisor theme accessibility:', validation.errors);
    }
    if (validation.warnings.length > 0) {
      console.warn('Advisor theme warnings:', validation.warnings);
    }
  }, [branding, autoApply, subdomain]);

  const contextValue: BrandingContextValue = {
    branding,
    subdomain,
    isThemeActive: !!(branding && autoApply),
    applyTheme: () => {
      if (branding) {
        applyAdvisorTheme(branding);
      }
    },
    removeTheme: () => {
      removeAdvisorTheme();
    },
  };

  return (
    <BrandingContext.Provider value={contextValue}>
      <div
        className={`branding-scope ${branding ? 'advisor-themed' : ''}`}
        data-has-branding={!!branding}
        data-subdomain={subdomain}
      >
        {children}
      </div>
    </BrandingContext.Provider>
  );
}

/**
 * Hook to access advisor branding context
 */
export function useBranding(): BrandingContextValue {
  const context = useContext(BrandingContext);

  if (!context) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }

  return context;
}

/**
 * Hook to access advisor branding with fallback for optional usage
 */
export function useBrandingOptional(): BrandingContextValue | null {
  return useContext(BrandingContext);
}

/**
 * Component that conditionally renders based on branding availability
 */
interface ConditionalBrandingProps {
  children: ReactNode;
  fallback?: ReactNode;
  requireColors?: boolean;
  requireLogo?: boolean;
}

export function ConditionalBranding({
  children,
  fallback = null,
  requireColors = false,
  requireLogo = false,
}: ConditionalBrandingProps) {
  const branding = useBrandingOptional();

  if (!branding?.branding) {
    return <>{fallback}</>;
  }

  // Check specific requirements
  if (requireColors) {
    const hasColors = !!(
      branding.branding.primaryColor ||
      branding.branding.secondaryColor ||
      branding.branding.accentColor
    );

    if (!hasColors) {
      return <>{fallback}</>;
    }
  }

  if (requireLogo && !branding.branding.logoUrl) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Component for branded elements with automatic styling
 */
type BrandedHtmlTag =
  | 'div'
  | 'span'
  | 'section'
  | 'p'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'main'
  | 'article'
  | 'aside'
  | 'header'
  | 'footer'
  | 'nav'
  | 'label';

interface BrandedElementProps {
  as?: BrandedHtmlTag;
  variant?: 'primary' | 'secondary' | 'accent';
  children: ReactNode;
  className?: string;
  fallbackClassName?: string;
  style?: React.CSSProperties;
}

export function BrandedElement({
  as: Component = 'div',
  variant = 'primary',
  children,
  className = '',
  fallbackClassName = '',
  style,
  ...props
}: BrandedElementProps & Omit<React.HTMLAttributes<HTMLElement>, 'as'>) {
  const branding = useBrandingOptional();

  const brandedClassName = branding?.isThemeActive
    ? `adaptive-${variant} ${className}`.trim()
    : `${fallbackClassName} ${className}`.trim();

  return (
    <Component
      className={brandedClassName}
      style={style}
      {...props}
    >
      {children}
    </Component>
  );
}

/**
 * Component for displaying advisor logo with fallbacks
 */
interface AdvisorLogoProps {
  className?: string;
  fallback?: ReactNode;
  showBrandName?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function AdvisorLogo({
  className = '',
  fallback,
  showBrandName = true,
  size = 'md',
}: AdvisorLogoProps) {
  const branding = useBrandingOptional();

  const sizeClasses = {
    sm: 'h-6 w-auto max-w-24',
    md: 'h-8 w-auto max-w-32',
    lg: 'h-12 w-auto max-w-48',
  };

  if (!branding?.branding) {
    return <>{fallback}</>;
  }

  const brandName = clientPortalBrandingDisplayTitle(branding.branding);

  if (branding.branding.logoUrl) {
    return (
      <img
        src={branding.branding.logoUrl}
        alt={`${brandName || 'Advisor'} Logo`}
        className={`object-contain ${sizeClasses[size]} ${className}`.trim()}
        onError={(e) => {
          // Hide broken image and show brand name fallback if available
          if (showBrandName && brandName) {
            const target = e.target as HTMLImageElement;
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML = `<span class="font-semibold text-advisor-primary">${brandName}</span>`;
            }
          }
        }}
      />
    );
  }

  if (showBrandName && brandName) {
    return (
      <span className={`font-semibold text-advisor-primary ${className}`.trim()}>
        {brandName}
      </span>
    );
  }

  return <>{fallback}</>;
}

/**
 * Component for branded buttons that automatically use advisor colors
 */
interface BrandedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export function BrandedButton({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: BrandedButtonProps) {
  const branding = useBrandingOptional();

  const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';

  const sizeClasses = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-10 px-4 py-2',
    lg: 'h-11 px-6 text-lg',
  };

  const variantClasses = branding?.isThemeActive
    ? {
        primary: 'bg-advisor-primary text-advisor-primary-foreground hover:bg-button-primary-hover',
        secondary: 'bg-advisor-secondary text-advisor-secondary-foreground hover:bg-advisor-secondary/80',
        outline: 'border border-advisor-primary text-advisor-primary hover:bg-advisor-primary hover:text-advisor-primary-foreground',
      }
    : {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
      };

  const buttonClassName = [
    baseClasses,
    sizeClasses[size],
    variantClasses[variant],
    className,
  ].filter(Boolean).join(' ');

  return (
    <button className={buttonClassName} {...props}>
      {children}
    </button>
  );
}

export default BrandingProvider;