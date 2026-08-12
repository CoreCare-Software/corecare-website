"use client";

import { FormEvent, useCallback, useRef, useState } from "react";
import { TurnstileWidget, type TurnstileHandle, type TurnstileStatus } from "../turnstile-widget";
import {
  isExpectedMobileCallback,
  type MobileAuthorizationRequest,
} from "./mobile-authorization";
import styles from "./mobile-login.module.css";

type MobileLoginResponse = {
  ok?: boolean;
  code?: string;
  error?: string;
  redirectUrl?: string;
  requestId?: string;
};

export function MobileLoginClient({
  authorization,
  initialError,
}: {
  authorization: MobileAuthorizationRequest | null;
  initialError: string;
}) {
  const turnstile = useRef<TurnstileHandle>(null);
  const turnstileToken = useRef("");
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialError);

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

  async function submit(event: FormEvent<HTMLFormElement>) {
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
      const response = await fetch("/api/mobile-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...authorization,
          email: String(form.get("email") || ""),
          password: String(form.get("password") || ""),
          turnstileToken: activeTurnstileToken,
        }),
      });
      const result = await response.json().catch(() => ({})) as MobileLoginResponse;

      if (
        response.ok &&
        result.ok === true &&
        result.redirectUrl &&
        isExpectedMobileCallback(result.redirectUrl, authorization.state)
      ) {
        window.location.assign(result.redirectUrl);
        return;
      }

      const requestId = result.requestId || response.headers.get("x-request-id") || "";
      const baseMessage = result.error ||
        (result.code === "MFA_REQUIRED"
          ? "This account requires additional verification that CoreCare Mobile does not support yet. No sign-in was completed."
          : "CoreCare could not complete this mobile sign-in.");
      setMessage(requestId ? `${baseMessage} Reference: ${requestId}` : baseMessage);
    } catch {
      setMessage("CoreCare could not be reached. Check your connection and try again.");
    } finally {
      setBusy(false);
      turnstileToken.current = "";
      setTurnstileReady(false);
      turnstile.current?.reset();
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell} aria-labelledby="mobile-login-title">
        <div className={styles.story}>
          <div>
            <p className={styles.eyebrow}>CoreCare Mobile</p>
            <h1>One login. Your approved products.</h1>
          </div>
          <p>
            Sign in through CoreCare, then return securely to the app to choose from the products your account can access.
          </p>
        </div>

        <div className={styles.panel}>
          <h2 id="mobile-login-title">Continue to the app</h2>
          <p className={styles.intro}>Use the same CoreCare email and password you already use.</p>

          <form className={styles.form} onSubmit={submit}>
            <label className={styles.label}>
              Email address
              <input
                className={styles.input}
                name="email"
                type="email"
                autoComplete="username"
                inputMode="email"
                required
                disabled={!authorization || busy}
              />
            </label>

            <label className={styles.label}>
              Password
              <input
                className={styles.input}
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={!authorization || busy}
              />
            </label>

            {authorization ? (
              <TurnstileWidget
                ref={turnstile}
                action="login"
                onToken={receiveTurnstileToken}
                onStatus={receiveTurnstileStatus}
              />
            ) : null}

            {message ? (
              <p className={styles.message} role="alert">
                {message}
              </p>
            ) : null}

            <button
              className={styles.button}
              type="submit"
              disabled={!authorization || busy || !turnstileReady}
            >
              {busy ? "Signing in securely..." : "Sign in and return to CoreCare Mobile"}
            </button>
          </form>

          <p className={styles.security}>
            Your password is sent only to CoreCare over an encrypted connection. It is never placed in the URL or returned to the app.
          </p>
        </div>
      </section>
    </main>
  );
}
