"use client";

/**********************************************************************
🔥 BETVALUE AI V17 CORNERS COMPLETO
VERSIÓN LISTA PARA PEGAR EN app/page.tsx

INCLUYE:
✅ Motor 1X2 actual
✅ Nueva pestaña CORNERS
✅ Predicción Over 8.5 / 9.5 / 10.5
✅ Equipo con más corners
✅ Modelo últimos 5 partidos SIMULADO con stats actuales
✅ UI premium mobile-first

NOTA IMPORTANTE:
Ahora mismo usamos estimación basada en GF/GC + posición.
Cuando conectemos API real de corners sustituimos solo el motor.

**********************************************************************/

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
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [result, setResult] = useState("Cargando equipos...");
  const [tab, setTab] = useState<"1x2" | "corners">("1x2");

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

  function normalizar(texto: string) {
    return texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\./g, "")
      .replace(/-/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function clamp(
    value: number,
    min: number,
    max: number
  ) {
    return Math.max(min, Math.min(max, value));
  }

  const localSug = useMemo(() => {
    const q = normalizar(localText);
    if (!q) return [];

    return teams
      .filter((t) =>
        normalizar(t.name).includes(q)
      )
      .slice(0, 8);
  }, [localText, teams]);

  const visitSug = useMemo(() => {
    const q = normalizar(visitText);
    if (!q) return [];

    return teams
      .filter((t) =>
        normalizar(t.name).includes(q)
      )
      .slice(0, 8);
  }, [visitText, teams]);

  /******************************************************************
   MOTOR CORNERS V17
   (estimación hasta conectar API real)
  ******************************************************************/
  function analizarCorners() {
    if (!localTeam || !visitTeam) {
      setResult("Selecciona ambos equipos.");
      return;
    }

    setLoading(true);

    const fuerzaLocal =
      localTeam.goalsFor -
      localTeam.goalsAgainst;

    const fuerzaVisit =
      visitTeam.goalsFor -
      visitTeam.goalsAgainst;

    const posDiff =
      visitTeam.position -
      localTeam.position;

    /**************************************************************
     Estimación corners últimos 5 partidos
    **************************************************************/
    let cornersLocal =
      4.8 +
      fuerzaLocal * 0.08 +
      posDiff * 0.06;

    let cornersVisit =
      4.1 +
      fuerzaVisit * 0.07 -
      posDiff * 0.04;

    cornersLocal = clamp(
      cornersLocal,
      3.2,
      8.5
    );

    cornersVisit = clamp(
      cornersVisit,
      2.8,
      7.2
    );

    const totalCorners =
      cornersLocal + cornersVisit;

    let pick = "Sin valor";
    let stake = "1/5";
    let confianza = "Media";

    if (totalCorners >= 10.8) {
      pick = "🔥 Over 10.5 corners";
      stake = "3/5";
      confianza = "Alta";
    } else if (totalCorners >= 9.8) {
      pick = "🔥 Over 9.5 corners";
      stake = "2/5";
      confianza = "Alta";
    } else if (totalCorners >= 8.9) {
      pick = "📈 Over 8.5 corners";
      stake = "1/5";
      confianza = "Media";
    } else if (
      cornersLocal - cornersVisit >= 1.4
    ) {
      pick =
        "🏠 " +
        localTeam.name +
        " más corners";
      stake = "2/5";
    } else if (
      cornersVisit - cornersLocal >= 1.4
    ) {
      pick =
        "✈️ " +
        visitTeam.name +
        " más corners";
      stake = "2/5";
    }

    setResult(`
⚽ ${localTeam.name} vs ${visitTeam.name}

📐 MODELO CORNERS V17

🏠 ${localTeam.name}: ${cornersLocal.toFixed(1)}
✈️ ${visitTeam.name}: ${cornersVisit.toFixed(1)}

📊 Total estimado:
${totalCorners.toFixed(1)} corners

🎯 Pick recomendado:
${pick}

🔥 Stake:
${stake}

🧠 Confianza:
${confianza}
    `);

    setLoading(false);
  }

  /******************************************************************
   MOTOR 1X2 SIMPLE (mantener actual)
  ******************************************************************/
  function analizar1x2() {
    if (!localTeam || !visitTeam) {
      setResult("Selecciona ambos equipos.");
      return;
    }

    setLoading(true);

    let probLocal = 48;
    let probEmpate = 24;
    let probVisit = 28;

    const posDiff =
      visitTeam.position -
      localTeam.position;

    probLocal += posDiff * 1.8;
    probVisit -= posDiff * 1.2;

    const total =
      probLocal +
      probEmpate +
      probVisit;

    probLocal =
      (probLocal / total) * 100;

    probEmpate =
      (probEmpate / total) * 100;

    probVisit =
      100 - probLocal - probEmpate;

    setResult(`
⚽ ${localTeam.name} vs ${visitTeam.name}

📊 Probabilidades IA

🏠 ${probLocal.toFixed(1)}%
🤝 ${probEmpate.toFixed(1)}%
✈️ ${probVisit.toFixed(1)}%

🎯 Pick:
${
  probLocal > probVisit
    ? localTeam.name + " gana"
    : visitTeam.name + " gana"
}
    `);

    setLoading(false);
  }

  function analizar() {
    if (tab === "corners") {
      analizarCorners();
    } else {
      analizar1x2();
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-green-950 text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8">

        <div className="text-center mb-8">
          <img
            src="/logo.png"
            className="w-40 mx-auto mb-4"
          />

          <h1 className="text-4xl font-bold text-green-400">
            BetValue AI
          </h1>

          <p className="text-gray-300 mt-2">
            V17 Corners Edition
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            onClick={() =>
              setTab("1x2")
            }
            className={`py-3 rounded-xl font-bold ${
              tab === "1x2"
                ? "bg-green-500"
                : "bg-white/10"
            }`}
          >
            1X2
          </button>

          <button
            onClick={() =>
              setTab("corners")
            }
            className={`py-3 rounded-xl font-bold ${
              tab === "corners"
                ? "bg-green-500"
                : "bg-white/10"
            }`}
          >
            Corners
          </button>
        </div>

        <div className="relative mb-4">
          <input
            value={localText}
            onChange={(e) => {
              setLocalText(
                e.target.value
              );
              setLocalTeam(null);
              setShowLocal(true);
            }}
            placeholder="Equipo local"
            className="w-full bg-white text-black px-5 py-4 rounded-2xl"
          />

          {showLocal &&
            localSug.length > 0 && (
              <div className="absolute z-20 bg-white text-black w-full rounded-xl mt-1 overflow-hidden">
                {localSug.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      setLocalTeam(t);
                      setLocalText(
                        t.name
                      );
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
              setVisitText(
                e.target.value
              );
              setVisitTeam(null);
              setShowVisit(true);
            }}
            placeholder="Equipo visitante"
            className="w-full bg-white text-black px-5 py-4 rounded-2xl"
          />

          {showVisit &&
            visitSug.length > 0 && (
              <div className="absolute z-20 bg-white text-black w-full rounded-xl mt-1 overflow-hidden">
                {visitSug.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      setVisitTeam(t);
                      setVisitText(
                        t.name
                      );
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