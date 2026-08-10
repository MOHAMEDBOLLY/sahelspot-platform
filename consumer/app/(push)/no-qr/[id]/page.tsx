import type { Metadata } from "next";
import { NoQrAreaDetailClient } from "./NoQrAreaDetailClient";

export const metadata: Metadata = { title: "No QR" };

export default async function NoQrAreaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <NoQrAreaDetailClient areaId={Number(id)} />;
}
