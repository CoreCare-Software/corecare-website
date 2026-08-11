function text(value) {
  return String(value || '').trim();
}

const HANDOFF_TARGETS = Object.freeze({
  production: Object.freeze({
    CARE: 'https://care.corecaresystems.co.uk/auth/portal-login',
    CAMPSITE: 'https://campsites.corecaresystems.co.uk/auth/portal-login',
    FINANCE: 'https://finance.corecaresystems.co.uk/auth/portal-login',
    GARAGE: 'https://garage.corecaresystems.co.uk/auth/portal-claim',
    MARKETING: 'https://marketing.corecaresystems.co.uk/auth/portal-login',
    POS: 'https://pos.corecaresystems.co.uk/auth/portal-login',
  }),
  staging: Object.freeze({
    CARE: 'https://corecare-care-staging.cselectricalservices11.workers.dev/auth/portal-login',
    CAMPSITE: 'https://corecare-campsite-staging.cselectricalservices11.workers.dev/auth/portal-login',
    FINANCE: 'https://corecare-finance-staging.cselectricalservices11.workers.dev/auth/portal-login',
    GARAGE: 'https://corecare-garage-staging.cselectricalservices11.workers.dev/auth/portal-claim',
    MARKETING: 'https://corecare-marketing-staging.cselectricalservices11.workers.dev/auth/portal-login',
    POS: 'https://corecare-pos-staging.cselectricalservices11.workers.dev/auth/portal-login',
  }),
});

function validHandoffAction(code, action, environment) {
  const expected = HANDOFF_TARGETS[environment]?.[code];
  if (!expected || !action) return false;
  try {
    const candidate = new URL(action);
    return candidate.toString() === expected;
  } catch {
    return false;
  }
}

/**
 * Preserve every Platform product match. A product is ready only when the
 * Platform supplied both a handoff action and a single-use grant. Products
 * that are entitled but not wired into One Login are returned separately so
 * the Website never misreports them as missing access.
 */
export function normalisePortalMatches(payload, environment = 'production') {
  const targetEnvironment = environment === 'staging' ? 'staging' : 'production';
  const matches = Array.isArray(payload?.matches) ? payload.matches : [];
  const products = matches
    .filter(item => Boolean(item && typeof item === 'object'))
    .map(item => {
      const productCode = text(item.code).toUpperCase();
      const action = text(item.action);
      const targetValid = validHandoffAction(productCode, action, targetEnvironment);
      return ({
      code: productCode,
      productCode,
      product: productCode,
      name: text(item.name || item.code || 'CoreCare'),
      label: text(item.name || item.code || 'CoreCare'),
      description: text(item.description || 'Open this CoreCare workspace.'),
      action,
      portalUrl: action,
      grant: text(item.grant),
      returnTo: text(item.returnTo || '/'),
      mfa: item.mfa === true,
      handoffUrl: action,
      targetValid,
      reason: text(item.reason || item.disabled_reason || item.code_reason || (!targetValid && action ? 'HANDOFF_TARGET_INVALID' : '')),
    }); })
    .filter(item => item.code);

  return {
    ready: products
      .filter(item => item.targetValid && item.grant)
      .map(item => ({
        code: item.code,
        productCode: item.productCode,
        product: item.product,
        name: item.name,
        label: item.label,
        description: item.description,
        action: item.action,
        portalUrl: item.portalUrl,
        grant: item.grant,
        returnTo: item.returnTo,
        mfa: item.mfa,
        handoffUrl: item.handoffUrl,
        reason: item.reason,
      })),
    unavailable: products
      .filter(item => !item.targetValid || !item.grant)
      .map(({ code, name, description, reason }) => ({ code, name, description, reason })),
  };
}
