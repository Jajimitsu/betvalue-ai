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

    setResult("Buscando datos reales...");

    const partes = match.split("vs");
    const local = partes[0].trim();
    const visitante = partes[1].trim();

    const datos = await buscarLiga(local, visitante);

    if (!datos) {
      setResult("No encontré ambos equipos.");
      return;
    }

    const { liga, equipoLocal, equipoVisitante } = datos;

    // MODELO PROBABILIDAD
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

    // CUOTAS JUSTAS
    const cuotaJustaLocal = (100 / probLocal).toFixed(2);
    const cuotaJustaEmpate = (100 / probEmpate).toFixed(2);
    const cuotaJustaVisitante = (100 / probVisitante).toFixed(2);

    // CUOTAS REALES
    let cuotaLocal = "-";
    let cuotaEmpate = "-";
    let cuotaVisitante = "-";

    try {
      const oddsRes = await fetch(
        `/api/odds?home=${encodeURIComponent(
          equipoLocal.team.name
        )}&away=${encodeURIComponent(
          equipoVisitante.team.name
        )}`
      );

      const oddsData = await oddsRes.json();

      if (
        oddsData.bookmakers &&
        oddsData.bookmakers[0] &&
        oddsData.bookmakers[0].markets[0]
      ) {
        const outcomes =
          oddsData.bookmakers[0].markets[0].outcomes;

        cuotaLocal = outcomes[0]?.price ?? "-";
        cuotaVisitante = outcomes[1]?.price ?? "-";
        cuotaEmpate = outcomes[2]?.price ?? "-";
      }
    } catch (error) {}

    let recomendacion = "Sin valor claro";

    if (
      cuotaLocal !== "-" &&
      Number(cuotaLocal) > Number(cuotaJustaLocal)
    ) {
      recomendacion = "VALUE BET: Victoria local";
    } else if (
      cuotaVisitante !== "-" &&
      Number(cuotaVisitante) > Number(cuotaJustaVisitante)
    ) {
      recomendacion = "VALUE BET: Victoria visitante";
    } else if (
      cuotaEmpate !== "-" &&
      Number(cuotaEmpate) > Number(cuotaJustaEmpate)
    ) {
      recomendacion = "VALUE BET: Empate";
    }

    setResult(`
📊 ${equipoLocal.team.name} vs ${equipoVisitante.team.name}

🏆 Competición:
${liga}

📈 Probabilidades modelo:
Local ${probLocal}%
Empate ${probEmpate}%
Visitante ${probVisitante}%

💰 Cuotas reales:
Local @${cuotaLocal}
Empate @${cuotaEmpate}
Visitante @${cuotaVisitante}

🎯 Recomendación:
${recomendacion}
    `);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white px-4">
      <h1 className="text-5xl font-bold text-green-400 mb-6">
        BetValue AI PRO
      </h1>

      <p className="mb-6 text-gray-400">
        Detecta cuotas con valor automáticamente
      </p>

      <input
        type="text"
        placeholder="Ej: Real Madrid vs Barcelona"
        value={match}
        onChange={(e) => setMatch(e.target.value)}
        className="bg-white text-black px-4 py-3 rounded w-96 mb-4"
      />

      <button
        onClick={analizarPartido}
        className="bg-green-500 hover:bg-green-600 px-6 py-3 rounded font-bold"
      >
        Analizar
      </button>

      {result && (
        <div className="mt-6 whitespace-pre-line bg-gray-900 p-6 rounded border border-green-500 max-w-xl">
          {result}
        </div>
      )}
    </main>
  );
}