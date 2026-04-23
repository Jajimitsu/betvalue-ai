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
  prob: number; // 0..1
  ev: number;
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

    const unicos = lista.filter(
      (team, index, self) =>
        index === self.findIndex((x) => x.name === team.name)
    );

    setTeams(unicos);
    setResult("");
  }

  /************************************************
   NORMALIZAR NOMBRES
  *************************************************/
  function clean(txt: string) {
    return txt
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/fc|cf|ud|cd|rcd|club|sad/g, "")
      .replace(/de futbol|football club/g, "")
      .replace(/\./g, "")
      .replace(/-/g, " ")
      .replace(/\s+/g, "")
      .trim();
  }

  function sameTeam(a: string, b: string) {
    const x = clean(a);
    const y = clean(b);
    return x === y || x.includes(y) || y.includes(x);
  }

  /************************************************
   AUTOCOMPLETE
  *************************************************/
  const localSug = useMemo(() => {
    const q = clean(localText);
    if (!q) return [];
    return teams
      .filter((t) => clean(t.name).includes(q))
      .slice(0, 8);
  }, [localText, teams]);

  const visitSug = useMemo(() => {
    const q = clean(visitText);
    if (!q) return [];
    return teams
      .filter((t) => clean(t.name).includes(q))
      .slice(0, 8);
  }, [visitText, teams]);

  /************************************************
   ANALIZAR
  *************************************************/
  async function analizar() {
    if (!localTeam || !visitTeam) {
      setResult("Selecciona ambos equipos.");
      return;
    }

    setLoading(true);
    setResult("Analizando mercados...");

    /**********************************************
     MODELO PROPIO BASE
    **********************************************/
    let pHome = 44;
    let pDraw = 26;
    let pAway = 30;

    // posiciones
    if (localTeam.position < visitTeam.position) {
      pHome += 8;
      pAway -= 8;
    } else if (visitTeam.position < localTeam.position) {
      pAway += 8;
      pHome -= 8;
    }

    // localía
    pHome += 6;

    // ataque / defensa simple
    const diffHome =
      localTeam.goalsFor - localTeam.goalsAgainst;

    const diffAway =
      visitTeam.goalsFor - visitTeam.goalsAgainst;

    if (diffHome > diffAway) {
      pHome += 4;
      pAway -= 4;
    } else if (diffAway > diffHome) {
      pAway += 4;
      pHome -= 4;
    }

    // normalizar
    const total = pHome + pDraw + pAway;

    pHome = pHome / total;
    pDraw = pDraw / total;
    pAway = 1 - pHome - pDraw;

    /**********************************************
     GOLES ESTIMADOS
    **********************************************/
    const avgGF =
      (localTeam.goalsFor + visitTeam.goalsFor) / 2;

    const avgGA =
      (localTeam.goalsAgainst +
        visitTeam.goalsAgainst) / 2;

    const attackIndex = (avgGF + avgGA) / 40;

    const pOver15 = Math.min(
      0.92,
      Math.max(0.58, 0.68 + attackIndex)
    );

    const pOver25 = Math.min(
      0.82,
      Math.max(0.35, pOver15 - 0.18)
    );

    const pBTTS = Math.min(
      0.78,
      Math.max(
        0.30,
        0.48 +
          (localTeam.goalsFor > 30 ? 0.08 : 0) +
          (visitTeam.goalsFor > 30 ? 0.08 : 0)
      )
    );

    try {
      const res = await fetch("/api/odds");
      const odds = await res.json();

      const partido = odds.find((m: any) => {
        return (
          sameTeam(m.home_team, localTeam.name) &&
          sameTeam(m.away_team, visitTeam.name)
        );
      });

      let oddHome = 1.75;
      let oddAway = 2.10;
      let oddDraw = 3.20;

      if (partido) {
        const book = partido.bookmakers?.[0];

        const h2h =
          book?.markets?.find(
            (m: any) => m.key === "h2h"
          )?.outcomes || [];

        const h =
          h2h.find((o: any) =>
            sameTeam(o.name, partido.home_team)
          )?.price;

        const a =
          h2h.find((o: any) =>
            sameTeam(o.name, partido.away_team)
          )?.price;

        const d =
          h2h.find((o: any) =>
            o.name.toLowerCase().includes("draw")
          )?.price;

        if (h) oddHome = h;
        if (a) oddAway = a;
        if (d) oddDraw = d;
      }

      /**********************************************
       ESTIMACIONES MERCADOS
      **********************************************/
      const odd1X = Math.max(
        1.18,
        ((oddHome + oddDraw) / 2) * 0.72
      );

      const oddX2 = Math.max(
        1.20,
        ((oddAway + oddDraw) / 2) * 0.72
      );

      const oddOver15 = 1.28;
      const oddOver25 = 1.72;
      const oddBTTS = 1.85;

      const candidates: Candidate[] = [];

      function push(
        market: string,
        pick: string,
        odds: number,
        prob: number
      ) {
        const ev = prob * odds - 1;

        if (
          odds >= 1.35 &&
          odds <= 3.50 &&
          prob >= 0.56 &&
          ev >= 0.03
        ) {
          candidates.push({
            market,
            pick,
            odds,
            prob,
            ev,
          });
        }
      }

      /**********************************************
       SINGLES
      **********************************************/
      push("1", `${localTeam.name} gana`, oddHome, pHome);
      push("X", `Empate`, oddDraw, pDraw);
      push("2", `${visitTeam.name} gana`, oddAway, pAway);

      push(
        "1X",
        `${localTeam.name} o empate`,
        odd1X,
        pHome + pDraw
      );

      push(
        "X2",
        `${visitTeam.name} o empate`,
        oddX2,
        pAway + pDraw
      );

      push(
        "Over1.5",
        `Más de 1.5 goles`,
        oddOver15,
        pOver15
      );

      push(
        "Over2.5",
        `Más de 2.5 goles`,
        oddOver25,
        pOver25
      );

      push(
        "BTTS",
        `Ambos marcan`,
        oddBTTS,
        pBTTS
      );

      /**********************************************
       COMBIS INTELIGENTES
      **********************************************/
      const favHome = pHome > pAway;

      if (favHome) {
        push(
          "Combi",
          `${localTeam.name} o empate + Más de 1.5 goles`,
          1.62,
          (pHome + pDraw) * pOver15 * 0.96
        );

        push(
          "Combi",
          `${localTeam.name} gana + Más de 0.5 goles`,
          1.58,
          pHome * 0.96
        );
      } else {
        push(
          "Combi",
          `${visitTeam.name} o empate + Más de 1.5 goles`,
          1.72,
          (pAway + pDraw) * pOver15 * 0.95
        );

        push(
          "Combi",
          `${visitTeam.name} gana + Más de 0.5 goles`,
          1.78,
          pAway * 0.94
        );
      }

      /**********************************************
       ELEGIR MEJOR VALOR FACTIBLE
      **********************************************/
      candidates.sort((a, b) => {
        const scoreA = a.ev * 0.7 + a.prob * 0.3;
        const scoreB = b.ev * 0.7 + b.prob * 0.3;
        return scoreB - scoreA;
      });

      const best = candidates[0];

      if (!best) {
        setResult(`
⚽ ${localTeam.name} vs ${visitTeam.name}

⚠️ No detecté apuesta con valor real.

📌 Recomendación:
No apostar prepartido.
        `);

        setLoading(false);
        return;
      }

      const conf = Math.round(
        Math.min(
          95,
          Math.max(
            55,
            best.prob * 100 + best.ev * 100
          )
        )
      );

      const stake =
        conf >= 82
          ? "3/5"
          : conf >= 72
          ? "2/5"
          : "1/5";

      setResult(`
⚽ ${localTeam.name} vs ${visitTeam.name}

🔥 BETVALUE AI V21

🎯 Mejor apuesta detectada:
${best.pick}

📊 Mercado:
${best.market}

💰 Cuota:
${best.odds.toFixed(2)}

📈 Value:
+${(best.ev * 100).toFixed(1)}%

🧠 Confianza:
${conf}/100

🔥 Stake:
${stake}

📌 Probabilidad IA:
${(best.prob * 100).toFixed(1)}%
      `);

      setLoading(false);
    } catch {
      setResult("Error consultando APIs.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-green-950 text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8">

        <div className="flex flex-col items-center mb-8">
          <img
            src="/logo.png"
            alt="logo"
            className="w-40 mb-4"
          />

          <h1 className="text-5xl font-bold text-green-400">
            BetValue AI
          </h1>

          <p className="text-gray-300 mt-2">
            V21 Value Scanner
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