import type { Metadata } from "next";
import { NoQrClient } from "./NoQrClient";

export const metadata: Metadata = {
  title: "No QR",
  description: "Walk-up and mall venue discovery across the North Coast.",
};

export default function NoQrPage() {
  return <NoQrClient />;
}
