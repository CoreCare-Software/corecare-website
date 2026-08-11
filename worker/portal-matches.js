function text(value) {
  return String(value || '').trim();
}

/**
 * Preserve every Platform product match. A product is ready only when the
 * Platform supplied both a handoff action and a single-use grant. Products
 * that are entitled but not wired into One Login are returned separately so
 * the Website never misreports them as missing access.
 */
export function normalisePortalMatches(payload) {
  const matches = Array.isArray(payload?.matches) ? payload.matches : [];
  const products = matches
    .filter(item => Boolean(item && typeof item === 'object'))
    .map(item => ({
      code: text(item.code),
      productCode: text(item.code),
      product: text(item.code),
      name: text(item.name || item.code || 'CoreCare'),
      label: text(item.name || item.code || 'CoreCare'),
      description: text(item.description || 'Open this CoreCare workspace.'),
      action: text(item.action),
      portalUrl: text(item.action),
      grant: text(item.grant),
      returnTo: text(item.returnTo || '/'),
      mfa: item.mfa === true,
      handoffUrl: text(item.action),
      reason: text(item.reason || item.disabled_reason || item.code_reason),
    }))
    .filter(item => item.code);

  return {
    ready: products.filter(item => item.action && item.grant),
    unavailable: products
      .filter(item => !item.action || !item.grant)
      .map(({ code, name, description, reason }) => ({ code, name, description, reason })),
  };
}
