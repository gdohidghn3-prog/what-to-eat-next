import { NextRequest, NextResponse } from "next/server";

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY ?? "";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const x = searchParams.get("x") || ""; // longitude
  const y = searchParams.get("y") || ""; // latitude
  const radius = searchParams.get("radius") || "300";

  if (!x || !y) {
    return NextResponse.json({ error: "x, y 필요", items: [] }, { status: 400 });
  }

  if (!KAKAO_KEY) {
    return NextResponse.json({ error: "카카오 API 키 미설정", items: [] }, { status: 500 });
  }

  const headers = { Authorization: `KakaoAK ${KAKAO_KEY}` };
  const allItems: Record<string, string>[] = [];
  const seen = new Set<string>();

  // FD6(음식점) + CE7(카페) 카테고리 검색
  for (const category of ["FD6", "CE7"]) {
    for (let page = 1; page <= 45; page++) {
      try {
        const params = new URLSearchParams({
          category_group_code: category,
          x, y,
          radius,
          sort: "distance",
          size: "15",
          page: String(page),
        });

        const res = await fetch(
          `https://dapi.kakao.com/v2/local/search/category.json?${params}`,
          { headers },
        );

        if (!res.ok) break;
        const data = await res.json();

        for (const doc of data.documents || []) {
          const pid = doc.id || "";
          if (!seen.has(pid)) {
            seen.add(pid);
            allItems.push(doc);
          }
        }

        if (data.meta?.is_end) break;
      } catch {
        break;
      }
    }
  }

  // 거리순 정렬
  allItems.sort((a, b) => Number(a.distance || 0) - Number(b.distance || 0));

  return NextResponse.json({ items: allItems });
}
