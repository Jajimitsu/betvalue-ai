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
  tipo: "single" | "doble";
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

  /**********************************************************
   CARGAR EQUIPOS
  **********************************************************/
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

  /**********************************************************
   HELPERS
  **********************************************************/
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
      .replace(/fc/g, "")
      .replace(/cf/g, "")
      .replace(/ud/g, "")
      .replace(/cd/g, "")
      .replace(/club/g, "")
      .replace(/real/g, "")
      .replace(/de/g, "")
      .replace(/\./g, "")
      .replace(/-/g, " ")
      .replace(/\s+/g, "")
      .trim();
  }

  function coincide(
    apiName: string,
    appName: string
  ) {
    const a = normalizar(apiName);
    const b = normalizar(appName);

    return (
      a.includes(b) ||
      b.includes(a)
    );
  }

  /**********************************************************
   AUTOCOMPLETE
  **********************************************************/
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

  /**********************************************************
   ANALIZAR
  **********************************************************/
  async function analizar() {
    if (!localTeam || !visitTeam) {
      setResult("Selecciona ambos equipos.");
      return;
    }

    setLoading(true);
    setResult("Buscando cuotas reales...");

    const posDiff =
      visitTeam.position -
      localTeam.position;

    const homePower =
      localTeam.goalsFor -
      localTeam.goalsAgainst;

    const awayPower =
      visitTeam.goalsFor -
      visitTeam.goalsAgainst;

    let probLocal =
      47 +
      posDiff * 1.5 +
      homePower * 0.12 -
      awayPower * 0.08 +
      7;

    probLocal = clamp(probLocal, 20, 72);

    let probEmpate =
      24 -
      Math.abs(posDiff) * 0.45;

    probEmpate = clamp(probEmpate, 14, 30);

    let probVisit =
      100 -
      probLocal -
      probEmpate;

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

    const goles =
      clamp(
        (
          (localTeam.goalsFor +
            visitTeam.goalsFor) /
            30 +
          1
        ),
        1.4,
        3.5
      );

    try {
      const res = await fetch("/api/odds");
      const data = await res.json();

      const partido = data.find((m: any) => {
        return (
          coincide(
            m.home_team,
            localTeam.name
          ) &&
          coincide(
            m.away_team,
            visitTeam.name
          )
        );
      });

      if (!partido) {
        setResult(`
⚽ ${localTeam.name} vs ${visitTeam.name}

❌ No encontré cuotas reales.
        `);

        setLoading(false);
        return;
      }

      const book =
        partido.bookmakers?.[0];

      const h2h =
        book?.markets?.find(
          (m: any) =>
            m.key === "h2h"
        )?.outcomes || [];

      const cuotaLocal =
        h2h.find((o: any) =>
          coincide(
            o.name,
            partido.home_team
          )
        )?.price;

      const cuotaVisit =
        h2h.find((o: any) =>
          coincide(
            o.name,
            partido.away_team
          )
        )?.price;

      const picks: Pick[] = [];

      /******************************************************
       LOCAL FAVORITO
      ******************************************************/
      if (
        cuotaLocal &&
        probLocal >= 55 &&
        cuotaLocal <= 2.30
      ) {
        picks.push({
          texto:
            localTeam.name +
            " gana",
          cuota:
            cuotaLocal,
          prob:
            probLocal /
            100,
          tipo:
            "single",
        });

        if (goles >= 2.1) {
          picks.push({
            texto:
              localTeam.name +
              " gana + Más de 1.5 goles",
            cuota:
              cuotaLocal *
              1.28 *
              0.84,
            prob:
              (probLocal /
                100) *
              0.74,
            tipo:
              "doble",
          });
        }
      }

      /******************************************************
       VISITANTE FAVORITO
      ******************************************************/
      if (
        cuotaVisit &&
        probVisit >= 55 &&
        cuotaVisit <= 2.40
      ) {
        picks.push({
          texto:
            visitTeam.name +
            " gana",
          cuota:
            cuotaVisit,
          prob:
            probVisit /
            100,
          tipo:
            "single",
        });

        if (goles >= 2.1) {
          picks.push({
            texto:
              visitTeam.name +
              " gana + Más de 1.5 goles",
            cuota:
              cuotaVisit *
              1.28 *
              0.84,
            prob:
              (probVisit /
                100) *
              0.74,
            tipo:
              "doble",
          });
        }
      }

      const buenas = picks
        .map((p) => ({
          ...p,
          ev:
            p.prob *
              p.cuota -
            1,
        }))
        .filter((p) => {
          if (
            p.tipo ===
            "single"
          ) {
            return (
              p.cuota >=
                1.45 &&
              p.cuota <=
                2.40 &&
              p.ev >=
                0.02
            );
          }

          return (
            p.cuota >=
              1.60 &&
            p.cuota <=
              2.75 &&
            p.ev >=
              0.015
          );
        });

      if (
        buenas.length === 0
      ) {
        setResult(`
⚽ ${localTeam.name} vs ${visitTeam.name}

🚫 No hay apuesta rentable real.

Mejor esperar live.
        `);

        setLoading(false);
        return;
      }

      buenas.sort(
        (a, b) =>
          b.ev -
          a.ev
      );

      const mejor =
        buenas[0];

      const stake =
        mejor.ev >= 0.08
          ? "3/5"
          : mejor.ev >=
            0.04
          ? "2/5"
          : "1/5";

      setResult(`
⚽ ${localTeam.name} vs ${visitTeam.name}

🔥 BETVALUE AI TOP PICK

🎯 ${mejor.texto}

📦 Tipo:
${mejor.tipo.toUpperCase()}

💰 Cuota:
${mejor.cuota.toFixed(
        2
      )}

📈 EV:
+${(
  mejor.ev * 100
).toFixed(1)}%

🔥 Stake:
${stake}

📊 Modelo:
🏠 ${probLocal.toFixed(
        1
      )}%
🤝 ${probEmpate.toFixed(
        1
      )}%
✈️ ${probVisit.toFixed(
        1
      )}%
      `);

      setLoading(false);
    } catch {
      setResult(
        "❌ Error cuotas."
      );
      setLoading(false);
    }
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
            V20.1 Match Fix
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
            localSug.length >
              0 && (
              <div className="absolute z-20 w-full bg-white text-black rounded-xl mt-1 overflow-hidden shadow-xl">
                {localSug.map(
                  (t) => (
                    <div
                      key={t.id}
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
              setVisitTeam(null);
              setShowVisit(true);
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
                      key={t.id}
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