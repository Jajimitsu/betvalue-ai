import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const league =
    req.nextUrl.searchParams.get("league") || "PD";

  const res = await fetch(
    `https://api.football-data.org/v4/competitions/${league}/standings`,
    {
      headers: {
        "X-Auth-Token": process.env.FOOTBALL_API_KEY!,
      },
      cache: "no-store",
    }
  );

  const data = await res.json();

  return NextResponse.json(data);
}