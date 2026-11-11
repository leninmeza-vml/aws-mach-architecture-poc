import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PoC MACH & API-Led Connectivity | AWS Headless Portal",
  description:
    "Frontend Headless en Next.js (Static Export) conectado a Experience API (xAPI) en AWS API Gateway v2",
};

const cspPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "connect-src 'self' https://*.execute-api.us-east-1.amazonaws.com https://*.amazoncognito.com",
].join("; ");

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <meta httpEquiv="Content-Security-Policy" content={cspPolicy} />
      </head>
      <body
        style={{
          margin: 0,
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          backgroundColor: "#0f172a",
          color: "#f8fafc",
        }}
      >
        {children}
      </body>
    </html>
  );
}
