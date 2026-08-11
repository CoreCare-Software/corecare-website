export type PortalProductMatch = {
  code: string;
  productCode: string;
  product: string;
  name: string;
  label: string;
  description: string;
  action: string;
  portalUrl: string;
  grant: string;
  returnTo: string;
  mfa: boolean;
  handoffUrl: string;
  reason: string;
};

export type UnavailablePortalProduct = Pick<PortalProductMatch, "code" | "name" | "description" | "reason">;

export function normalisePortalMatches(payload: unknown): {
  ready: PortalProductMatch[];
  unavailable: UnavailablePortalProduct[];
};
