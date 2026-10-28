import { ManifestScreen } from "@/features/shipping/components/ManifestScreen";

export default async function ManifestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ManifestScreen id={id} />;
}
