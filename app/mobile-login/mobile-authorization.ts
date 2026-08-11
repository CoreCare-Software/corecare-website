export const MOBILE_CLIENT_ID = "uk.co.corecaresystems.app";
export const MOBILE_REDIRECT_URI = "uk.co.corecaresystems.app://auth/callback";
export const MOBILE_CODE_CHALLENGE_METHOD = "S256";

const CODE_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const STATE_PATTERN = /^[A-Za-z0-9_-]{16,256}$/;

export type MobileAuthorizationRequest = {
  clientId: typeof MOBILE_CLIENT_ID;
  redirectUri: typeof MOBILE_REDIRECT_URI;
  codeChallenge: string;
  codeChallengeMethod: typeof MOBILE_CODE_CHALLENGE_METHOD;
  state: string;
};

type SearchValue = string | string[] | undefined;

function one(value: SearchValue): string {
  return typeof value === "string" ? value : "";
}

export function parseMobileAuthorizationSearch(
  params: Record<string, SearchValue>,
): { request: MobileAuthorizationRequest | null; error: string } {
  const supplied = [
    params.client_id,
    params.redirect_uri,
    params.code_challenge,
    params.code_challenge_method,
    params.state,
  ].some((value) => value !== undefined);

  if (!supplied) {
    return { request: null, error: "A CoreCare Mobile sign-in request is required." };
  }

  const clientId = one(params.client_id);
  const redirectUri = one(params.redirect_uri);
  const codeChallenge = one(params.code_challenge);
  const codeChallengeMethod = one(params.code_challenge_method);
  const state = one(params.state);

  if (
    clientId !== MOBILE_CLIENT_ID ||
    redirectUri !== MOBILE_REDIRECT_URI ||
    codeChallengeMethod !== MOBILE_CODE_CHALLENGE_METHOD ||
    !CODE_CHALLENGE_PATTERN.test(codeChallenge) ||
    !STATE_PATTERN.test(state)
  ) {
    return { request: null, error: "This CoreCare Mobile sign-in request is invalid or incomplete." };
  }

  return {
    request: {
      clientId: MOBILE_CLIENT_ID,
      redirectUri: MOBILE_REDIRECT_URI,
      codeChallenge,
      codeChallengeMethod: MOBILE_CODE_CHALLENGE_METHOD,
      state,
    },
    error: "",
  };
}

export function isExpectedMobileCallback(urlValue: string, expectedState: string): boolean {
  try {
    const url = new URL(urlValue);
    return (
      url.protocol === "uk.co.corecaresystems.app:" &&
      url.hostname === "auth" &&
      url.pathname === "/callback" &&
      url.searchParams.get("state") === expectedState &&
      Boolean(url.searchParams.get("code"))
    );
  } catch {
    return false;
  }
}
