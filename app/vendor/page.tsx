import type { Metadata } from "next";
import VendorApp from "./VendorApp";

export const metadata: Metadata = {
  title: "WaterPro · Vendor Panel",
  description: "Vendor panel — products, pricing, service areas, drivers, vehicles, orders and reports.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <VendorApp />;
}
