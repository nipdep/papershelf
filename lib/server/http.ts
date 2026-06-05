import { NextResponse } from "next/server";

import { asAppError } from "@/lib/errors";

export function jsonError(error: unknown) {
  const appError = asAppError(error);
  return NextResponse.json(
    {
      error: {
        code: appError.code,
        message: appError.message
      }
    },
    { status: appError.status }
  );
}
