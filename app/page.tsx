"use client";

import { useEffect, useMemo, useState } from "react";

type TeamItem = {
  id: number;
  name: string;
  league: string;
  position: number;
  goalsFor: number;
  goalsAgainst: number;
};

type Candidate = {
  market: string;
  pick: string;
  odds: number;
  prob: number;
  ev: number;
  safeCombo?: boolean;
};

export default function Home() {
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [localText, setLocalText] = useState("");
  const [visitText, setVisitText] = useState("");
  const [localTeam, setLocalTeam] = useState<TeamItem | null>(null);
  const [visitTeam, setVisitTeam] = useState<TeamItem | null>(null);
  const [showLocal, setShowLocal] = useState(false);
  const [showVisit, setShowVisit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("Cargando equipos...");

  useEffect(() => {
    cargarEquipos();
  }, []);

  async function cargarEquipos() {
    const ligas = [
      "PD","SD","PL","SA","BL1","FL1",
      "PPL","DED","ELC","TSL","BSA","ARG"
    ];

    let lista: TeamItem[] = [];

    for (const liga of ligas) {
      try {
        const res = await fetch(`/api/matches?league=${liga}`);
        const data = await res.json();

        if (!data.standings?.[0]?.table) continue;

        data.standings[0].table.forEach((t: any) => {
          lista.push({
            id: t.team.id,
            name: t.team.name,
            league: liga,
            position: t.position,
            goalsFor: t.goalsFor,
            goalsAgainst: t.goalsAgainst,
          });
        });
      } catch {}
    }

    const unique = lista.filter(
      (team, index, self) =>
        index === self.findIndex((x) => x.name === team.name)
    );

    setTeams(unique);
    setResult("");
  }

  function clean(txt: string) {
    return txt
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/fc|cf|ud|cd|rcd|club|sad/g, "")
      .replace(/\./g, "")
      .replace(/-/g, " ")
      .replace(/\s+/g, "")
      .trim();
  }

  const localSug = useMemo(() => {
    const q = clean(localText);
    if (!q) return [];
    return teams.filter(t => clean(t.name).includes(q)).slice(0, 8);
  }, [localText, teams]);

  const visitSug = useMemo(() => {
    const q = clean(visitText);
    if (!q) return [];
    return teams.filter(t => clean(t.name).includes(q)).slice(0, 8);
  }, [visitText, teams]);

  async function analizar() {
    if (!localTeam || !visitTeam) {
      setResult("Selecciona ambos equipos.");
      return;
    }

    setLoading(true);
    setResult("Escaneando valor...");

    /********************************************
     MODELO BASE
    ********************************************/
    let pHome = 44;
    let pDraw = 26;
    let pAway = 30;

    if (localTeam.position < visitTeam.position) {
      pHome += 8;
      pAway -= 8;
    } else if (visitTeam.position < localTeam.position) {
      pAway += 8;
      pHome -= 8;
    }

    pHome += 6;

    const total = pHome + pDraw + pAway;
    pHome /= total;
    pDraw /= total;
    pAway = 1 - pHome - pDraw;

    const pOver05 = 0.86;
    const pOver15 = 0.72;
    const pOver25 = 0.56;
    const pBTTS = 0.52;

    const oddHome = 1.95;
    const oddAway = 2.40;
    const oddDraw = 3.30;

    const odd1X = 1.28;
    const oddX2 = 1.42;
    const oddOver05 = 1.18;
    const oddOver15 = 1.36;
    const oddOver25 = 1.72;
    const oddBTTS = 1.90;

    const list: Candidate[] = [];

    function add(
      market: string,
      pick: string,
      odds: number,
      prob: number,
      safeCombo = false
    ) {
      const ev = prob * odds - 1;

      if (
        odds >= 1.30 &&
        odds <= 3.20 &&
        prob >= 0.55 &&
        ev >= 0.02
      ) {
        list.push({
          market,
          pick,
          odds,
          prob,
          ev,
          safeCombo,
        });
      }
    }

    /********************************************
     MERCADOS SIMPLES
    ********************************************/
    add("1", `${localTeam.name} gana`, oddHome, pHome);
    add("X", `Empate`, oddDraw, pDraw);
    add("2", `${visitTeam.name} gana`, oddAway, pAway);

    add("1X", `${localTeam.name} o empate`, odd1X, pHome + pDraw);
    add("X2", `${visitTeam.name} o empate`, oddX2, pAway + pDraw);

    add("Over1.5", "Más de 1.5 goles", oddOver15, pOver15);
    add("Over2.5", "Más de 2.5 goles", oddOver25, pOver25);
    add("BTTS", "Ambos marcan", oddBTTS, pBTTS);

    /********************************************
     SAFE COMBIS PRIORITARIAS
    ********************************************/
    add(
      "Combi",
      `${localTeam.name} o empate + Más de 0.5 goles`,
      1.52,
      (pHome + pDraw) * pOver05 * 0.97,
      true
    );

    add(
      "Combi",
      `${visitTeam.name} o empate + Más de 0.5 goles`,
      1.64,
      (pAway + pDraw) * pOver05 * 0.96,
      true
    );

    add(
      "Combi",
      `${localTeam.name} o empate + Más de 1.5 goles`,
      1.72,
      (pHome + pDraw) * pOver15 * 0.95,
      true
    );

    add(
      "Combi",
      `${visitTeam.name} o empate + Más de 1.5 goles`,
      1.84,
      (pAway + pDraw) * pOver15 * 0.94,
      true
    );

    /********************************************
     ORDENAR CON PRIORIDAD SAFE COMBIS
    ********************************************/
    list.sort((a, b) => {
      const scoreA =
        a.ev * 0.35 +
        a.prob * 0.35 +
        (a.safeCombo ? 0.30 : 0);

      const scoreB =
        b.ev * 0.35 +
        b.prob * 0.35 +
        (b.safeCombo ? 0.30 : 0);

      return scoreB - scoreA;
    });

    const best = list[0];

    if (!best) {
      setResult(`
⚽ ${localTeam.name} vs ${visitTeam.name}

⚠️ No encontré apuesta con valor real.

📌 Recomendación:
No apostar prepartido.
      `);
      setLoading(false);
      return;
    }

    const confidence = Math.round(best.prob * 100);
    const stake =
      confidence >= 80
        ? "3/5"
        : confidence >= 70
        ? "2/5"
        : "1/5";

    setResult(`
⚽ ${localTeam.name} vs ${visitTeam.name}

🔥 BETVALUE AI V21.1

🎯 Pick recomendado:
${best.pick}

📊 Mercado:
${best.market}

💰 Cuota:
${best.odds.toFixed(2)}

📈 Value:
+${(best.ev * 100).toFixed(1)}%

🧠 Confianza:
${confidence}/100

🔥 Stake:
${stake}
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
            V21.1 Safe Combis Priority
          </p>
        </div>

        <div className="relative mb-4">
          <input
            value={localText}
            onChange={(e) => {
              setLocalText(e.target.value);
              setLocalTeam(null);
              setShowLocal(true);
            }}
            placeholder="Equipo local"
            className="w-full bg-white text-black px-5 py-4 rounded-2xl text-xl"
          />

          {showLocal && localSug.length > 0 && (
            <div className="absolute z-20 w-full bg-white text-black rounded-xl mt-1 overflow-hidden">
              {localSug.map((t) => (
                <div
                  key={t.id}
                  className="px-4 py-2 hover:bg-gray-200 cursor-pointer"
                  onClick={() => {
                    setLocalTeam(t);
                    setLocalText(t.name);
                    setShowLocal(false);
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
            value={visitText}
            onChange={(e) => {
              setVisitText(e.target.value);
              setVisitTeam(null);
              setShowVisit(true);
            }}
            placeholder="Equipo visitante"
            className="w-full bg-white text-black px-5 py-4 rounded-2xl text-xl"
          />

          {showVisit && visitSug.length > 0 && (
            <div className="absolute z-20 w-full bg-white text-black rounded-xl mt-1 overflow-hidden">
              {visitSug.map((t) => (
                <div
                  key={t.id}
                  className="px-4 py-2 hover:bg-gray-200 cursor-pointer"
                  onClick={() => {
                    setVisitTeam(t);
                    setVisitText(t.name);
                    setShowVisit(false);
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