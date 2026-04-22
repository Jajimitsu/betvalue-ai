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

type Pick = {
  texto: string;
  cuota: number;
  prob: number;
  grupo: "resultado" | "goles" | "corners";
};

type Combo = {
  texto: string;
  cuota: number;
  ev: number;
  score: number;
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

    const unicos = lista.filter(
      (team, index, self) =>
        index === self.findIndex((t) => t.name === team.name)
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
    return Math.max(min, Math.min(max, value));
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

  function comboValida(
    picks: Pick[]
  ) {
    const grupos = new Set();

    for (const p of picks) {
      if (grupos.has(p.grupo))
        return false;

      grupos.add(p.grupo);
    }

    return true;
  }

  /************************************************************
   AUTOCOMPLETE
  ************************************************************/
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

  /************************************************************
   🔥 V18.2 PREMIUM ENGINE
  ************************************************************/
  async function analizar() {
    if (!localTeam || !visitTeam) {
      setResult("Selecciona ambos equipos.");
      return;
    }

    setLoading(true);
    setResult("Analizando...");

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
      posDiff * 1.7 +
      homePower * 0.13 -
      awayPower * 0.08 +
      7;

    probLocal = clamp(probLocal, 20, 72);

    let probEmpate =
      24 - Math.abs(posDiff) * 0.45;

    probEmpate = clamp(probEmpate, 14, 30);

    let probVisit =
      100 - probLocal - probEmpate;

    if (probVisit < 10)
      probVisit = 10;

    const total =
      probLocal +
      probEmpate +
      probVisit;

    probLocal =
      (probLocal / total) * 100;

    probEmpate =
      (probEmpate / total) * 100;

    probVisit =
      100 -
      probLocal -
      probEmpate;

    /**********************************************************
     GOLES Y CORNERS
    **********************************************************/
    const golesEsperados =
      clamp(
        (
          (localTeam.goalsFor +
            visitTeam.goalsFor) /
            30 +
          1.0
        ),
        1.2,
        3.4
      );

    const cornersEsperados =
      clamp(
        8.0 +
          homePower * 0.03 +
          awayPower * 0.02,
        6.3,
        11.4
      );

    /**********************************************************
     CONFIANZA
    **********************************************************/
    let confidence =
      58 +
      Math.abs(posDiff) * 2 +
      Math.abs(homePower - awayPower) * 0.4;

    confidence = Math.round(
      clamp(confidence, 50, 92)
    );

    const confianzaTxt =
      confidence >= 78
        ? "Alta"
        : confidence >= 64
        ? "Media"
        : "Baja";

    /**********************************************************
     PICKS BASE
    **********************************************************/
    const picks: Pick[] = [];

    // Resultado
    if (probLocal + probEmpate >= 72) {
      picks.push({
        texto: "1X",
        cuota: 1.28,
        prob:
          (probLocal + probEmpate) /
          100,
        grupo: "resultado",
      });
    }

    if (probVisit + probEmpate >= 72) {
      picks.push({
        texto: "X2",
        cuota: 1.36,
        prob:
          (probVisit + probEmpate) /
          100,
        grupo: "resultado",
      });
    }

    if (probVisit >= 54) {
      picks.push({
        texto:
          visitTeam.name +
          " gana",
        cuota: 1.72,
        prob:
          probVisit / 100,
        grupo: "resultado",
      });
    }

    // Goles
    if (golesEsperados >= 2.45) {
      picks.push({
        texto:
          "Más de 1.5 goles",
        cuota: 1.34,
        prob: 0.74,
        grupo: "goles",
      });
    } else if (
      golesEsperados >= 1.65
    ) {
      picks.push({
        texto:
          "Más de 0.5 goles",
        cuota: 1.18,
        prob: 0.88,
        grupo: "goles",
      });
    }

    // Corners
    if (
      cornersEsperados >= 9.2
    ) {
      picks.push({
        texto:
          "Más de 7.5 corners",
        cuota: 1.44,
        prob: 0.72,
        grupo: "corners",
      });
    } else if (
      cornersEsperados >= 7.5
    ) {
      picks.push({
        texto:
          "Más de 5.5 corners",
        cuota: 1.26,
        prob: 0.84,
        grupo: "corners",
      });
    }

    /**********************************************************
     GENERADOR PREMIUM
    **********************************************************/
    const combos: Combo[] = [];

    // Dobles
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

        if (!comboValida(arr))
          continue;

        const cuota =
          picks[i].cuota *
          picks[j].cuota;

        const prob =
          picks[i].prob *
          picks[j].prob;

        const ev =
          prob * cuota - 1;

        if (
          cuota >= 1.55 &&
          cuota <= 2.35 &&
          ev >= 0.03
        ) {
          combos.push({
            texto:
              picks[i].texto +
              " + " +
              picks[j].texto,
            cuota,
            ev,
            score:
              ev * 100 +
              cuota * 0.7,
          });
        }
      }
    }

    // Triples
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

          if (!comboValida(arr))
            continue;

          const cuota =
            picks[i].cuota *
            picks[j].cuota *
            picks[k].cuota;

          const prob =
            picks[i].prob *
            picks[j].prob *
            picks[k].prob;

          const ev =
            prob * cuota - 1;

          if (
            cuota >= 1.75 &&
            cuota <= 2.80 &&
            ev >= 0.04
          ) {
            combos.push({
              texto:
                picks[i].texto +
                " + " +
                picks[j].texto +
                " + " +
                picks[k].texto,
              cuota,
              ev,
              score:
                ev * 100 +
                cuota,
            });
          }
        }
      }
    }

    /**********************************************************
     RESULTADO FINAL
    **********************************************************/
    if (combos.length === 0) {
      setResult(`
⚽ ${localTeam.name} vs ${visitTeam.name}

🚫 No hay apuesta premium rentable.

Mejor esperar live.
      `);

      setLoading(false);
      return;
    }

    combos.sort(
      (a, b) => b.score - a.score
    );

    const mejor = combos[0];

    let stake = "1/5";

    if (
      mejor.ev >= 0.09 &&
      confidence >= 78
    ) {
      stake = "3/5";
    } else if (
      mejor.ev >= 0.05
    ) {
      stake = "2/5";
    }

    setResult(`
⚽ ${localTeam.name} vs ${visitTeam.name}

🔥 BETVALUE AI TOP PICK

🎯 ${mejor.texto}

💰 Cuota total:
${mejor.cuota.toFixed(2)}

📈 EV:
+${(
  mejor.ev * 100
).toFixed(1)}%

🔥 Stake:
${stake}

🧠 Confianza:
${confianzaTxt} (${confidence}/100)

📊 Datos IA:
🏠 ${probLocal.toFixed(1)}%
🤝 ${probEmpate.toFixed(1)}%
✈️ ${probVisit.toFixed(1)}%

⚽ Goles esperados:
${golesEsperados.toFixed(2)}

📐 Corners esperados:
${cornersEsperados.toFixed(1)}
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
            V18.2 Premium Filter
          </p>
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