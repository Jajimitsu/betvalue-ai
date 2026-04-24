"use client";

import { useEffect, useMemo, useState } from "react";

type Team = {
  id: number;
  name: string;
  league: string;
  position: number;
  goalsFor: number;
  goalsAgainst: number;
};

type Pick = {
  market: string;
  text: string;
  odds: number;
  prob: number;
  ev: number;
  combo: boolean;
};

export default function Home() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [homeTxt, setHomeTxt] = useState("");
  const [awayTxt, setAwayTxt] = useState("");
  const [home, setHome] = useState<Team | null>(null);
  const [away, setAway] = useState<Team | null>(null);
  const [showHome, setShowHome] = useState(false);
  const [showAway, setShowAway] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("Cargando equipos...");

  useEffect(() => {
    loadTeams();
  }, []);

  async function loadTeams() {
    const leagues = [
      "PD","SD","PL","SA","BL1","FL1",
      "PPL","DED","ELC","TSL","BSA","ARG"
    ];

    let arr: Team[] = [];

    for (const lg of leagues) {
      try {
        const res = await fetch(`/api/matches?league=${lg}`);
        const data = await res.json();

        if (!data.standings?.[0]?.table) continue;

        data.standings[0].table.forEach((t: any) => {
          arr.push({
            id: t.team.id,
            name: t.team.name,
            league: lg,
            position: t.position,
            goalsFor: t.goalsFor,
            goalsAgainst: t.goalsAgainst,
          });
        });
      } catch {}
    }

    const unique = arr.filter(
      (x, i, self) =>
        i === self.findIndex((y) => y.name === x.name)
    );

    setTeams(unique);
    setResult("");
  }

  function clean(v: string) {
    return v
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/fc|cf|ud|cd|rcd|club|sad/g, "")
      .replace(/\./g, "")
      .replace(/-/g, " ")
      .replace(/\s+/g, "")
      .trim();
  }

  const homeSug = useMemo(() => {
    const q = clean(homeTxt);
    if (!q) return [];
    return teams.filter(t => clean(t.name).includes(q)).slice(0,8);
  }, [homeTxt, teams]);

  const awaySug = useMemo(() => {
    const q = clean(awayTxt);
    if (!q) return [];
    return teams.filter(t => clean(t.name).includes(q)).slice(0,8);
  }, [awayTxt, teams]);

  function addPick(
    list: Pick[],
    market: string,
    text: string,
    odds: number,
    prob: number,
    combo = false
  ) {
    const ev = prob * odds - 1;

    // balanced filters
    if (
      odds >= 1.25 &&
      odds <= 3.40 &&
      prob >= 0.50 &&
      ev >= -0.01
    ) {
      list.push({
        market,
        text,
        odds,
        prob,
        ev,
        combo,
      });
    }
  }

  async function analizar() {
    if (!home || !away) {
      setResult("Selecciona ambos equipos.");
      return;
    }

    setLoading(true);
    setResult("Escaneando valor...");

    /********************************************
     MODELO BASE
    ********************************************/
    let pHome = 43;
    let pDraw = 27;
    let pAway = 30;

    if (home.position < away.position) {
      pHome += 9;
      pAway -= 9;
    } else if (away.position < home.position) {
      pAway += 9;
      pHome -= 9;
    }

    // localía
    pHome += 6;

    // goles
    const homeDiff = home.goalsFor - home.goalsAgainst;
    const awayDiff = away.goalsFor - away.goalsAgainst;

    if (homeDiff > awayDiff) {
      pHome += 4;
      pAway -= 4;
    } else if (awayDiff > homeDiff) {
      pAway += 4;
      pHome -= 4;
    }

    const total = pHome + pDraw + pAway;
    pHome /= total;
    pDraw /= total;
    pAway = 1 - pHome - pDraw;

    // goles estimados
    const avgAttack =
      (home.goalsFor + away.goalsFor) / 2;

    const pOver05 = 0.86;
    const pOver15 = Math.min(0.88, Math.max(0.62, 0.68 + avgAttack / 100));
    const pOver25 = Math.min(0.76, Math.max(0.42, pOver15 - 0.18));
    const pBTTS = Math.min(0.72, Math.max(0.40, 0.48 + avgAttack / 140));

    /********************************************
     CUOTAS BASE (ajústalas con API luego)
    ********************************************/
    const oddHome = 1.95;
    const oddDraw = 3.25;
    const oddAway = 2.50;

    const odd1X = 1.28;
    const oddX2 = 1.42;
    const odd12 = 1.32;

    const oddOver15 = 1.34;
    const oddOver25 = 1.72;
    const oddBTTS = 1.88;

    const picks: Pick[] = [];

    /********************************************
     SINGLES
    ********************************************/
    addPick(picks, "1", `${home.name} gana`, oddHome, pHome);
    addPick(picks, "X", "Empate", oddDraw, pDraw);
    addPick(picks, "2", `${away.name} gana`, oddAway, pAway);

    addPick(picks, "1X", `${home.name} o empate`, odd1X, pHome + pDraw);
    addPick(picks, "X2", `${away.name} o empate`, oddX2, pAway + pDraw);
    addPick(picks, "12", "No empate", odd12, pHome + pAway);

    addPick(picks, "Over1.5", "Más de 1.5 goles", oddOver15, pOver15);
    addPick(picks, "Over2.5", "Más de 2.5 goles", oddOver25, pOver25);
    addPick(picks, "BTTS", "Ambos marcan", oddBTTS, pBTTS);

    /********************************************
     COMBIS (PRIORIDAD)
    ********************************************/
    addPick(
      picks,
      "Combi",
      `${home.name} o empate + Más de 0.5 goles`,
      1.48,
      (pHome + pDraw) * pOver05 * 0.97,
      true
    );

    addPick(
      picks,
      "Combi",
      `${away.name} o empate + Más de 0.5 goles`,
      1.58,
      (pAway + pDraw) * pOver05 * 0.96,
      true
    );

    addPick(
      picks,
      "Combi",
      `${home.name} o empate + Más de 1.5 goles`,
      1.72,
      (pHome + pDraw) * pOver15 * 0.95,
      true
    );

    addPick(
      picks,
      "Combi",
      `${away.name} o empate + Más de 1.5 goles`,
      1.84,
      (pAway + pDraw) * pOver15 * 0.94,
      true
    );

    addPick(
      picks,
      "Combi",
      `No empate + Más de 1.5 goles`,
      1.60,
      (pHome + pAway) * pOver15 * 0.96,
      true
    );

    /********************************************
     SCORE PRIORIZANDO COMBIS
    ********************************************/
    picks.sort((a, b) => {
      const scoreA =
        a.ev * 0.32 +
        a.prob * 0.28 +
        (a.combo ? 0.40 : 0.00);

      const scoreB =
        b.ev * 0.32 +
        b.prob * 0.28 +
        (b.combo ? 0.40 : 0.00);

      return scoreB - scoreA;
    });

    const best = picks[0];

    if (!best) {
      setResult(`
⚽ ${home.name} vs ${away.name}

⚠️ No detecté apuesta válida.
      `);
      setLoading(false);
      return;
    }

    const conf = Math.round(
      Math.min(94, Math.max(58, best.prob * 100 + best.ev * 60))
    );

    const stake =
      conf >= 82 ? "3/5" :
      conf >= 72 ? "2/5" :
      "1/5";

    setResult(`
⚽ ${home.name} vs ${away.name}

🔥 BETVALUE AI V21.2

🎯 Pick recomendado:
${best.text}

📊 Mercado:
${best.market}

💰 Cuota:
${best.odds.toFixed(2)}

📈 Value:
${best.ev >= 0 ? "+" : ""}${(best.ev * 100).toFixed(1)}%

🧠 Confianza:
${conf}/100

🔥 Stake:
${stake}

📌 Probabilidad IA:
${(best.prob * 100).toFixed(1)}%
    `);

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-green-950 text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8">

        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" className="w-40 mb-4" />
          <h1 className="text-5xl font-bold text-green-400">
            BetValue AI
          </h1>
          <p className="text-gray-300 mt-2">
            V21.2 Balanced Picks
          </p>
        </div>

        <div className="relative mb-4">
          <input
            value={homeTxt}
            onChange={(e) => {
              setHomeTxt(e.target.value);
              setHome(null);
              setShowHome(true);
            }}
            placeholder="Equipo local"
            className="w-full bg-white text-black px-5 py-4 rounded-2xl text-xl"
          />
          {showHome && homeSug.length > 0 && (
            <div className="absolute z-20 w-full bg-white text-black rounded-xl mt-1 overflow-hidden">
              {homeSug.map((t) => (
                <div
                  key={t.id}
                  className="px-4 py-2 hover:bg-gray-200 cursor-pointer"
                  onClick={() => {
                    setHome(t);
                    setHomeTxt(t.name);
                    setShowHome(false);
                  }}
                >
                  {t.name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="relative mb-4">
          <input
            value={awayTxt}
            onChange={(e) => {
              setAwayTxt(e.target.value);
              setAway(null);
              setShowAway(true);
            }}
            placeholder="Equipo visitante"
            className="w-full bg-white text-black px-5 py-4 rounded-2xl text-xl"
          />
          {showAway && awaySug.length > 0 && (
            <div className="absolute z-20 w-full bg-white text-black rounded-xl mt-1 overflow-hidden">
              {awaySug.map((t) => (
                <div
                  key={t.id}
                  className="px-4 py-2 hover:bg-gray-200 cursor-pointer"
                  onClick={() => {
                    setAway(t);
                    setAwayTxt(t.name);
                    setShowAway(false);
                  }}
                >
                  {t.name}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={analizar}
          disabled={loading}
          className="w-full bg-green-500 hover:bg-green-600 py-4 rounded-2xl font-bold text-xl"
        >
          {loading ? "Escaneando..." : "Analizar Partido"}
        </button>

        {result && (
          <div className="mt-6 bg-black/40 border border-green-500/30 rounded-2xl p-6 whitespace-pre-line text-lg leading-8">
            {result}
          </div>
        )}
      </div>
    </main>
  );
}