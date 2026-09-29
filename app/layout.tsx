import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

// Same typeface as the Zavtoo frontend — self-hosted via next/font.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Water Delivery",
  description: "On-demand & subscription water delivery — customer app, driver app, vendor panel and super admin.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#eef1fb",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={poppins.variable}>
      <body style={{ margin: 0, padding: 0, minHeight: "100vh", fontFamily: "var(--font-poppins)" }}>
        {children}
      </body>
    </html>
  );
}
