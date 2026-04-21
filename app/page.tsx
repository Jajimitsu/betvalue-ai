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

    const extras = [
      "Real Zaragoza","Oviedo","Sporting Gijon",
      "Levante","Elche","Almeria",
      "Eibar","Mirandes","Racing Santander"
    ];

    extras.forEach((n, i) => {
      lista.push({
        id: 9000 + i,
        name: n,
        league: "SD",
        position: 10,
        goalsFor: 35,
        goalsAgainst: 35,
      });
    });

    const unicos = lista.filter(
      (team, index, self) =>
        index === self.findIndex((t) => t.name === team.name)
    );

    setTeams(unicos);
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
      .filter((t) =>
        normalizarBusqueda(t.name).includes(q)
      )
      .slice(0, 8);
  }, [localText, teams]);

  const visitSug = useMemo(() => {
    const q = normalizarBusqueda(visitText);
    if (!q) return [];

    return teams
      .filter((t) =>
        normalizarBusqueda(t.name).includes(q)
      )
      .slice(0, 8);
  }, [visitText, teams]);

  async function analizar() {
    if (!localTeam || !visitTeam) {
      setResult("Selecciona ambos equipos.");
      return;
    }

    setLoading(true);
    setResult("Analizando...");

    let probLocal = 44;
    let probEmpate = 25;
    let probVisit = 31;

    if (localTeam.position < visitTeam.position) {
      probLocal += 8;
      probVisit -= 8;
    } else if (visitTeam.position < localTeam.position) {
      probVisit += 8;
      probLocal -= 8;
    }

    probLocal += 6;

    const total = probLocal + probEmpate + probVisit;

    probLocal = Math.round((probLocal / total) * 100);
    probEmpate = Math.round((probEmpate / total) * 100);
    probVisit = 100 - probLocal - probEmpate;

    let principal = "⚠️ Sin cuotas";
    let combinada = "No disponible";
    let cuota = "-";
    let riesgo = "Bajo";

    try {
      const resOdds = await fetch("/api/odds");
      const oddsData = await resOdds.json();

      const partido = oddsData.find((m: any) => {
        const home = normalizarCuotas(m.home_team);
        const away = normalizarCuotas(m.away_team);

        const local = normalizarCuotas(localTeam.name);
        const visit = normalizarCuotas(visitTeam.name);

        return (
          (home.includes(local) || local.includes(home)) &&
          (away.includes(visit) || visit.includes(away))
        );
      });

      if (partido) {
        const book = partido.bookmakers?.[0];

        const h2h =
          book?.markets?.find(
            (m: any) => m.key === "h2h"
          )?.outcomes || [];

        const totals =
          book?.markets?.find(
            (m: any) => m.key === "totals"
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

        const cuotaOver =
          totals.find(
            (o: any) =>
              o.name === "Over"
          )?.price;

        const valorLocal =
          cuotaLocal
            ? probLocal / 100 -
              1 / cuotaLocal
            : -1;

        const valorVisit =
          cuotaVisit
            ? probVisit / 100 -
              1 / cuotaVisit
            : -1;

        const valorDraw =
          cuotaDraw
            ? probEmpate / 100 -
              1 / cuotaDraw
            : -1;

        if (
          valorLocal >= 0.03 &&
          cuotaLocal
        ) {
          principal = "🏠 Value local";
          combinada =
            `${localTeam.name} gana`;
          cuota = cuotaLocal;
          riesgo = "Bajo-Medio";

          if (
            cuotaOver &&
            cuotaLocal < 1.45
          ) {
            principal =
              "🧠 Mejor combinada local";

            combinada =
              `${localTeam.name} gana + Over goles`;

            cuota = (
              cuotaLocal *
              cuotaOver
            ).toFixed(2);
          }
        }

        else if (
          valorVisit >= 0.03 &&
          cuotaVisit
        ) {
          principal =
            "✈️ Value visitante";

          combinada =
            `${visitTeam.name} gana`;

          cuota = cuotaVisit;
          riesgo = "Medio";

          if (cuotaOver) {
            principal =
              "🧠 Mejor combinada visitante";

            combinada =
              `${visitTeam.name} gana + Over goles`;

            cuota = (
              cuotaVisit *
              cuotaOver
            ).toFixed(2);
          }
        }

        else if (
          valorDraw >= 0.04 &&
          cuotaDraw
        ) {
          principal =
            "🤝 Value empate";

          combinada = "Empate";
          cuota = cuotaDraw;
          riesgo = "Alto";
        }

        else {
          principal =
            "⚠️ Sin value real";

          combinada =
            "No apostar prepartido";

          cuota = "-";
          riesgo = "Bajo";
        }
      }
    } catch {
      principal = "⚠️ Error cuotas";
    }

    setResult(`
⚽ ${localTeam.name} vs ${visitTeam.name}

🏆 Liga: ${localTeam.league}

📊 Probabilidades modelo:
🏠 ${probLocal}%
🤝 ${probEmpate}%
✈️ ${probVisit}%

🎯 Pick principal:
${principal}

🧠 Recomendación:
${combinada}

💰 Cuota:
${cuota}

⚠️ Riesgo:
${riesgo}
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

          <p className="text-gray-300 mt-2">
            V14 Value Real
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

          {showLocal && localSug.length > 0 && (
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

          {showVisit && visitSug.length > 0 && (
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