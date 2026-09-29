import type { Metadata } from "next";
import AdminApp from "./AdminApp";

export const metadata: Metadata = { title: "AquaAdmin · Super Admin", robots: { index: false, follow: false } };

export default function Page() {
  return <AdminApp />;
}
