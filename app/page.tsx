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
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [localText, setLocalText] = useState("");
  const [visitText, setVisitText] = useState("");
  const [localTeam, setLocalTeam] = useState<TeamItem | null>(null);
  const [visitTeam, setVisitTeam] = useState<TeamItem | null>(null);
  const [showLocal, setShowLocal] = useState(false);
  const [showVisit, setShowVisit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("Cargando equipos...");

  useEffect(() => {
    cargarEquipos();
  }, []);

  async function cargarEquipos() {
    const ligas = [
      "PD","SD","PL","SA","BL1","FL1",
      "PPL","DED","ELC","TSL","BSA","ARG"
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
        index === self.findIndex((x) => x.name === team.name)
    );

    setTeams(unicos);
    setResult("");
  }

  /******************************************************
   NORMALIZADOR ULTRA PRO
  ******************************************************/
  function limpiar(texto: string) {
    return texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/fc/g, "")
      .replace(/cf/g, "")
      .replace(/ud/g, "")
      .replace(/cd/g, "")
      .replace(/rcd/g, "")
      .replace(/club/g, "")
      .replace(/de futbol/g, "")
      .replace(/football club/g, "")
      .replace(/futbol club/g, "")
      .replace(/sad/g, "")
      .replace(/-/g, " ")
      .replace(/\./g, "")
      .replace(/\s+/g, "")
      .trim();
  }

  function mismosEquipos(a: string, b: string) {
    const x = limpiar(a);
    const y = limpiar(b);

    if (x === y) return true;
    if (x.includes(y)) return true;
    if (y.includes(x)) return true;

    return false;
  }

  /******************************************************
   AUTOCOMPLETE
  ******************************************************/
  const localSug = useMemo(() => {
    const q = limpiar(localText);
    if (!q) return [];

    return teams
      .filter((t) => limpiar(t.name).includes(q))
      .slice(0, 8);
  }, [localText, teams]);

  const visitSug = useMemo(() => {
    const q = limpiar(visitText);
    if (!q) return [];

    return teams
      .filter((t) => limpiar(t.name).includes(q))
      .slice(0, 8);
  }, [visitText, teams]);

  /******************************************************
   ANALIZAR
  ******************************************************/
  async function analizar() {
    if (!localTeam || !visitTeam) {
      setResult("Selecciona ambos equipos.");
      return;
    }

    setLoading(true);
    setResult("Analizando...");

    /******************************************************
     MODELO IA
    ******************************************************/
    let probLocal = 45;
    let probEmpate = 24;
    let probVisit = 31;

    if (localTeam.position < visitTeam.position) {
      probLocal += 10;
      probVisit -= 10;
    } else if (visitTeam.position < localTeam.position) {
      probVisit += 10;
      probLocal -= 10;
    }

    probLocal += 6;

    const total = probLocal + probEmpate + probVisit;

    probLocal = (probLocal / total) * 100;
    probEmpate = (probEmpate / total) * 100;
    probVisit = 100 - probLocal - probEmpate;

    try {
      const res = await fetch("/api/odds");
      const odds = await res.json();

      const partido = odds.find((m: any) => {
        return (
          mismosEquipos(m.home_team, localTeam.name) &&
          mismosEquipos(m.away_team, visitTeam.name)
        );
      });

      /******************************************************
       SI HAY CUOTAS REALES
      ******************************************************/
      if (partido) {
        const book = partido.bookmakers?.[0];

        const h2h =
          book?.markets?.find(
            (m: any) => m.key === "h2h"
          )?.outcomes || [];

        const cuotaLocal =
          h2h.find((o: any) =>
            mismosEquipos(o.name, partido.home_team)
          )?.price;

        const cuotaVisit =
          h2h.find((o: any) =>
            mismosEquipos(o.name, partido.away_team)
          )?.price;

        const cuotaDraw =
          h2h.find((o: any) =>
            o.name.toLowerCase().includes("draw")
          )?.price;

        let pick = "No value real";
        let cuota = "-";
        let stake = "0/5";
        let fuente = "REAL";

        if (
          cuotaLocal &&
          cuotaLocal >= 1.45 &&
          cuotaLocal <= 2.60 &&
          probLocal >= 55
        ) {
          pick = `${localTeam.name} gana`;
          cuota = cuotaLocal.toFixed(2);
          stake = "2/5";
        }

        else if (
          cuotaVisit &&
          cuotaVisit >= 1.60 &&
          cuotaVisit <= 3.80 &&
          probVisit >= 52
        ) {
          pick = `${visitTeam.name} gana`;
          cuota = cuotaVisit.toFixed(2);
          stake = "2/5";
        }

        else if (
          cuotaDraw &&
          cuotaDraw >= 3 &&
          cuotaDraw <= 4 &&
          probEmpate >= 28
        ) {
          pick = `Empate`;
          cuota = cuotaDraw.toFixed(2);
          stake = "1/5";
        }

        else {
          /******************************************************
           FALLBACK IA SI NO HAY VALUE REAL
          ******************************************************/
          fuente = "IA";

          if (probLocal > probVisit) {
            pick = `${localTeam.name} empate no válido`;
            cuota = "1.45";
            stake = "1/5";
          } else {
            pick = `${visitTeam.name} empate no válido`;
            cuota = "1.60";
            stake = "1/5";
          }
        }

        setResult(`
⚽ ${localTeam.name} vs ${visitTeam.name}

🔥 BETVALUE AI PICK

🎯 ${pick}

💰 Cuota:
${cuota}

🔥 Stake:
${stake}

📡 Fuente:
${fuente}

📊 Modelo IA:
🏠 ${probLocal.toFixed(1)}%
🤝 ${probEmpate.toFixed(1)}%
✈️ ${probVisit.toFixed(1)}%
        `);

        setLoading(false);
        return;
      }

      /******************************************************
       SI NO EXISTE PARTIDO EN API
      ******************************************************/
      const favorito =
        probLocal >= probVisit
          ? localTeam.name
          : visitTeam.name;

      setResult(`
⚽ ${localTeam.name} vs ${visitTeam.name}

📡 No encontré cuotas oficiales.

🤖 Pick IA:

🎯 ${favorito} empate no válido

💰 Cuota estimada:
1.55

🔥 Stake:
1/5

📊 Modelo:
🏠 ${probLocal.toFixed(1)}%
🤝 ${probEmpate.toFixed(1)}%
✈️ ${probVisit.toFixed(1)}%
      `);

      setLoading(false);
    } catch {
      setResult("Error API.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-green-950 text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8">

        <div className="flex flex-col items-center mb-8">
          <img
            src="/logo.png"
            className="w-40 mb-4"
            alt="logo"
          />

          <h1 className="text-5xl font-bold text-green-400">
            BetValue AI
          </h1>

          <p className="text-gray-300 mt-2">
            V20.3 Full Match Fix
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
            className="w-full bg-white text-black px-5 py-4 rounded-2xl text-xl"
          />

          {showLocal && localSug.length > 0 && (
            <div className="absolute z-20 w-full bg-white text-black rounded-xl mt-1 overflow-hidden">
              {localSug.map((t) => (
                <div
                  key={t.id}
                  className="px-4 py-2 hover:bg-gray-200 cursor-pointer"
                  onClick={() => {
                    setLocalTeam(t);
                    setLocalText(t.name);
                    setShowLocal(false);
                  }}
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
            className="w-full bg-white text-black px-5 py-4 rounded-2xl text-xl"
          />

          {showVisit && visitSug.length > 0 && (
            <div className="absolute z-20 w-full bg-white text-black rounded-xl mt-1 overflow-hidden">
              {visitSug.map((t) => (
                <div
                  key={t.id}
                  className="px-4 py-2 hover:bg-gray-200 cursor-pointer"
                  onClick={() => {
                    setVisitTeam(t);
                    setVisitText(t.name);
                    setShowVisit(false);
                  }}
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
          className="w-full bg-green-500 hover:bg-green-600 py-4 rounded-2xl font-bold text-xl"
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