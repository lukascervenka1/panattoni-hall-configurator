import type { Metadata, Viewport } from "next";
import "@fontsource/bai-jamjuree/latin-500.css";
import "@fontsource/bai-jamjuree/latin-600.css";
import "@fontsource/bai-jamjuree/latin-700.css";
import "@fontsource/bai-jamjuree/latin-ext-500.css";
import "@fontsource/bai-jamjuree/latin-ext-600.css";
import "@fontsource/bai-jamjuree/latin-ext-700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Konfigurátor hal (demo)",
  description: "Interaktivní 3D konfigurátor průmyslových a logistických hal. Demo s ukázkovými daty, ceny jsou orientační a nezávazné.",
  // Demo s ukázkovými cenami nemá být indexováno.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body>{children}</body>
    </html>
  );
}
