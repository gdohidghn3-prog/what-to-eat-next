import { NextRequest, NextResponse } from "next/server";

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY ?? "";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "";

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  if (!KAKAO_KEY) {
    return NextResponse.json({ error: "카카오 API 키 미설정", results: [] }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=10`,
      { headers: { Authorization: `KakaoAK ${KAKAO_KEY}` } },
    );

    if (!res.ok) {
      return NextResponse.json({ error: `HTTP ${res.status}`, results: [] }, { status: 500 });
    }

    const data = await res.json();
    const results = (data.documents || []).map((d: Record<string, string>) => ({
      place_name: d.place_name || "",
      address_name: d.address_name || "",
      road_address_name: d.road_address_name || "",
      x: d.x || "",
      y: d.y || "",
    }));

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ error: String(err), results: [] }, { status: 500 });
  }
}
