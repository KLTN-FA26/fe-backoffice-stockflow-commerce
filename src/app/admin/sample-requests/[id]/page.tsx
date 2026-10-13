import { SampleDetailView } from "@/features/sample-request";

export default async function SampleDetailPage({
  params,
}: PageProps<"/admin/sample-requests/[id]">) {
  const { id } = await params;
  return <SampleDetailView id={id} />;
}
