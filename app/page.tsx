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

export default function Home() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [homeText, setHomeText] = useState("");
  const [awayText, setAwayText] = useState("");
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
    const q = clean(homeText);
    if (!q) return [];
    return teams.filter(t => clean(t.name).includes(q)).slice(0, 8);
  }, [homeText, teams]);

  const awaySug = useMemo(() => {
    const q = clean(awayText);
    if (!q) return [];
    return teams.filter(t => clean(t.name).includes(q)).slice(0, 8);
  }, [awayText, teams]);

  function pct(v: number) {
    return `${v.toFixed(1)}%`;
  }

  async function analizar() {
    if (!home || !away) {
      setResult("Selecciona ambos equipos.");
      return;
    }

    setLoading(true);
    setResult("Pensando como sharp...");

    /*********************************************
     VARIABLES BASE
    *********************************************/
    const homePts =
      (21 - home.position) * 3 +
      (home.goalsFor - home.goalsAgainst);

    const awayPts =
      (21 - away.position) * 3 +
      (away.goalsFor - away.goalsAgainst);

    const diff = homePts - awayPts;

    const avgGoalsHome =
      home.goalsFor + home.goalsAgainst;

    const avgGoalsAway =
      away.goalsFor + away.goalsAgainst;

    const totalGoals = avgGoalsHome + avgGoalsAway;

    /*********************************************
     PROBABILIDADES
    *********************************************/
    let pHome = 45 + diff * 0.6;
    let pDraw = 26;
    let pAway = 29 - diff * 0.6;

    pHome += 6; // localía

    const sum = pHome + pDraw + pAway;

    pHome = (pHome / sum) * 100;
    pDraw = (pDraw / sum) * 100;
    pAway = 100 - pHome - pDraw;

    /*********************************************
     DETECTOR DE CONTEXTO
    *********************************************/
    let context = "";
    let pick = "";
    let market = "";
    let odds = 1.50;
    let confidence = 70;
    let reason = "";

    /*********************************************
     1 FAVORITO LOCAL MUY CLARO
    *********************************************/
    if (diff > 18) {
      context = "Favorito local dominante";

      pick = `${home.name} gana`;
      market = "1";
      odds = 1.62;
      confidence = 83;

      reason =
        "Superioridad clara en tabla y rendimiento.";
    }

    /*********************************************
     2 FAVORITO VISITANTE MUY CLARO
    *********************************************/
    else if (diff < -18) {
      context = "Favorito visitante dominante";

      pick = `${away.name} empate no válido`;
      market = "DNB";
      odds = 1.72;
      confidence = 80;

      reason =
        "Visitante superior, protección al empate.";
    }

    /*********************************************
     3 PARTIDO CERRADO
    *********************************************/
    else if (totalGoals < 92) {
      context = "Partido de pocos goles";

      pick = `Menos de 3.5 goles`;
      market = "Under3.5";
      odds = 1.44;
      confidence = 79;

      reason =
        "Ambos equipos promedian marcadores bajos.";
    }

    /*********************************************
     4 DOS ATAQUES BUENOS
    *********************************************/
    else if (
      home.goalsFor > 42 &&
      away.goalsFor > 38
    ) {
      context = "Duelo ofensivo";

      pick = `Ambos marcan`;
      market = "BTTS";
      odds = 1.78;
      confidence = 76;

      reason =
        "Dos ataques fuertes y producción ofensiva alta.";
    }

    /*********************************************
     5 IGUALADO TOTAL
    *********************************************/
    else if (Math.abs(diff) < 6) {
      context = "Partido equilibrado";

      pick = `Más de 1.5 goles`;
      market = "Over1.5";
      odds = 1.34;
      confidence = 71;

      reason =
        "Mercado más estable en duelo parejo.";
    }

    /*********************************************
     6 LIGERA VENTAJA LOCAL
    *********************************************/
    else if (diff >= 6) {
      context = "Ventaja local moderada";

      pick = `${home.name} o empate + Más de 1.5 goles`;
      market = "Combi";
      odds = 1.63;
      confidence = 77;

      reason =
        "Local superior sin necesidad de ir al 1 puro.";
    }

    /*********************************************
     7 LIGERA VENTAJA VISITANTE
    *********************************************/
    else {
      context = "Ventaja visitante moderada";

      pick = `${away.name} o empate`;
      market = "X2";
      odds = 1.55;
      confidence = 74;

      reason =
        "Visitante mejor perfil global.";
    }

    /*********************************************
     FILTRO SHARP: NO BET
    *********************************************/
    if (confidence < 69) {
      setResult(`
⚽ ${home.name} vs ${away.name}

🔥 BETVALUE AI V23

📌 Contexto:
Mercado sin ventaja clara.

🚫 Recomendación:
NO BET

📊 Modelo IA:
🏠 ${pct(pHome)}
🤝 ${pct(pDraw)}
✈️ ${pct(pAway)}
      `);

      setLoading(false);
      return;
    }

    const prob = confidence / 100;
    const ev = prob * odds - 1;

    const stake =
      confidence >= 82
        ? "3/5"
        : confidence >= 75
        ? "2/5"
        : "1/5";

    setResult(`
⚽ ${home.name} vs ${away.name}

🔥 BETVALUE AI V23

🧠 Contexto detectado:
${context}

🎯 Pick final:
${pick}

📊 Mercado:
${market}

💰 Cuota estimada:
${odds.toFixed(2)}

📈 Value:
${ev >= 0 ? "+" : ""}${(ev * 100).toFixed(1)}%

🧠 Confianza:
${confidence}/100

🔥 Stake:
${stake}

📌 Motivo principal:
${reason}

📊 Modelo IA:
🏠 ${pct(pHome)}
🤝 ${pct(pDraw)}
✈️ ${pct(pAway)}
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
            V23 Sharp Core
          </p>
        </div>

        <div className="relative mb-4">
          <input
            value={homeText}
            onChange={(e) => {
              setHomeText(e.target.value);
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
                    setHomeText(t.name);
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
            value={awayText}
            onChange={(e) => {
              setAwayText(e.target.value);
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
                    setAwayText(t.name);
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
          {loading ? "Analizando..." : "Analizar Partido"}
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