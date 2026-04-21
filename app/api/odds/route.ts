import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey =
      process.env.ODDS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Falta ODDS_API_KEY",
        },
        { status: 500 }
      );
    }

    const sports = [
      "soccer_spain_la_liga",
      "soccer_spain_segunda_division",
      "soccer_epl",
      "soccer_efl_champ",
      "soccer_italy_serie_a",
      "soccer_germany_bundesliga",
      "soccer_france_ligue_one",
      "soccer_netherlands_eredivisie",
      "soccer_portugal_primeira_liga",
      "soccer_turkey_super_league",
      "soccer_argentina_primera_division",
      "soccer_uefa_champs_league",
      "soccer_uefa_europa_league"
    ];

    let allData: any[] = [];

    for (const sport of sports) {
      try {
        const url =
          `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${apiKey}&regions=eu&markets=h2h,totals&oddsFormat=decimal`;

        const res =
          await fetch(url, {
            cache:
              "no-store",
          });

        if (!res.ok)
          continue;

        const data =
          await res.json();

        if (
          Array.isArray(data)
        ) {
          const limpio =
            data.map(
              (
                item: any
              ) => ({
                ...item,
                sport_key:
                  sport,
              })
            );

          allData = [
            ...allData,
            ...limpio,
          ];
        }
      } catch {}
    }

    return NextResponse.json(
      allData
    );
  } catch {
    return NextResponse.json(
      []
    );
  }
}