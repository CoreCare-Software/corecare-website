"use client";

import Script from "next/script";
import { forwardRef, useImperativeHandle, useRef } from "react";

const SITE_KEY = "0x4AAAAAAEHZA3fx6EQ1VoTI";

type TurnstileWidgetId = string;
type TurnstileApi = {
  render: (container: HTMLElement, options: {
    sitekey: string;
    action: string;
    callback: (token: string) => void;
    "expired-callback": () => void;
    "error-callback": () => void;
  }) => TurnstileWidgetId;
  reset: (widgetId: TurnstileWidgetId) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export type TurnstileHandle = { reset: () => void };

export const TurnstileWidget = forwardRef<TurnstileHandle, { action: string; onToken: (token: string) => void }>(
  function TurnstileWidget({ action, onToken }, ref) {
    const container = useRef<HTMLDivElement>(null);
    const widgetId = useRef<TurnstileWidgetId | null>(null);

    function renderWidget() {
      if (!container.current || widgetId.current !== null || !window.turnstile) return;
      widgetId.current = window.turnstile.render(container.current, {
        sitekey: SITE_KEY,
        action,
        callback: onToken,
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
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
      />
      <div ref={container} aria-label="Security verification" />
      <p>Security verification helps us prevent automated abuse.</p>
    </div>;
  },
);
