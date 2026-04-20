"use client";

import { useState } from "react";

export default function Home() {
  const [local, setLocal] = useState("");
  const [visitante, setVisitante] = useState("");
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

  async function buscarLiga(
    equipoLocalTexto: string,
    equipoVisitTexto: string
  ) {
    const ligas = [
      "PD","SD","PL","SA","BL1","FL1",
      "CL","EL","ECL","PPL","DED",
      "ELC","TSL","BSA","ARG"
    ];

    const buscadoLocal = normalizar(corregirAlias(equipoLocalTexto));
    const buscadoVisit = normalizar(corregirAlias(equipoVisitTexto));

    for (const liga of ligas) {
      const res = await fetch(`/api/matches?league=${liga}`);
      const data = await res.json();

      if (!data.standings || !data.standings[0]) continue;

      const tabla = data.standings[0].table;

      const equipoLocal = tabla.find((t: any) => {
        const nombre = normalizar(t.team.name);
        return nombre.includes(buscadoLocal) || buscadoLocal.includes(nombre);
      });

      const equipoVisitante = tabla.find((t: any) => {
        const nombre = normalizar(t.team.name);
        return nombre.includes(buscadoVisit) || buscadoVisit.includes(nombre);
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

  async function buscarCuota(local: string, visitante: string) {
    try {
      const res = await fetch("/api/odds");
      const data = await res.json();

      const partido = data.find((m: any) => {
        const home = normalizar(m.home_team);
        const away = normalizar(m.away_team);

        return (
          home.includes(normalizar(local)) &&
          away.includes(normalizar(visitante))
        );
      });

      if (!partido) return null;

      const cuotaLocal =
        partido.bookmakers?.[0]?.markets?.[0]?.outcomes?.find(
          (o: any) => o.name === partido.home_team
        )?.price;

      const cuotaEmpate =
        partido.bookmakers?.[0]?.markets?.[0]?.outcomes?.find(
          (o: any) => o.name === "Draw"
        )?.price;

      const cuotaVisit =
        partido.bookmakers?.[0]?.markets?.[0]?.outcomes?.find(
          (o: any) => o.name === partido.away_team
        )?.price;

      return {
        cuotaLocal,
        cuotaEmpate,
        cuotaVisit,
      };
    } catch {
      return null;
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

    const formaLocal = await obtenerForma(equipoLocal.team.id);
    const formaVisit = await obtenerForma(equipoVisitante.team.id);

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
    let probElegida = probLocal;

    if (probLocal >= 57) {
      recomendacion = "Victoria local";
      probElegida = probLocal;
    } else if (probVisit >= 57) {
      recomendacion = "Victoria visitante";
      probElegida = probVisit;
    } else if (
      equipoLocal.goalsFor > 45 &&
      equipoVisitante.goalsFor > 45
    ) {
      recomendacion = "Ambos marcan";
    } else {
      recomendacion = "Doble oportunidad local";
    }

    const odds = await buscarCuota(
      equipoLocal.team.name,
      equipoVisitante.team.name
    );

    let cuotaMercado = null;

    if (odds) {
      if (recomendacion === "Victoria local")
        cuotaMercado = odds.cuotaLocal;
      else if (
        recomendacion === "Victoria visitante"
      )
        cuotaMercado = odds.cuotaVisit;
    }

    let textoValue = "Sin cuota disponible";
    let cuotaJusta = null;

    if (cuotaMercado && probElegida > 0) {
      cuotaJusta = (
        100 / probElegida
      ).toFixed(2);

      if (
        cuotaMercado >
        parseFloat(cuotaJusta)
      ) {
        textoValue = "🔥 VALUE BET";
      } else if (cuotaMercado < 1.40) {
        textoValue =
          "⚠️ Cuota muy baja";
      } else {
        textoValue =
          "❌ Sin valor";
      }
    }

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

💰 Cuota mercado:
${cuotaMercado ?? "-"}

📐 Cuota justa:
${cuotaJusta ?? "-"}

${textoValue}
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
            Value Bet Engine V3
          </p>
        </div>

        <input
          type="text"
          placeholder="Equipo local"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          className="w-full bg-white text-black px-5 py-4 rounded-2xl text-lg mb-4"
        />

        <input
          type="text"
          placeholder="Equipo visitante"
          value={visitante}
          onChange={(e) =>
            setVisitante(e.target.value)
          }
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