import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { requireSession } from "@/lib/server/authz";
import { jsonError } from "@/lib/server/http";

export async function GET() {
  try {
    const session = requireSession(await auth());
    return NextResponse.json({
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
      isOwner: session.user.isOwner
    });
  } catch (error) {
    return jsonError(error);
  }
}
