"use client";

import Script from "next/script";
import { forwardRef, useImperativeHandle, useRef } from "react";

// Fallback only; every real deployment must supply an explicit environment-scoped
// site key (see TURNSTILE_SITE_KEY in wrangler.cloudflare.jsonc). Production and
// staging must never share this fallback value in practice.
const DEFAULT_SITE_KEY = "0x4AAAAAAEHZA3fx6EQ1VoTI";

type TurnstileWidgetId = string;
type TurnstileApi = {
  render: (container: HTMLElement, options: {
    sitekey: string;
    action: string;
    callback: (token: string) => void;
    "expired-callback": () => void;
    "timeout-callback": () => void;
    "error-callback": (errorCode: string) => boolean;
  }) => TurnstileWidgetId;
  reset: (widgetId: TurnstileWidgetId) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export type TurnstileStatus = "expired" | "timeout" | "error";
export type TurnstileHandle = { reset: () => void };

type TurnstileWidgetProps = {
  action: string;
  onToken: (token: string) => void;
  onStatus?: (status: TurnstileStatus) => void;
  siteKey?: string;
};

export const TurnstileWidget = forwardRef<TurnstileHandle, TurnstileWidgetProps>(
  function TurnstileWidget({ action, onToken, onStatus, siteKey }, ref) {
    const container = useRef<HTMLDivElement>(null);
    const widgetId = useRef<TurnstileWidgetId | null>(null);

    function clear(status?: TurnstileStatus) {
      onToken("");
      if (status) onStatus?.(status);
    }

    function renderWidget() {
      if (!container.current || widgetId.current !== null || !window.turnstile) return;
      widgetId.current = window.turnstile.render(container.current, {
        sitekey: siteKey || DEFAULT_SITE_KEY,
        action,
        callback: onToken,
        "expired-callback": () => clear("expired"),
        "timeout-callback": () => clear("timeout"),
        "error-callback": () => {
          clear("error");
          return true;
        },
      });
    }

    useImperativeHandle(ref, () => ({
      reset() {
        if (widgetId.current !== null && window.turnstile) window.turnstile.reset(widgetId.current);
        onToken("");
      },
    }), [onToken]);

    return <div className="turnstile-wrap">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={renderWidget}
        onError={() => clear("error")}
      />
      <div ref={container} aria-label="Security verification" />
      <p>Security verification helps us prevent automated abuse.</p>
    </div>;
  },
);
