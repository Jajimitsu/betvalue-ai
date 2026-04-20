import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const name =
    req.nextUrl.searchParams.get("name") || "";

  const res = await fetch(
    `https://api.football-data.org/v4/teams?name=${encodeURIComponent(
      name
    )}`,
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