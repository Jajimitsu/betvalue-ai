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
    cargarEquipos();
  }, []);

  async function cargarEquipos() {
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
    setResult("Leyendo contexto del partido...");

    /********************************************
     VARIABLES REALES
    ********************************************/
    const rankDiff = away.position - home.position;
    const homeStrength =
      (21 - home.position) +
      (home.goalsFor - home.goalsAgainst) / 5;

    const awayStrength =
      (21 - away.position) +
      (away.goalsFor - away.goalsAgainst) / 5;

    const strengthDiff = homeStrength - awayStrength;

    const totalGoals =
      home.goalsFor +
      home.goalsAgainst +
      away.goalsFor +
      away.goalsAgainst;

    const attackHome = home.goalsFor;
    const attackAway = away.goalsFor;

    const defHome = home.goalsAgainst;
    const defAway = away.goalsAgainst;

    /********************************************
     PROBABILIDADES BASE
    ********************************************/
    let pHome = 45 + strengthDiff * 1.8;
    let pDraw = 25;
    let pAway = 30 - strengthDiff * 1.8;

    pHome += 6; // localía

    const sum = pHome + pDraw + pAway;
    pHome = (pHome / sum) * 100;
    pDraw = (pDraw / sum) * 100;
    pAway = 100 - pHome - pDraw;

    /********************************************
     DETECTOR CONTEXTO
    ********************************************/
    let context = "";
    let pick = "";
    let market = "";
    let odds = 1.55;
    let confidence = 70;

    // 1 FAVORITO MUY FUERTE LOCAL
    if (strengthDiff > 8) {
      context = "Favorito local claro";

      pick = `${home.name} gana + Más de 0.5 goles`;
      market = "Combi";
      odds = 1.55;
      confidence = 84;
    }

    // 2 FAVORITO MUY FUERTE VISITANTE
    else if (strengthDiff < -8) {
      context = "Favorito visitante claro";

      pick = `${away.name} gana + Más de 0.5 goles`;
      market = "Combi";
      odds = 1.72;
      confidence = 82;
    }

    // 3 PARTIDO MUY IGUALADO
    else if (Math.abs(strengthDiff) < 2) {
      context = "Partido igualado";

      pick = `Más de 1.5 goles`;
      market = "Over1.5";
      odds = 1.36;
      confidence = 72;
    }

    // 4 DOS ATAQUES FUERTES
    else if (attackHome > 45 && attackAway > 40) {
      context = "Duelo ofensivo";

      pick = `Ambos marcan + Más de 1.5 goles`;
      market = "Combi";
      odds = 1.85;
      confidence = 79;
    }

    // 5 DOS EQUIPOS CERRADOS
    else if (totalGoals < 95) {
      context = "Partido cerrado";

      pick = `Menos de 3.5 goles`;
      market = "Under3.5";
      odds = 1.44;
      confidence = 76;
    }

    // 6 LOCAL LIGERAMENTE SUPERIOR
    else if (strengthDiff >= 2) {
      context = "Ventaja local";

      pick = `${home.name} o empate + Más de 1.5 goles`;
      market = "Combi";
      odds = 1.60;
      confidence = 78;
    }

    // 7 VISITANTE LIGERAMENTE SUPERIOR
    else {
      context = "Ventaja visitante";

      pick = `${away.name} o empate + Más de 1.5 goles`;
      market = "Combi";
      odds = 1.72;
      confidence = 76;
    }

    /********************************************
     VALUE APROX
    ********************************************/
    const prob =
      confidence / 100;

    const ev =
      prob * odds - 1;

    const stake =
      confidence >= 84
        ? "3/5"
        : confidence >= 74
        ? "2/5"
        : "1/5";

    setResult(`
⚽ ${home.name} vs ${away.name}

🔥 BETVALUE AI V22

🧠 Contexto detectado:
${context}

🎯 Pick recomendado:
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
            V22 Context Engine
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