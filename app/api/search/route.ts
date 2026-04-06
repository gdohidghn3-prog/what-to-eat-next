import { NextRequest, NextResponse } from "next/server";

const CLIENT_ID = process.env.NAVER_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET ?? "";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "";

  if (!query) {
    return NextResponse.json({ items: [] });
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.json({ error: "API 키 미설정", items: [] }, { status: 500 });
  }

  try {
    // 페이지 1~3 병렬 호출 (최대 15개)
    const pages = [1, 6, 11];
    const fetches = pages.map((start) =>
      fetch(
        `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5&start=${start}&sort=comment`,
        {
          headers: {
            "X-Naver-Client-Id": CLIENT_ID,
            "X-Naver-Client-Secret": CLIENT_SECRET,
          },
        },
      ).then((r) => r.json()).catch(() => ({ items: [] })),
    );

    const results = await Promise.all(fetches);
    const seen = new Set<string>();
    const items: Record<string, string>[] = [];

    for (const data of results) {
      for (const item of data.items || []) {
        const key = `${item.title}-${item.mapx}-${item.mapy}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push({
            ...item,
            title: (item.title || "").replace(/<[^>]*>/g, ""),
          });
        }
      }
    }

    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ error: String(err), items: [] }, { status: 500 });
  }
}
