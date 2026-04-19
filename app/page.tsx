"use client";

import { useState } from "react";

export default function Home() {
  const [match, setMatch] = useState("");
  const [result, setResult] = useState("");

  function limpiar(texto: string) {
    return texto
      .toLowerCase()
      .replace("fc", "")
      .replace("cf", "")
      .replace("real ", "")
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
  }

  async function analizarPartido() {
    if (!match.includes("vs")) {
      setResult("Escribe así: Everton vs Liverpool");
      return;
    }

    setResult("Analizando forma real...");

    const partes = match.split("vs");
    const local = partes[0].trim();
    const visitante = partes[1].trim();

    const datos = await buscarLiga(local, visitante);

    if (!datos) {
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

    if (equipoLocal.position < equipoVisitante.position) {
      probLocal += 10;
      probVisitante -= 10;
    } else {
      probVisitante += 10;
      probLocal -= 10;
    }

    const victoriasLocal =
      (formaLocal.match(/V/g) || []).length;

    const victoriasVisitante =
      (formaVisitante.match(/V/g) || []).length;

    probLocal += victoriasLocal * 2;
    probVisitante += victoriasVisitante * 2;

    let recomendacion = "Partido equilibrado";

    if (probLocal >= 55)
      recomendacion = "Victoria local";
    else if (probVisitante >= 55)
      recomendacion = "Victoria visitante";
    else recomendacion = "Ambos marcan";

    setResult(`
⚽ ${equipoLocal.team.name} vs ${equipoVisitante.team.name}

🏆 Competición: ${liga}

📈 Últimos 5 reales:
🏠 ${equipoLocal.team.name}: ${formaLocal}
✈️ ${equipoVisitante.team.name}: ${formaVisitante}

📊 Probabilidades:
Local ${probLocal}%
Empate ${probEmpate}%
Visitante ${probVisitante}%

🎯 Recomendación:
${recomendacion}
    `);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-green-950 text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8">

        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" className="w-40 mb-4" />
          <h1 className="text-4xl font-bold text-green-400">
            BetValue AI
          </h1>
          <p className="text-gray-300 mt-2 text-center">
            Predicciones con forma REAL
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
          className="w-full bg-green-500 hover:bg-green-600 py-4 rounded-2xl font-bold text-lg"
        >
          Analizar Partido
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