import { ScrollViewStyleReset } from "expo-router/html";
import { type PropsWithChildren } from "react";

/**
 * Customizes the static HTML shell for the web build. The key addition is
 * `viewport-fit=cover`, which lets iOS Safari expose `env(safe-area-inset-*)`
 * so the bottom tab bar can pad around the home indicator (otherwise the tab
 * labels get clipped on iPhone).
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
