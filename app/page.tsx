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

type Grupo =
  | "resultado"
  | "goles"
  | "corners";

type Pick = {
  texto: string;
  cuota: number;
  prob: number;
  grupo: Grupo;
};

type Combo = {
  texto: string;
  cuotaReal: number;
  ev: number;
  score: number;
  tipo: "TRIPLE" | "DOBLE" | "SINGLE";
};

export default function Home() {
  const [loading, setLoading] =
    useState(false);

  const [result, setResult] =
    useState("Cargando equipos...");

  const [teams, setTeams] =
    useState<TeamItem[]>([]);

  const [localText, setLocalText] =
    useState("");

  const [visitText, setVisitText] =
    useState("");

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

  /************************************************************
   CARGAR EQUIPOS
  ************************************************************/
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

        const data =
          await res.json();

        if (
          !data.standings?.[0]?.table
        )
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
          (t) =>
            t.name === team.name
        )
    );

    setTeams(unicos);
    setResult("");
  }

  /************************************************************
   HELPERS
  ************************************************************/
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

  function normalizar(
    texto: string
  ) {
    return texto
      .toLowerCase()
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(/\./g, "")
      .replace(/-/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function comboValida(
    picks: Pick[]
  ) {
    const usados = new Set();

    for (const p of picks) {
      if (
        usados.has(p.grupo)
      )
        return false;

      usados.add(p.grupo);
    }

    return true;
  }

  function factorSameGame(
    picks: Pick[]
  ) {
    if (
      picks.length === 2
    )
      return 0.80;

    if (
      picks.length === 3
    )
      return 0.73;

    return 1;
  }

  /************************************************************
   AUTOCOMPLETE
  ************************************************************/
  const localSug = useMemo(() => {
    const q =
      normalizar(localText);

    if (!q) return [];

    return teams
      .filter((t) =>
        normalizar(
          t.name
        ).includes(q)
      )
      .slice(0, 8);
  }, [localText, teams]);

  const visitSug = useMemo(() => {
    const q =
      normalizar(visitText);

    if (!q) return [];

    return teams
      .filter((t) =>
        normalizar(
          t.name
        ).includes(q)
      )
      .slice(0, 8);
  }, [visitText, teams]);

  /************************************************************
   ANALIZAR
  ************************************************************/
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

    const posDiff =
      visitTeam.position -
      localTeam.position;

    const homePower =
      localTeam.goalsFor -
      localTeam.goalsAgainst;

    const awayPower =
      visitTeam.goalsFor -
      visitTeam.goalsAgainst;

    /**********************************************************
     PROBABILIDADES
    **********************************************************/
    let probLocal =
      47 +
      posDiff * 1.6 +
      homePower * 0.12 -
      awayPower * 0.08 +
      7;

    probLocal = clamp(
      probLocal,
      22,
      70
    );

    let probEmpate =
      24 -
      Math.abs(posDiff) *
        0.45;

    probEmpate = clamp(
      probEmpate,
      15,
      30
    );

    let probVisit =
      100 -
      probLocal -
      probEmpate;

    if (
      probVisit < 10
    )
      probVisit = 10;

    const total =
      probLocal +
      probEmpate +
      probVisit;

    probLocal =
      (probLocal /
        total) *
      100;

    probEmpate =
      (probEmpate /
        total) *
      100;

    probVisit =
      100 -
      probLocal -
      probEmpate;

    /**********************************************************
     GOLES Y CORNERS
    **********************************************************/
    const goles =
      clamp(
        (
          (localTeam.goalsFor +
            visitTeam.goalsFor) /
            32 +
          1
        ),
        1.3,
        3.2
      );

    const corners =
      clamp(
        8 +
          homePower *
            0.025 +
          awayPower *
            0.02,
        6.5,
        11
      );

    /**********************************************************
     PICKS BASE
    **********************************************************/
    const picks: Pick[] = [];

    // Resultado
    if (
      probLocal +
        probEmpate >=
      70
    ) {
      picks.push({
        texto: "1X",
        cuota: 1.28,
        prob:
          (probLocal +
            probEmpate) /
          100,
        grupo:
          "resultado",
      });
    }

    if (
      probVisit +
        probEmpate >=
      70
    ) {
      picks.push({
        texto: "X2",
        cuota: 1.34,
        prob:
          (probVisit +
            probEmpate) /
          100,
        grupo:
          "resultado",
      });
    }

    if (
      probLocal >= 55
    ) {
      picks.push({
        texto:
          localTeam.name +
          " gana",
        cuota: 1.72,
        prob:
          probLocal / 100,
        grupo:
          "resultado",
      });
    }

    if (
      probVisit >= 55
    ) {
      picks.push({
        texto:
          visitTeam.name +
          " gana",
        cuota: 1.78,
        prob:
          probVisit / 100,
        grupo:
          "resultado",
      });
    }

    // Goles
    if (goles >= 2.35) {
      picks.push({
        texto:
          "Más de 1.5 goles",
        cuota: 1.34,
        prob: 0.74,
        grupo: "goles",
      });
    } else {
      picks.push({
        texto:
          "Más de 0.5 goles",
        cuota: 1.18,
        prob: 0.87,
        grupo: "goles",
      });
    }

    // Corners
    if (
      corners >= 9
    ) {
      picks.push({
        texto:
          "Más de 7.5 corners",
        cuota: 1.44,
        prob: 0.72,
        grupo:
          "corners",
      });
    } else {
      picks.push({
        texto:
          "Más de 5.5 corners",
        cuota: 1.26,
        prob: 0.84,
        grupo:
          "corners",
      });
    }

    /**********************************************************
     GENERADOR
    **********************************************************/
    const combos: Combo[] = [];

    // singles
    for (const p of picks) {
      const ev =
        p.prob * p.cuota - 1;

      if (
        p.cuota >= 1.25 &&
        p.cuota <= 1.95 &&
        ev >= 0.01
      ) {
        combos.push({
          texto: p.texto,
          cuotaReal:
            p.cuota,
          ev,
          score:
            ev * 100 +
            p.cuota,
          tipo:
            "SINGLE",
        });
      }
    }

    // dobles
    for (
      let i = 0;
      i < picks.length;
      i++
    ) {
      for (
        let j = i + 1;
        j < picks.length;
        j++
      ) {
        const arr = [
          picks[i],
          picks[j],
        ];

        if (
          !comboValida(arr)
        )
          continue;

        const cuota =
          picks[i].cuota *
          picks[j].cuota *
          factorSameGame(
            arr
          );

        const prob =
          picks[i].prob *
          picks[j].prob;

        const ev =
          prob * cuota - 1;

        if (
          cuota >= 1.35 &&
          cuota <= 2.25 &&
          ev >= 0.01
        ) {
          combos.push({
            texto:
              picks[i].texto +
              " + " +
              picks[j].texto,
            cuotaReal:
              cuota,
            ev,
            score:
              ev * 100 +
              cuota +
              0.4,
            tipo:
              "DOBLE",
          });
        }
      }
    }

    // triples
    for (
      let i = 0;
      i < picks.length;
      i++
    ) {
      for (
        let j = i + 1;
        j < picks.length;
        j++
      ) {
        for (
          let k = j + 1;
          k < picks.length;
          k++
        ) {
          const arr = [
            picks[i],
            picks[j],
            picks[k],
          ];

          if (
            !comboValida(arr)
          )
            continue;

          const cuota =
            picks[i].cuota *
            picks[j].cuota *
            picks[k].cuota *
            factorSameGame(
              arr
            );

          const prob =
            picks[i].prob *
            picks[j].prob *
            picks[k].prob;

          const ev =
            prob * cuota - 1;

          if (
            cuota >= 1.65 &&
            cuota <= 2.65 &&
            ev >= 0.015
          ) {
            combos.push({
              texto:
                picks[i]
                  .texto +
                " + " +
                picks[j]
                  .texto +
                " + " +
                picks[k]
                  .texto,
              cuotaReal:
                cuota,
              ev,
              score:
                ev * 100 +
                cuota +
                0.8,
              tipo:
                "TRIPLE",
            });
          }
        }
      }
    }

    /**********************************************************
     RESULTADO
    **********************************************************/
    if (
      combos.length === 0
    ) {
      setResult(`
⚽ ${localTeam.name} vs ${visitTeam.name}

🚫 No hay apuesta premium.

Mejor esperar live.
      `);

      setLoading(false);
      return;
    }

    combos.sort(
      (a, b) =>
        b.score -
        a.score
    );

    const mejor =
      combos[0];

    let stake = "1/5";

    if (
      mejor.ev >= 0.07
    )
      stake = "3/5";
    else if (
      mejor.ev >= 0.03
    )
      stake = "2/5";

    setResult(`
⚽ ${localTeam.name} vs ${visitTeam.name}

🔥 BETVALUE AI TOP PICK

🎯 ${mejor.texto}

📦 Tipo:
${mejor.tipo}

💰 Cuota estimada:
${mejor.cuotaReal.toFixed(
  2
)}

📈 EV:
+${(
  mejor.ev * 100
).toFixed(1)}%

🔥 Stake:
${stake}

📊 Datos IA:
🏠 ${probLocal.toFixed(
      1
    )}%
🤝 ${probEmpate.toFixed(
      1
    )}%
✈️ ${probVisit.toFixed(
      1
    )}%

⚽ Goles:
${goles.toFixed(
      2
    )}

📐 Corners:
${corners.toFixed(
      1
    )}
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
            V18.4 Balanced Engine
          </p>
        </div>

        <div className="relative mb-4">
          <input
            value={
              localText
            }
            onChange={(
              e
            ) => {
              setLocalText(
                e.target
                  .value
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
                  (
                    t
                  ) => (
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
            value={
              visitText
            }
            onChange={(
              e
            ) => {
              setVisitText(
                e.target
                  .value
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
                  (
                    t
                  ) => (
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
          onClick={
            analizar
          }
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