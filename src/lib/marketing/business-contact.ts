export type BusinessAddress = {
  streetAddress: string;
  addressLocality: string;
  addressRegion: string;
  postalCode: string;
  addressCountry: string;
};

export type BusinessContact = {
  phone: string;
  phoneTelHref: string;
  address: BusinessAddress;
  formattedAddressLines: string[];
};

function readEnv(key: string): string | undefined {
  const trimmed = process.env[key]?.trim();
  return trimmed || undefined;
}

function isCompleteAddress(
  address: Partial<BusinessAddress>,
): address is BusinessAddress {
  return Boolean(
    address.streetAddress?.trim() &&
      address.addressLocality?.trim() &&
      address.addressRegion?.trim() &&
      address.postalCode?.trim() &&
      address.addressCountry?.trim(),
  );
}

export function getBusinessPhone(): string | undefined {
  return readEnv("NEXT_PUBLIC_BUSINESS_PHONE");
}

export function getBusinessAddress(): BusinessAddress | undefined {
  const address = {
    streetAddress: readEnv("NEXT_PUBLIC_BUSINESS_STREET_ADDRESS") ?? "",
    addressLocality: readEnv("NEXT_PUBLIC_BUSINESS_ADDRESS_LOCALITY") ?? "",
    addressRegion: readEnv("NEXT_PUBLIC_BUSINESS_ADDRESS_REGION") ?? "",
    postalCode: readEnv("NEXT_PUBLIC_BUSINESS_ADDRESS_POSTAL_CODE") ?? "",
    addressCountry: readEnv("NEXT_PUBLIC_BUSINESS_ADDRESS_COUNTRY") ?? "US",
  };

  return isCompleteAddress(address) ? address : undefined;
}

export function formatPhoneTelHref(phone: string): string {
  const normalized = phone.trim().replace(/[^\d+]/g, "");
  return normalized ? `tel:${normalized}` : `tel:${phone.trim()}`;
}

export function formatBusinessAddressLines(address: BusinessAddress): string[] {
  const localityLine = `${address.addressLocality}, ${address.addressRegion} ${address.postalCode}`;
  const countryLine =
    address.addressCountry.toUpperCase() === "US"
      ? undefined
      : address.addressCountry;

  return countryLine
    ? [address.streetAddress, localityLine, countryLine]
    : [address.streetAddress, localityLine];
}

/** Both phone and a complete postal address — required for LocalBusiness schema. */
export function getBusinessContact(): BusinessContact | undefined {
  const phone = getBusinessPhone();
  const address = getBusinessAddress();
  if (!phone || !address) return undefined;

  return {
    phone,
    phoneTelHref: formatPhoneTelHref(phone),
    address,
    formattedAddressLines: formatBusinessAddressLines(address),
  };
}

export function hasVisibleBusinessPhone(): boolean {
  return Boolean(getBusinessPhone());
}

export function hasVisibleBusinessAddress(): boolean {
  return Boolean(getBusinessAddress());
}
