export const config = { runtime: "edge" };

const ESPN = {
  NBA:   "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
  NHL:   "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard",
  NCAAB: "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard",
};

export default async function handler(req) {
  const url = new URL(req.url);
  const sport = url.searchParams.get("sport")?.toUpperCase();

  // No sport param → fetch all three and merge events
  const targets = sport && ESPN[sport] ? { [sport]: ESPN[sport] } : ESPN;

  const results = await Promise.all(
    Object.entries(targets).map(async ([key, espnUrl]) => {
      try {
        const res = await fetch(espnUrl, {
          headers: { "User-Agent": "EdgeIntel/1.0" },
        });
        const data = await res.json();
        return { sport: key, events: data.events ?? [] };
      } catch {
        return { sport: key, events: [] };
      }
    })
  );

  return new Response(JSON.stringify({ sports: results }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, s-maxage=25, stale-while-revalidate=60",
    },
  });
}
