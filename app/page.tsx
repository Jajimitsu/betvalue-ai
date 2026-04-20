"use client";

import { useEffect, useMemo, useState } from "react";

export default function Home() {
  const [local, setLocal] = useState("");
  const [visitante, setVisitante] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const [equipos, setEquipos] = useState<string[]>([]);
  const [showLocal, setShowLocal] = useState(false);
  const [showVisit, setShowVisit] = useState(false);

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

  useEffect(() => {
    cargarEquipos();
  }, []);

  async function cargarEquipos() {
    const ligas = [
      "PD","SD","PL","SA","BL1","FL1",
      "CL","EL","ECL","PPL","DED",
      "ELC","TSL","BSA","ARG"
    ];

    const lista = new Set<string>();

    for (const liga of ligas) {
      try {
        const res = await fetch(`/api/matches?league=${liga}`);
        const data = await res.json();

        if (!data.standings?.[0]?.table) continue;

        data.standings[0].table.forEach((t: any) => {
          lista.add(t.team.name);
        });
      } catch {}
    }

    setEquipos([...lista].sort());
  }

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

  const sugerenciasLocal = useMemo(() => {
    if (local.length < 2) return [];
    const q = normalizar(local);
    return equipos
      .filter((e) => normalizar(e).includes(q))
      .slice(0, 8);
  }, [local, equipos]);

  const sugerenciasVisit = useMemo(() => {
    if (visitante.length < 2) return [];
    const q = normalizar(visitante);
    return equipos
      .filter((e) => normalizar(e).includes(q))
      .slice(0, 8);
  }, [visitante, equipos]);

  async function buscarLiga(
    equipoLocalTexto: string,
    equipoVisitTexto: string
  ) {
    const ligas = [
      "PD","SD","PL","SA","BL1","FL1",
      "CL","EL","ECL","PPL","DED",
      "ELC","TSL","BSA","ARG"
    ];

    const buscadoLocal = normalizar(
      corregirAlias(equipoLocalTexto)
    );

    const buscadoVisit = normalizar(
      corregirAlias(equipoVisitTexto)
    );

    for (const liga of ligas) {
      const res = await fetch(`/api/matches?league=${liga}`);
      const data = await res.json();

      if (!data.standings?.[0]?.table) continue;

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
    if (!local || !visitante) {
      setResult("Escribe ambos equipos.");
      return;
    }

    setLoading(true);
    setResult("Analizando partido...");

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

    const formaPtsLocal =
      contar(formaLocal, "V") * 3 +
      contar(formaLocal, "E");

    const formaPtsVisit =
      contar(formaVisit, "V") * 3 +
      contar(formaVisit, "E");

    let probLocal = 40;
    let probEmpate = 28;
    let probVisit = 32;

    if (equipoLocal.position < equipoVisitante.position) {
      probLocal += 6;
      probVisit -= 6;
    } else {
      probVisit += 6;
      probLocal -= 6;
    }

    probLocal += 6;

    probLocal += Math.round(formaPtsLocal / 3);
    probVisit += Math.round(formaPtsVisit / 3);

    if (equipoLocal.goalsFor > equipoVisitante.goalsFor)
      probLocal += 4;
    else probVisit += 4;

    if (
      equipoLocal.goalsAgainst <
      equipoVisitante.goalsAgainst
    )
      probLocal += 4;
    else probVisit += 4;

    const total =
      probLocal + probEmpate + probVisit;

    probLocal = Math.round((probLocal / total) * 100);
    probEmpate = Math.round((probEmpate / total) * 100);
    probVisit = 100 - probLocal - probEmpate;

    let recomendacion = "Partido equilibrado";

    if (probLocal >= 57)
      recomendacion = "Victoria local";
    else if (probVisit >= 57)
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

📈 Forma últimos 5:
${equipoLocal.team.name}: ${formaLocal}
${equipoVisitante.team.name}: ${formaVisit}

📊 Probabilidades:
🏠 Local ${probLocal}%
🤝 Empate ${probEmpate}%
✈️ Visitante ${probVisit}%

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
            Autocomplete V4
          </p>
        </div>

        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Equipo local"
            value={local}
            onChange={(e) => {
              setLocal(e.target.value);
              setShowLocal(true);
            }}
            className="w-full bg-white text-black px-5 py-4 rounded-2xl text-lg"
          />

          {showLocal && sugerenciasLocal.length > 0 && (
            <div className="absolute z-20 w-full bg-white text-black rounded-xl mt-1 overflow-hidden shadow-xl">
              {sugerenciasLocal.map((eq) => (
                <div
                  key={eq}
                  onClick={() => {
                    setLocal(eq);
                    setShowLocal(false);
                  }}
                  className="px-4 py-2 hover:bg-gray-200 cursor-pointer"
                >
                  {eq}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Equipo visitante"
            value={visitante}
            onChange={(e) => {
              setVisitante(e.target.value);
              setShowVisit(true);
            }}
            className="w-full bg-white text-black px-5 py-4 rounded-2xl text-lg"
          />

          {showVisit && sugerenciasVisit.length > 0 && (
            <div className="absolute z-20 w-full bg-white text-black rounded-xl mt-1 overflow-hidden shadow-xl">
              {sugerenciasVisit.map((eq) => (
                <div
                  key={eq}
                  onClick={() => {
                    setVisitante(eq);
                    setShowVisit(false);
                  }}
                  className="px-4 py-2 hover:bg-gray-200 cursor-pointer"
                >
                  {eq}
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