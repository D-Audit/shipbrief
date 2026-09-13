import { Suspense } from "react";
import { AIStudioPage } from "@/components/pages/ai-studio-page";
import { LoadingState } from "@/components/shared/page-states";

export default function Page() {
  return (
    <Suspense fallback={<LoadingState rows={6} />}>
      <AIStudioPage />
    </Suspense>
  );
}
