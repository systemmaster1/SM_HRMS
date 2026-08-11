import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.redirect(
    "https://github.com/systemmaster/sm-hrms/releases/latest/download/SM-HRMS.apk",
    { status: 302 }
  );
}
