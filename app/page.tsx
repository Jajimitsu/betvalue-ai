"use client";

import { useEffect, useState } from "react";

type Equipo = {
  id: number;
  name: string;
  position: number;
  goalsFor: number;
  goalsAgainst: number;
};

export default function Home() {
  const [localText, setLocalText] = useState("");
  const [visitText, setVisitText] = useState("");

  const [localTeam, setLocalTeam] = useState<Equipo | null>(
    null
  );
  const [visitTeam, setVisitTeam] = useState<Equipo | null>(
    null
  );

  const [teams, setTeams] = useState<Equipo[]>([]);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    cargarEquipos();
  }, []);

  async function cargarEquipos() {
    const ligas = ["CL", "PD", "PL", "SA", "BL1", "FL1"];
    let todos: Equipo[] = [];

    for (const liga of ligas) {
      const res = await fetch(`/api/matches?league=${liga}`);
      const data = await res.json();

      if (!data.standings || !data.standings[0]) continue;

      const tabla = data.standings[0].table;

      const lista = tabla.map((t: any) => ({
        id: t.team.id,
        name: t.team.name,
        position: t.position,
        goalsFor: t.goalsFor,
        goalsAgainst: t.goalsAgainst,
      }));

      todos = [...todos, ...lista];
    }

    // quitar duplicados por id
    const unicos = todos.filter(
      (team, index, self) =>
        index ===
        self.findIndex((t) => t.id === team.id)
    );

    setTeams(unicos);
  }

  function sugerencias(texto: string) {
    if (!texto) return [];

    return teams
      .filter((t) =>
        t.name.toLowerCase().includes(texto.toLowerCase())
      )
      .slice(0, 6);
  }

  async function obtenerForma(teamId: number) {
    try {
      const res = await fetch(`/api/form?team=${teamId}`);
      const data = await res.json();

      if (!data.matches) return "Sin datos";

      return data.matches
        .map((m: any) => {
          const esLocal = m.homeTeam.id === teamId;

          const gf = esLocal
            ? m.score.fullTime.home
            : m.score.fullTime.away;

          const gc = esLocal
            ? m.score.fullTime.away
            : m.score.fullTime.home;

          if (gf > gc) return "V";
          if (gf < gc) return "D";
          return "E";
        })
        .join(" ");
    } catch {
      return "Sin datos";
    }
  }

  function contar(forma: string, letra: string) {
    return (forma.match(new RegExp(letra, "g")) || []).length;
  }

  async function analizarPartido() {
    if (!localTeam || !visitTeam) {
      setResult(
        "Selecciona ambos equipos desde sugerencias."
      );
      return;
    }

    setLoading(true);
    setResult("Analizando partido...");

    const formaLocal = await obtenerForma(localTeam.id);
    const formaVisit = await obtenerForma(visitTeam.id);

    let probLocal = 40;
    let probEmpate = 27;
    let probVisit = 33;

    // clasificación
    if (localTeam.position < visitTeam.position) {
      probLocal += 8;
      probVisit -= 8;
    } else {
      probVisit += 8;
      probLocal -= 8;
    }

    // ventaja local
    probLocal += 7;

    // forma
    probLocal += contar(formaLocal, "V") * 2;
    probVisit += contar(formaVisit, "V") * 2;

    const total =
      probLocal + probEmpate + probVisit;

    probLocal = Math.round((probLocal / total) * 100);
    probEmpate = Math.round((probEmpate / total) * 100);
    probVisit = 100 - probLocal - probEmpate;

    let recomendacion = "Partido equilibrado";

    if (probLocal >= 56)
      recomendacion = "Victoria local";
    else if (probVisit >= 56)
      recomendacion = "Victoria visitante";
    else if (
      localTeam.goalsFor > 45 &&
      visitTeam.goalsFor > 45
    )
      recomendacion = "Ambos marcan";
    else recomendacion = "Doble oportunidad local";

    setResult(`
⚽ ${localTeam.name} vs ${visitTeam.name}

📈 Últimos 5:
${localTeam.name}: ${formaLocal}
${visitTeam.name}: ${formaVisit}

📊 Probabilidades:
🏠 ${probLocal}%
🤝 ${probEmpate}%
✈️ ${probVisit}%

🎯 Recomendación:
${recomendacion}
    `);

    setLoading(false);
  }

  const sugerLocal = sugerencias(localText);
  const sugerVisit = sugerencias(visitText);

  return (
    <main className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-green-950 text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8">

        <div className="flex flex-col items-center mb-8">
          <img
            src="/logo.png"
            alt="BetValue AI"
            className="w-40 mb-4"
          />
          <h1 className="text-4xl font-bold text-green-400">
            BetValue AI
          </h1>
          <p className="text-gray-300 mt-2">
            Autocomplete PRO
          </p>
        </div>

        {/* LOCAL */}
        <div className="mb-4 relative">
          <input
            value={localText}
            onChange={(e) => {
              setLocalText(e.target.value);
              setLocalTeam(null);
            }}
            placeholder="Equipo local"
            className="w-full bg-white text-black px-4 py-3 rounded-2xl"
          />

          {localText && !localTeam && (
            <div className="absolute w-full bg-white text-black rounded-xl mt-1 overflow-hidden z-10">
              {sugerLocal.map((team) => (
                <div
                  key={team.id}
                  onClick={() => {
                    setLocalTeam(team);
                    setLocalText(team.name);
                  }}
                  className="px-4 py-2 hover:bg-gray-200 cursor-pointer"
                >
                  {team.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* VISITANTE */}
        <div className="mb-4 relative">
          <input
            value={visitText}
            onChange={(e) => {
              setVisitText(e.target.value);
              setVisitTeam(null);
            }}
            placeholder="Equipo visitante"
            className="w-full bg-white text-black px-4 py-3 rounded-2xl"
          />

          {visitText && !visitTeam && (
            <div className="absolute w-full bg-white text-black rounded-xl mt-1 overflow-hidden z-10">
              {sugerVisit.map((team) => (
                <div
                  key={team.id}
                  onClick={() => {
                    setVisitTeam(team);
                    setVisitText(team.name);
                  }}
                  className="px-4 py-2 hover:bg-gray-200 cursor-pointer"
                >
                  {team.name}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={analizarPartido}
          disabled={loading}
          className="w-full bg-green-500 hover:bg-green-600 py-4 rounded-2xl font-bold text-lg"
        >
          {loading
            ? "Analizando..."
            : "Analizar Partido"}
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