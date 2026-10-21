import { NextRequest, NextResponse } from "next/server";
import { publicCountyEvidence, publicCountySource } from "../../lib/public-county-evidence";
import { enforceEvidenceRateLimit } from "../../lib/evidence-rate-limit";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const geoid=request.nextUrl.searchParams.get("geoid")??"";
  if(!/^\d{5}$/.test(geoid)) return NextResponse.json({error:"Choose a valid county."},{status:400,headers:{"Cache-Control":"no-store"}});
  const county=publicCountyEvidence(geoid);
  if(!county) return NextResponse.json({error:"County evidence is not available for this identifier."},{status:404,headers:{"Cache-Control":"no-store"}});
  try {
    const rate=await enforceEvidenceRateLimit(request);
    if(!rate.allowed) return NextResponse.json({error:rate.retryAfter?"Please wait before requesting more evidence.":"County evidence is temporarily unavailable."},{status:rate.retryAfter?429:503,headers:{"Cache-Control":"no-store",...(rate.retryAfter?{"Retry-After":String(rate.retryAfter)}:{})}});
  } catch { return NextResponse.json({error:"County evidence is temporarily unavailable."},{status:503,headers:{"Cache-Control":"no-store"}}); }
  return NextResponse.json({county,source:publicCountySource},{headers:{"Cache-Control":"public, s-maxage=3600, stale-while-revalidate=86400"}});
}
