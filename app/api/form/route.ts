import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const teamId = req.nextUrl.searchParams.get("team");

  const res = await fetch(
    `https://api.football-data.org/v4/teams/${teamId}/matches?status=FINISHED&limit=5`,
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