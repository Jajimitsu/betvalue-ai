"use client";

import { useState } from "react";

export default function Home() {
  const [match, setMatch] = useState("");
  const [result, setResult] = useState("");

  function limpiar(texto: string) {
    return texto
      .toLowerCase()
      .replace("cf", "")
      .replace("fc", "")
      .replace("club de fútbol", "")
      .replace("club de futbol", "")
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

  async function analizarPartido() {
    if (!match.includes("vs")) {
      setResult("Escribe así: Real Madrid vs Barcelona");
      return;
    }

    setResult("Analizando partido...");

    const partes = match.split("vs");
    const local = partes[0].trim();
    const visitante = partes[1].trim();

    const datos = await buscarLiga(local, visitante);

    if (!datos) {
      setResult("No encontré ambos equipos.");
      return;
    }

    const { liga, equipoLocal, equipoVisitante } = datos;

    const diferenciaPosicion =
      equipoVisitante.position - equipoLocal.position;

    let probLocal = 40;
    let probEmpate = 30;
    let probVisitante = 30;

    if (diferenciaPosicion >= 5) {
      probLocal = 58;
      probEmpate = 24;
      probVisitante = 18;
    } else if (diferenciaPosicion <= -5) {
      probLocal = 20;
      probEmpate = 25;
      probVisitante = 55;
    }

    let recomendacion = "Sin valor claro";

    if (probLocal >= 55) recomendacion = "Victoria local";
    else if (probVisitante >= 55)
      recomendacion = "Victoria visitante";
    else if (
      equipoLocal.goalsFor > 50 &&
      equipoVisitante.goalsFor > 50
    )
      recomendacion = "Ambos marcan";
    else recomendacion = "Over 2.5 goles";

    setResult(`
⚽ ${equipoLocal.team.name} vs ${equipoVisitante.team.name}

🏆 Competición: ${liga}

📈 Probabilidades:
🏠 Local: ${probLocal}%
🤝 Empate: ${probEmpate}%
✈️ Visitante: ${probVisitante}%

🎯 Recomendación PRO:
${recomendacion}
    `);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-green-950 text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8">

        <div className="flex flex-col items-center mb-8">
          <img
            src="/logo.png"
            alt="BetValue AI"
            className="w-44 mb-4"
          />

          <h1 className="text-4xl font-bold text-green-400">
            BetValue AI
          </h1>

          <p className="text-gray-300 mt-2 text-center">
            Predicciones deportivas con inteligencia de datos
          </p>
        </div>

        <input
          type="text"
          placeholder="Ej: Real Madrid vs Manchester City"
          value={match}
          onChange={(e) => setMatch(e.target.value)}
          className="w-full bg-white text-black px-5 py-4 rounded-2xl text-lg mb-4 outline-none"
        />

        <button
          onClick={analizarPartido}
          className="w-full bg-green-500 hover:bg-green-600 transition-all py-4 rounded-2xl font-bold text-lg shadow-lg"
        >
          Analizar Partido
        </button>

        {result && (
          <div className="mt-6 bg-black/40 border border-green-500/30 rounded-2xl p-6 whitespace-pre-line text-lg leading-8">
            {result}
          </div>
        )}

        <p className="text-center text-sm text-gray-400 mt-6">
          © BetValue AI PRO
        </p>
      </div>
    </main>
  );
}