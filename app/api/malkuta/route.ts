export const dynamic = "force-dynamic";

const MALKUTA_FEED = "https://kingdomwithin.thehouseofjoshi.com/api/epoch?scope=all";

export async function GET() {
  try {
    const response = await fetch(MALKUTA_FEED, { headers:{ accept:"application/json" } });
    if (!response.ok) throw new Error(`Malkuta feed returned ${response.status}`);
    return Response.json(await response.json(), {
      headers:{ "Cache-Control":"public, max-age=30, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    return Response.json({ status:"unavailable", error:error instanceof Error?error.message:"Malkuta feed unavailable" }, { status:502 });
  }
}
