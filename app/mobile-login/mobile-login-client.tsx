"use client";

import { FormEvent, useCallback, useRef, useState } from "react";
import { TurnstileWidget, type TurnstileHandle, type TurnstileStatus } from "../turnstile-widget";
import {
  isExpectedMobileCallback,
  type MobileAuthorizationRequest,
} from "./mobile-authorization";
import styles from "./mobile-login.module.css";

type MfaStep = {
  challengeToken: string;
  enrollmentRequired?: boolean;
  secret?: string;
  otpAuthUri?: string;
};

type PasswordStep = {
  grant: string;
  expiresAt: string;
};

type MobileLoginResponse = {
  ok?: boolean;
  code?: string;
  error?: string;
  stage?: "mfa" | "password";
  mfa?: MfaStep;
  setup?: PasswordStep;
  redirectUrl?: string;
  recoveryCodes?: string[];
  requestId?: string;
};

type Stage = "credentials" | "mfa" | "password" | "recovery";

export function MobileLoginClient({
  authorization,
  initialError,
  turnstileSiteKey = "",
}: {
  authorization: MobileAuthorizationRequest | null;
  initialError: string;
  turnstileSiteKey?: string;
}) {
  const turnstile = useRef<TurnstileHandle>(null);
  const turnstileToken = useRef("");
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialError);
  const [stage, setStage] = useState<Stage>("credentials");
  const [mfa, setMfa] = useState<MfaStep | null>(null);
  const [setup, setSetup] = useState<PasswordStep | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [pendingRedirect, setPendingRedirect] = useState("");

  const receiveTurnstileToken = useCallback((token: string) => {
    turnstileToken.current = token;
    setTurnstileReady(Boolean(token));
    if (token) setMessage("");
  }, []);

  const receiveTurnstileStatus = useCallback((status: TurnstileStatus) => {
    turnstileToken.current = "";
    setTurnstileReady(false);
    setMessage(status === "expired"
      ? "The security check expired. Complete it again before signing in."
      : status === "timeout"
        ? "The security check timed out. Complete it again before signing in."
        : "The security check could not be completed. Refresh it and try again.");
  }, []);

  function withReference(result: MobileLoginResponse, fallback: string): string {
    const requestId = result.requestId || "";
    const text = result.error || fallback;
    return requestId ? `${text} Reference: ${requestId}` : text;
  }

  function continueWith(result: MobileLoginResponse) {
    if (result.stage === "mfa" && result.mfa?.challengeToken) {
      setMfa(result.mfa);
      setStage("mfa");
      return;
    }
    if (result.stage === "password" && result.setup?.grant) {
      setSetup(result.setup);
      if (result.recoveryCodes?.length) setRecoveryCodes(result.recoveryCodes);
      setStage("password");
      return;
    }
    if (result.ok === true && result.redirectUrl && authorization
      && isExpectedMobileCallback(result.redirectUrl, authorization.state)) {
      const codes = result.recoveryCodes?.length ? result.recoveryCodes : recoveryCodes;
      if (codes.length) {
        setRecoveryCodes(codes);
        setPendingRedirect(result.redirectUrl);
        setStage("recovery");
      } else {
        window.location.assign(result.redirectUrl);
      }
      return;
    }
    setMessage(withReference(result, "CoreCare could not complete this Mobile sign-in."));
  }

  async function post(path: string, body: Record<string, unknown>): Promise<MobileLoginResponse> {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({})) as MobileLoginResponse;
    if (!response.ok && !result.stage) throw new Error(withReference(result, "CoreCare could not complete this security step."));
    return result;
  }

  async function submitCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authorization || busy) return;
    const activeTurnstileToken = turnstileToken.current;
    if (!activeTurnstileToken) {
      setTurnstileReady(false);
      setMessage("Please complete the security check before continuing.");
      return;
    }
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      continueWith(await post("/api/mobile-login", {
        ...authorization,
        email: String(form.get("email") || ""),
        password: String(form.get("password") || ""),
        turnstileToken: activeTurnstileToken,
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "CoreCare could not be reached. Check your connection and try again.");
    } finally {
      setBusy(false);
      turnstileToken.current = "";
      setTurnstileReady(false);
      turnstile.current?.reset();
    }
  }

  async function submitMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authorization || !mfa || busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      continueWith(await post("/api/mobile-login/mfa", {
        ...authorization,
        challengeToken: mfa.challengeToken,
        code: String(form.get("code") || ""),
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The Platform security code could not be verified.");
    } finally {
      setBusy(false);
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authorization || !setup || busy) return;
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") || "");
    if (newPassword !== String(form.get("confirmation") || "")) {
      setMessage("The new passwords do not match.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      continueWith(await post("/api/mobile-login/password", {
        ...authorization,
        grant: setup.grant,
        newPassword,
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The Platform password could not be changed.");
    } finally {
      setBusy(false);
    }
  }

  const title = stage === "credentials"
    ? "Continue to the app"
    : stage === "mfa"
      ? "Secure your account"
      : stage === "password"
        ? "Choose your private password"
        : "Save your recovery codes";

  return (
    <main className={styles.page}>
      <section className={styles.shell} aria-labelledby="mobile-login-title">
        <div className={styles.story}>
          <div>
            <p className={styles.eyebrow}>CoreCare Mobile</p>
            <h1>One login. Your approved products.</h1>
          </div>
          <p>Platform verifies your identity and current access before CoreCare Mobile shows any product.</p>
        </div>

        <div className={styles.panel}>
          <h2 id="mobile-login-title">{title}</h2>
          <p className={styles.intro}>
            {stage === "credentials"
              ? "Use your CoreCare Platform account. Your password never returns to the app."
              : stage === "mfa"
                ? "Complete Platform-owned MFA before returning securely to CoreCare Mobile."
                : stage === "password"
                  ? "Replace your temporary password before any product opens."
                  : "Store these one-use codes safely before returning to the app."}
          </p>

          {stage === "credentials" ? (
            <form className={styles.form} onSubmit={submitCredentials}>
              <label className={styles.label}>Email address
                <input className={styles.input} name="email" type="email" autoComplete="username" inputMode="email" required disabled={!authorization || busy} />
              </label>
              <label className={styles.label}>Password
                <input className={styles.input} name="password" type="password" autoComplete="current-password" required disabled={!authorization || busy} />
              </label>
              {authorization ? <TurnstileWidget ref={turnstile} action="login" onToken={receiveTurnstileToken} onStatus={receiveTurnstileStatus} siteKey={turnstileSiteKey} /> : null}
              <button className={styles.button} type="submit" disabled={!authorization || busy || !turnstileReady}>
                {busy ? "Signing in securely..." : "Continue securely"}
              </button>
            </form>
          ) : null}

          {stage === "mfa" ? (
            <form className={styles.form} onSubmit={submitMfa}>
              {mfa?.enrollmentRequired ? (
                <div className={styles.setupCard}>
                  <strong>Authenticator setup key</strong>
                  <code>{mfa.secret}</code>
                  {mfa.otpAuthUri ? <a href={mfa.otpAuthUri}>Open in Authenticator</a> : null}
                </div>
              ) : null}
              <label className={styles.label}>Six-digit Authenticator code
                <input className={styles.input} name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus />
              </label>
              <button className={styles.button} type="submit" disabled={busy}>{busy ? "Verifying..." : "Verify Authenticator"}</button>
            </form>
          ) : null}

          {stage === "password" ? (
            <form className={styles.form} onSubmit={submitPassword}>
              <label className={styles.label}>New password
                <input className={styles.input} name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required autoFocus />
              </label>
              <label className={styles.label}>Confirm new password
                <input className={styles.input} name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
              </label>
              <small>Use at least 12 characters with upper-case, lower-case and a number.</small>
              <button className={styles.button} type="submit" disabled={busy}>{busy ? "Saving securely..." : "Save password and continue"}</button>
            </form>
          ) : null}

          {stage === "recovery" ? (
            <div className={styles.form}>
              <div className={styles.recoveryGrid}>{recoveryCodes.map((code) => <code key={code}>{code}</code>)}</div>
              <button className={styles.button} type="button" onClick={() => pendingRedirect && window.location.assign(pendingRedirect)} disabled={!pendingRedirect}>
                I have saved these codes
              </button>
            </div>
          ) : null}

          {message ? <p className={styles.message} role="alert">{message}</p> : null}
          <p className={styles.security}>Platform owns authentication and MFA. CoreCare Mobile receives only a short-lived PKCE code and product-scoped sessions.</p>
        </div>
      </section>
    </main>
  );
}
