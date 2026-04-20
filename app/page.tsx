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

  const [localTeam, setLocalTeam] =
    useState<TeamItem | null>(null);

  const [visitTeam, setVisitTeam] =
    useState<TeamItem | null>(null);

  const [showLocal, setShowLocal] =
    useState(false);

  const [showVisit, setShowVisit] =
    useState(false);

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
        const res = await fetch(
          `/api/matches?league=${liga}`
        );

        const data = await res.json();

        if (!data.standings?.[0]?.table)
          continue;

        data.standings[0].table.forEach(
          (t: any) => {
            lista.push({
              id: t.team.id,
              name: t.team.name,
              league: liga,
              position: t.position,
              goalsFor: t.goalsFor,
              goalsAgainst:
                t.goalsAgainst,
            });
          }
        );
      } catch {}
    }

    const unicos = lista.filter(
      (team, index, self) =>
        index ===
        self.findIndex(
          (t) => t.id === team.id
        )
    );

    setTeams(unicos);
    setResult("");
  }

  function normalizar(texto: string) {
    return texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/fc/g, "")
      .replace(/cf/g, "")
      .replace(/-/g, " ")
      .replace(/\./g, "")
      .replace(/\s+/g, "")
      .trim();
  }

  const localSug = useMemo(() => {
    if (localText.length < 2) return [];

    const q = normalizar(localText);

    return teams
      .filter((t) =>
        normalizar(t.name).includes(q)
      )
      .slice(0, 8);
  }, [localText, teams]);

  const visitSug = useMemo(() => {
    if (visitText.length < 2) return [];

    const q = normalizar(visitText);

    return teams
      .filter((t) =>
        normalizar(t.name).includes(q)
      )
      .slice(0, 8);
  }, [visitText, teams]);

  async function obtenerForma(
    teamId: number
  ) {
    try {
      const res = await fetch(
        `/api/form?team=${teamId}`
      );

      const data =
        await res.json();

      if (!data.matches)
        return "Sin datos";

      return data.matches
        .map((m: any) => {
          const esLocal =
            m.homeTeam.id ===
            teamId;

          const gf = esLocal
            ? m.score.fullTime.home
            : m.score.fullTime.away;

          const gc = esLocal
            ? m.score.fullTime.away
            : m.score.fullTime.home;

          if (gf > gc)
            return "V";

          if (gf < gc)
            return "D";

          return "E";
        })
        .join(" ");
    } catch {
      return "Sin datos";
    }
  }

  async function buscarCuotas(
    local: string,
    visit: string
  ) {
    try {
      const res = await fetch(
        "/api/odds"
      );

      const data =
        await res.json();

      const partido =
        data.find((m: any) => {
          const home =
            normalizar(
              m.home_team
            );

          const away =
            normalizar(
              m.away_team
            );

          return (
            home.includes(
              normalizar(
                local
              )
            ) &&
            away.includes(
              normalizar(
                visit
              )
            )
          );
        });

      if (!partido)
        return null;

      const outs =
        partido
          .bookmakers?.[0]
          ?.markets?.[0]
          ?.outcomes || [];

      return {
        local: outs.find(
          (o: any) =>
            o.name ===
            partido.home_team
        )?.price,

        empate: outs.find(
          (o: any) =>
            o.name ===
            "Draw"
        )?.price,

        visit: outs.find(
          (o: any) =>
            o.name ===
            partido.away_team
        )?.price,
      };
    } catch {
      return null;
    }
  }

  function contar(
    forma: string,
    letra: string
  ) {
    return (
      forma.match(
        new RegExp(
          letra,
          "g"
        )
      ) || []
    ).length;
  }

  async function analizar() {
    if (
      !localTeam ||
      !visitTeam
    ) {
      setResult(
        "Selecciona ambos equipos."
      );
      return;
    }

    setLoading(true);
    setResult(
      "Analizando..."
    );

    const formaLocal =
      await obtenerForma(
        localTeam.id
      );

    const formaVisit =
      await obtenerForma(
        visitTeam.id
      );

    const formaPtsLocal =
      contar(
        formaLocal,
        "V"
      ) *
        3 +
      contar(
        formaLocal,
        "E"
      );

    const formaPtsVisit =
      contar(
        formaVisit,
        "V"
      ) *
        3 +
      contar(
        formaVisit,
        "E"
      );

    let probLocal = 40;
    let probEmpate = 28;
    let probVisit = 32;

    if (
      localTeam.position <
      visitTeam.position
    ) {
      probLocal += 6;
      probVisit -= 6;
    } else {
      probVisit += 6;
      probLocal -= 6;
    }

    probLocal += 6;

    probLocal += Math.round(
      formaPtsLocal / 3
    );

    probVisit += Math.round(
      formaPtsVisit / 3
    );

    if (
      localTeam.goalsFor >
      visitTeam.goalsFor
    )
      probLocal += 4;
    else probVisit += 4;

    if (
      localTeam.goalsAgainst <
      visitTeam.goalsAgainst
    )
      probLocal += 4;
    else probVisit += 4;

    const total =
      probLocal +
      probEmpate +
      probVisit;

    probLocal = Math.round(
      (probLocal /
        total) *
        100
    );

    probEmpate =
      Math.round(
        (probEmpate /
          total) *
          100
      );

    probVisit =
      100 -
      probLocal -
      probEmpate;

    const cuotas =
      await buscarCuotas(
        localTeam.name,
        visitTeam.name
      );

    let recomendacion =
      "⚠️ Sin valor claro";

    let detalle =
      "Mejor pasar partido";

    if (cuotas) {
      const valorLocal =
        cuotas.local
          ? probLocal /
            100 *
            cuotas.local
          : 0;

      const valorEmp =
        cuotas.empate
          ? probEmpate /
            100 *
            cuotas.empate
          : 0;

      const valorVisit =
        cuotas.visit
          ? probVisit /
            100 *
            cuotas.visit
          : 0;

      const mejor =
        Math.max(
          valorLocal,
          valorEmp,
          valorVisit
        );

      if (
        mejor > 1.05
      ) {
        if (
          mejor ===
          valorLocal
        ) {
          recomendacion =
            "🏠 Victoria local";
          detalle = `Cuota ${cuotas.local}`;
        } else if (
          mejor ===
          valorVisit
        ) {
          recomendacion =
            "✈️ Victoria visitante";
          detalle = `Cuota ${cuotas.visit}`;
        } else {
          recomendacion =
            "🤝 Empate";
          detalle = `Cuota ${cuotas.empate}`;
        }
      }
    }

    setResult(`
⚽ ${localTeam.name} vs ${visitTeam.name}

🏆 Liga:
${localTeam.league}

📈 Forma:
${localTeam.name}: ${formaLocal}
${visitTeam.name}: ${formaVisit}

📊 Probabilidades modelo:
🏠 ${probLocal}%
🤝 ${probEmpate}%
✈️ ${probVisit}%

🎯 Value Bet:
${recomendacion}

💰 ${detalle}
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
            Value Real V6
          </p>
        </div>

        <div className="relative mb-4">
          <input
            value={localText}
            onChange={(e) => {
              setLocalText(
                e.target.value
              );
              setLocalTeam(
                null
              );
              setShowLocal(
                true
              );
            }}
            placeholder="Equipo local"
            className="w-full bg-white text-black px-5 py-4 rounded-2xl text-lg"
          />

          {showLocal &&
            localSug.length >
              0 && (
              <div className="absolute z-20 w-full bg-white text-black rounded-xl mt-1 overflow-hidden shadow-xl">
                {localSug.map(
                  (t) => (
                    <div
                      key={
                        t.id
                      }
                      onClick={() => {
                        setLocalTeam(
                          t
                        );
                        setLocalText(
                          t.name
                        );
                        setShowLocal(
                          false
                        );
                      }}
                      className="px-4 py-2 hover:bg-gray-200 cursor-pointer"
                    >
                      {t.name}
                    </div>
                  )
                )}
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
              setVisitTeam(
                null
              );
              setShowVisit(
                true
              );
            }}
            placeholder="Equipo visitante"
            className="w-full bg-white text-black px-5 py-4 rounded-2xl text-lg"
          />

          {showVisit &&
            visitSug.length >
              0 && (
              <div className="absolute z-20 w-full bg-white text-black rounded-xl mt-1 overflow-hidden shadow-xl">
                {visitSug.map(
                  (t) => (
                    <div
                      key={
                        t.id
                      }
                      onClick={() => {
                        setVisitTeam(
                          t
                        );
                        setVisitText(
                          t.name
                        );
                        setShowVisit(
                          false
                        );
                      }}
                      className="px-4 py-2 hover:bg-gray-200 cursor-pointer"
                    >
                      {t.name}
                    </div>
                  )
                )}
              </div>
            )}
        </div>

        <button
          onClick={analizar}
          disabled={
            loading
          }
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