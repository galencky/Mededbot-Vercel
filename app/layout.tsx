import type { ReactNode } from "react";

export const metadata = {
  title: "MedEdBot",
  description: "Multilingual Medical Education LINE Bot",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
