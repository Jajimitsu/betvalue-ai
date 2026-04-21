"use client";

import { useEffect, useMemo, useState } from "react";

type TeamItem = {
  id: number;
  name: string;
  league: string;
  position: number;
  goalsFor: number;
  goalsAgainst: number;
};

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("Cargando equipos...");
  const [teams, setTeams] = useState<TeamItem[]>([]);

  const [localText, setLocalText] = useState("");
  const [visitText, setVisitText] = useState("");

  const [localTeam, setLocalTeam] = useState<TeamItem | null>(null);
  const [visitTeam, setVisitTeam] = useState<TeamItem | null>(null);

  const [showLocal, setShowLocal] = useState(false);
  const [showVisit, setShowVisit] = useState(false);

  useEffect(() => {
    cargarEquipos();
  }, []);

  async function cargarEquipos() {
    const ligas = [
      "PD","SD","PL","SA","BL1","FL1",
      "CL","EL","ECL","PPL","DED",
      "ELC","TSL","BSA","ARG"
    ];

    let lista: TeamItem[] = [];

    for (const liga of ligas) {
      try {
        const res = await fetch(`/api/matches?league=${liga}`);
        const data = await res.json();

        if (!data.standings?.[0]?.table) continue;

        data.standings[0].table.forEach((t: any) => {
          lista.push({
            id: t.team.id,
            name: t.team.name,
            league: liga,
            position: t.position,
            goalsFor: t.goalsFor,
            goalsAgainst: t.goalsAgainst,
          });
        });
      } catch {}
    }

    setTeams(
      lista.filter(
        (team, index, self) =>
          index === self.findIndex((t) => t.name === team.name)
      )
    );

    setResult("");
  }

  function normalizarBusqueda(texto: string) {
    return texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/-/g, " ")
      .replace(/\./g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizarCuotas(texto: string) {
    return texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/fc/g, "")
      .replace(/cf/g, "")
      .replace(/rcd/g, "")
      .replace(/real/g, "")
      .replace(/club/g, "")
      .replace(/-/g, " ")
      .replace(/\./g, "")
      .replace(/\s+/g, "")
      .trim();
  }

  const localSug = useMemo(() => {
    const q = normalizarBusqueda(localText);
    if (!q) return [];

    return teams
      .filter((t) => normalizarBusqueda(t.name).includes(q))
      .slice(0, 8);
  }, [localText, teams]);

  const visitSug = useMemo(() => {
    const q = normalizarBusqueda(visitText);
    if (!q) return [];

    return teams
      .filter((t) => normalizarBusqueda(t.name).includes(q))
      .slice(0, 8);
  }, [visitText, teams]);

  /********************************************************************
   V16 MOTOR PROFESIONAL SOBRE TU BASE REAL
  ********************************************************************/
  async function analizar() {
    if (!localTeam || !visitTeam) {
      setResult("Selecciona ambos equipos.");
      return;
    }

    setLoading(true);
    setResult("Analizando...");

    /******************************************************************
     1. MODELO MEJORADO
    ******************************************************************/
    const posDiff =
      visitTeam.position - localTeam.position;

    const homePower =
      localTeam.goalsFor -
      localTeam.goalsAgainst;

    const awayPower =
      visitTeam.goalsFor -
      visitTeam.goalsAgainst;

    let probLocal =
      46 +
      posDiff * 1.8 +
      homePower * 0.15 -
      awayPower * 0.08 +
      7; // localía

    probLocal = clamp(probLocal, 18, 72);

    let probEmpate =
      24 - Math.abs(posDiff) * 0.5;

    probEmpate = clamp(probEmpate, 14, 30);

    let probVisit =
      100 - probLocal - probEmpate;

    if (probVisit < 10) probVisit = 10;

    const total =
      probLocal + probEmpate + probVisit;

    probLocal = (probLocal / total) * 100;
    probEmpate = (probEmpate / total) * 100;
    probVisit = 100 - probLocal - probEmpate;

    /******************************************************************
     2. CONFIDENCE SCORE
    ******************************************************************/
    let confidence =
      55 +
      Math.abs(posDiff) * 2 +
      Math.abs(homePower - awayPower) * 0.6;

    confidence = Math.round(
      clamp(confidence, 45, 92)
    );

    const confianzaTxt =
      confidence >= 75
        ? "Alta"
        : confidence >= 60
        ? "Media"
        : "Baja";

    let principal =
      "⚠️ Sin cuotas";
    let combinada =
      "No disponible";
    let cuota: any = "-";
    let riesgo = "Bajo";
    let evTxt = "-";
    let stake = "-";

    try {
      const resOdds = await fetch("/api/odds");
      const oddsData = await resOdds.json();

      const partido = oddsData.find((m: any) => {
        const home = normalizarCuotas(m.home_team);
        const away = normalizarCuotas(m.away_team);

        const local = normalizarCuotas(localTeam.name);
        const visit = normalizarCuotas(visitTeam.name);

        return (
          (home.includes(local) ||
            local.includes(home)) &&
          (away.includes(visit) ||
            visit.includes(away))
        );
      });

      if (partido) {
        const book =
          partido.bookmakers?.[0];

        const h2h =
          book?.markets?.find(
            (m: any) => m.key === "h2h"
          )?.outcomes || [];

        const cuotaLocal =
          h2h.find(
            (o: any) =>
              o.name === partido.home_team
          )?.price;

        const cuotaVisit =
          h2h.find(
            (o: any) =>
              o.name === partido.away_team
          )?.price;

        const cuotaDraw =
          h2h.find(
            (o: any) =>
              o.name === "Draw"
          )?.price;

        /**************************************************************
         V16 EV REAL
        **************************************************************/
        const evLocal =
          cuotaLocal
            ? (probLocal / 100) *
                cuotaLocal -
              1
            : -99;

        const evVisit =
          cuotaVisit
            ? (probVisit / 100) *
                cuotaVisit -
              1
            : -99;

        const evDraw =
          cuotaDraw
            ? (probEmpate / 100) *
                cuotaDraw -
              1
            : -99;

        const picks = [];

        // LOCAL
        if (
          cuotaLocal >= 1.55 &&
          cuotaLocal <= 4.5 &&
          probLocal >= 38 &&
          evLocal >= 0.04
        ) {
          picks.push({
            tipo: "🏠 Value local",
            pick:
              localTeam.name + " gana",
            cuota: cuotaLocal,
            ev: evLocal,
            riesgo: "Bajo-Medio",
          });
        }

        // VISITANTE
        if (
          cuotaVisit >= 1.8 &&
          cuotaVisit <= 5 &&
          probVisit >= 28 &&
          evVisit >= 0.05
        ) {
          picks.push({
            tipo:
              "✈️ Value visitante",
            pick:
              visitTeam.name + " gana",
            cuota: cuotaVisit,
            ev: evVisit,
            riesgo: "Medio",
          });
        }

        // EMPATE
        if (
          cuotaDraw >= 2.8 &&
          cuotaDraw <= 5 &&
          probEmpate >= 22 &&
          evDraw >= 0.06
        ) {
          picks.push({
            tipo: "🤝 Value empate",
            pick: "Empate",
            cuota: cuotaDraw,
            ev: evDraw,
            riesgo: "Alto",
          });
        }

        /**************************************************************
         SI NO HAY VALUE
        **************************************************************/
        if (picks.length === 0) {
          principal =
            "🚫 No apostar prepartido";

          combinada =
            "No hay valor real";

          cuota = "-";
          riesgo = "Bajo";
        } else {
          picks.sort(
            (a, b) => b.ev - a.ev
          );

          const mejor = picks[0];

          principal = mejor.tipo;
          combinada = mejor.pick;
          cuota = mejor.cuota;
          riesgo = mejor.riesgo;
          evTxt =
            "+" +
            (
              mejor.ev * 100
            ).toFixed(1) +
            "%";

          /************************************************************
           STAKE
          ************************************************************/
          if (
            mejor.ev >= 0.12 &&
            confidence >= 75
          ) {
            stake = "3/5";
          } else if (
            mejor.ev >= 0.08
          ) {
            stake = "2/5";
          } else {
            stake = "1/5";
          }
        }
      }
    } catch {
      principal =
        "⚠️ Error cuotas";
    }

    setResult(`
⚽ ${localTeam.name} vs ${visitTeam.name}

🏆 Liga: ${localTeam.league}

📊 Probabilidades IA:
🏠 ${probLocal.toFixed(1)}%
🤝 ${probEmpate.toFixed(1)}%
✈️ ${probVisit.toFixed(1)}%

🎯 Pick principal:
${principal}

🧠 Recomendación:
${combinada}

💰 Cuota:
${cuota}

📈 EV:
${evTxt}

🔥 Stake:
${stake}

🧠 Confianza:
${confianzaTxt} (${confidence}/100)

⚠️ Riesgo:
${riesgo}
    `);

    setLoading(false);
  }

  function clamp(
    value: number,
    min: number,
    max: number
  ) {
    return Math.max(
      min,
      Math.min(max, value)
    );
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

          <p className="text-gray-300 mt-2">
            V16 Professional Engine
          </p>
        </div>

        <div className="relative mb-4">
          <input
            value={localText}
            onChange={(e) => {
              setLocalText(e.target.value);
              setLocalTeam(null);
              setShowLocal(true);
            }}
            placeholder="Equipo local"
            className="w-full bg-white text-black px-5 py-4 rounded-2xl text-lg"
          />

          {showLocal &&
            localSug.length > 0 && (
              <div className="absolute z-20 w-full bg-white text-black rounded-xl mt-1 overflow-hidden shadow-xl">
                {localSug.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      setLocalTeam(t);
                      setLocalText(t.name);
                      setShowLocal(false);
                    }}
                    className="px-4 py-2 hover:bg-gray-200 cursor-pointer"
                  >
                    {t.name}
                  </div>
                ))}
              </div>
            )}
        </div>

        <div className="relative mb-4">
          <input
            value={visitText}
            onChange={(e) => {
              setVisitText(e.target.value);
              setVisitTeam(null);
              setShowVisit(true);
            }}
            placeholder="Equipo visitante"
            className="w-full bg-white text-black px-5 py-4 rounded-2xl text-lg"
          />

          {showVisit &&
            visitSug.length > 0 && (
              <div className="absolute z-20 w-full bg-white text-black rounded-xl mt-1 overflow-hidden shadow-xl">
                {visitSug.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      setVisitTeam(t);
                      setVisitText(t.name);
                      setShowVisit(false);
                    }}
                    className="px-4 py-2 hover:bg-gray-200 cursor-pointer"
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