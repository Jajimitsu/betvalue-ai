"use client";

import { useState } from "react";

export default function Home() {
  const [match, setMatch] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const alias: Record<string, string> = {
    psg: "Paris Saint-Germain",
    lyon: "Olympique Lyonnais",
    inter: "Internazionale",
    milan: "AC Milan",
    barca: "Barcelona",
    atleti: "Atletico Madrid",
    juve: "Juventus",
    bayern: "Bayern Munich",
    mancity: "Manchester City",
    manutd: "Manchester United",
  };

  function normalizar(texto: string) {
    return texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/fc/g, "")
      .replace(/cf/g, "")
      .replace(/club de futbol/g, "")
      .replace(/real /g, "")
      .replace(/-/g, " ")
      .replace(/\./g, "")
      .replace(/\s+/g, "")
      .trim();
  }

  function corregirAlias(texto: string) {
    const key = normalizar(texto);
    return alias[key] || texto;
  }

  async function buscarLiga(local: string, visitante: string) {
    const ligas = ["CL", "PD", "PL", "SA", "BL1", "FL1"];

    const buscadoLocal = normalizar(
      corregirAlias(local)
    );

    const buscadoVisit = normalizar(
      corregirAlias(visitante)
    );

    for (const liga of ligas) {
      const res = await fetch(`/api/matches?league=${liga}`);
      const data = await res.json();

      if (!data.standings || !data.standings[0]) continue;

      const tabla = data.standings[0].table;

      const equipoLocal = tabla.find((t: any) => {
        const nombre = normalizar(t.team.name);
        return (
          nombre.includes(buscadoLocal) ||
          buscadoLocal.includes(nombre)
        );
      });

      const equipoVisitante = tabla.find((t: any) => {
        const nombre = normalizar(t.team.name);
        return (
          nombre.includes(buscadoVisit) ||
          buscadoVisit.includes(nombre)
        );
      });

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
    if (!match.toLowerCase().includes("vs")) {
      setResult("Escribe así: PSG vs Lyon");
      return;
    }

    setLoading(true);
    setResult("Buscando partido...");

    const partes = match.split(/vs/i);
    const local = partes[0].trim();
    const visitante = partes[1].trim();

    const datos = await buscarLiga(local, visitante);

    if (!datos) {
      setLoading(false);
      setResult("No encontré esos equipos.");
      return;
    }

    const { liga, equipoLocal, equipoVisitante } = datos;

    const formaLocal = await obtenerForma(
      equipoLocal.team.id
    );

    const formaVisit = await obtenerForma(
      equipoVisitante.team.id
    );

    let probLocal = 40;
    let probEmpate = 27;
    let probVisit = 33;

    // clasificación
    if (equipoLocal.position < equipoVisitante.position) {
      probLocal += 8;
      probVisit -= 8;
    } else {
      probVisit += 8;
      probLocal -= 8;
    }

    // localía
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
      equipoLocal.goalsFor > 45 &&
      equipoVisitante.goalsFor > 45
    )
      recomendacion = "Ambos marcan";
    else recomendacion = "Doble oportunidad local";

    setResult(`
⚽ ${equipoLocal.team.name} vs ${equipoVisitante.team.name}

🏆 Competición: ${liga}

📈 Forma:
${equipoLocal.team.name}: ${formaLocal}
${equipoVisitante.team.name}: ${formaVisit}

📊 Probabilidades:
🏠 ${probLocal}%
🤝 ${probEmpate}%
✈️ ${probVisit}%

🎯 Recomendación:
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
            Buscador Mixto Definitivo
          </p>
        </div>

        <input
          type="text"
          placeholder="Ej: PSG vs Lyon"
          value={match}
          onChange={(e) => setMatch(e.target.value)}
          className="w-full bg-white text-black px-5 py-4 rounded-2xl text-lg mb-4"
        />

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