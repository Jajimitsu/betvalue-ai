"use client";

import { useState } from "react";

export default function Home() {
  const [match, setMatch] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  function limpiar(texto: string) {
    return texto
      .toLowerCase()
      .replace("fc", "")
      .replace("cf", "")
      .replace("real ", "")
      .replace("club de fútbol", "")
      .replace("club de futbol", "")
      .trim();
  }

  async function buscarLiga(local: string, visitante: string) {
    const ligas = ["CL", "PD", "PL", "SA", "BL1", "FL1"];

    for (const liga of ligas) {
      const res = await fetch(`/api/matches?league=${liga}`);
      const data = await res.json();

      if (!data.standings || !data.standings[0]) continue;

      const tabla = data.standings[0].table;

      const equipoLocal = tabla.find((t: any) =>
        limpiar(t.team.name).includes(limpiar(local))
      );

      const equipoVisitante = tabla.find((t: any) =>
        limpiar(t.team.name).includes(limpiar(visitante))
      );

      if (equipoLocal && equipoVisitante) {
        return { liga, equipoLocal, equipoVisitante };
      }
    }

    return null;
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
    if (!match.includes("vs")) {
      setResult("Escribe así: Everton vs Liverpool");
      return;
    }

    setLoading(true);
    setResult("Analizando partido...");

    const partes = match.split("vs");
    const local = partes[0].trim();
    const visitante = partes[1].trim();

    const datos = await buscarLiga(local, visitante);

    if (!datos) {
      setLoading(false);
      setResult("No encontré ambos equipos.");
      return;
    }

    const { liga, equipoLocal, equipoVisitante } = datos;

    const formaLocal = await obtenerForma(
      equipoLocal.team.id
    );

    const formaVisitante = await obtenerForma(
      equipoVisitante.team.id
    );

    let probLocal = 38;
    let probEmpate = 27;
    let probVisitante = 35;

    // Clasificación
    if (equipoLocal.position < equipoVisitante.position) {
      probLocal += 8;
      probVisitante -= 8;
    } else {
      probVisitante += 8;
      probLocal -= 8;
    }

    // Ventaja local
    probLocal += 7;
    probVisitante -= 4;

    // Forma últimos 5
    const vLocal = contar(formaLocal, "V");
    const vVisit = contar(formaVisitante, "V");

    probLocal += vLocal * 2;
    probVisitante += vVisit * 2;

    // Goles temporada
    if (
      equipoLocal.goalsFor > equipoVisitante.goalsFor
    ) {
      probLocal += 3;
    } else {
      probVisitante += 3;
    }

    // Normalización
    if (probLocal < 5) probLocal = 5;
    if (probVisitante < 5) probVisitante = 5;

    const total =
      probLocal + probEmpate + probVisitante;

    probLocal = Math.round((probLocal / total) * 100);
    probEmpate = Math.round((probEmpate / total) * 100);
    probVisitante =
      100 - probLocal - probEmpate;

    let recomendacion = "Partido equilibrado";

    if (probLocal >= 56)
      recomendacion = "Victoria local";
    else if (probVisitante >= 56)
      recomendacion = "Victoria visitante";
    else if (
      equipoLocal.goalsFor > 45 &&
      equipoVisitante.goalsFor > 45
    )
      recomendacion = "Ambos marcan";
    else if (
      equipoLocal.goalsAgainst > 40 &&
      equipoVisitante.goalsAgainst > 40
    )
      recomendacion = "Over 2.5 goles";
    else
      recomendacion = "Doble oportunidad local";

    setResult(`
⚽ ${equipoLocal.team.name} vs ${equipoVisitante.team.name}

🏆 Competición: ${liga}

📈 Forma últimos 5:
${equipoLocal.team.name}: ${formaLocal}
${equipoVisitante.team.name}: ${formaVisitante}

📊 Probabilidades:
🏠 Local ${probLocal}%
🤝 Empate ${probEmpate}%
✈️ Visitante ${probVisitante}%

⚽ Goles temporada:
${equipoLocal.team.name}: ${equipoLocal.goalsFor}
${equipoVisitante.team.name}: ${equipoVisitante.goalsFor}

🎯 Recomendación PRO:
${recomendacion}
    `);

    setLoading(false);
  }

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

          <p className="text-gray-300 mt-2 text-center">
            Motor predictivo vNEXT Estable
          </p>
        </div>

        <input
          type="text"
          placeholder="Ej: Everton vs Liverpool"
          value={match}
          onChange={(e) => setMatch(e.target.value)}
          className="w-full bg-white text-black px-5 py-4 rounded-2xl text-lg mb-4"
        />

        <button
          onClick={analizarPartido}
          disabled={loading}
          className="w-full bg-green-500 hover:bg-green-600 py-4 rounded-2xl font-bold text-lg"
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