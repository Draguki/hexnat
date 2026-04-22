// app/layout.jsx
// ---------------------------------------------------------------------------
// ROOT LAYOUT — required by Next.js 14 App Router.
// Every page rendered under /app is wrapped by this component.
// Must contain exactly one <html> and one <body> tag.
// ---------------------------------------------------------------------------

export const metadata = {
  title: "HexNeedle Analytics",
  description: "Lightweight first-party analytics for hexneedle.com",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/*
         * No extra <meta charset> or <meta viewport> here —
         * Next.js 14 injects those automatically from the metadata export above.
         */}
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif",
          background: "#f5f4f0",
          color: "#1a1a18",
        }}
      >
        {children}
      </body>
    </html>
  );
}
