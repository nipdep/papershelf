import { auth } from "@/auth";
import { V2Workspace } from "@/components/v2-workspace";

export default async function V2Page() {
  const session = await auth();
  return <V2Workspace userEmail={session?.user?.email} userName={session?.user?.name} />;
}

