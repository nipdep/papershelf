import { redirect } from "next/navigation";

export default async function LibraryPage({
  params,
  searchParams
}: {
  params: Promise<{ libraryId: string }>;
  searchParams: Promise<{ folder?: string; q?: string; paper?: string }>;
}) {
  const { libraryId } = await params;
  const filters = await searchParams;
  const targetFolder = filters.folder ?? libraryId;
  const nextParams = new URLSearchParams();
  nextParams.set("folder", targetFolder);
  if (filters.q) {
    nextParams.set("q", filters.q);
  }
  if (filters.paper) {
    nextParams.set("paper", filters.paper);
  }

  redirect(`/?${nextParams.toString()}`);
}
