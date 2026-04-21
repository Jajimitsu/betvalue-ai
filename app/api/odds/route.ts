import { NextResponse } from "next/server";

export async function GET() {
  const res = await fetch(
    `https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey=${process.env.ODDS_API_KEY}&regions=eu&markets=h2h,totals&oddsFormat=decimal`,
    {
      cache: "no-store",
    }
  );

  const data = await res.json();

  return NextResponse.json(data);
}