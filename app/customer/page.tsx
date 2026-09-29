import type { Metadata } from "next";
import CustomerApp from "./CustomerApp";

export const metadata: Metadata = {
  title: "Water Delivery",
  description: "Order water cans, subscribe, and track your delivery live.",
};

export default function Page() {
  return <CustomerApp />;
}
