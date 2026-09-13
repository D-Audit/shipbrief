import { ReleaseEditor } from "@/components/releases/release-editor";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReleaseEditor releaseId={id} />;
}
