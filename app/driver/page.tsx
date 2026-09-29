import type { Metadata } from "next";
import DriverApp from "./DriverApp";

export const metadata: Metadata = {
  title: "Water Delivery · Driver",
  description: "Driver app — receive delivery requests, navigate, collect payment and complete with OTP.",
};

export default function Page() {
  return <DriverApp />;
}
