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
    const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5&sort=comment`;

    const res = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": CLIENT_ID,
        "X-Naver-Client-Secret": CLIENT_SECRET,
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `HTTP ${res.status}`, items: [] }, { status: 500 });
    }

    const data = await res.json();
    const items = (data.items || []).map((item: Record<string, string>) => ({
      ...item,
      title: item.title.replace(/<[^>]*>/g, ""),
    }));

    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ error: String(err), items: [] }, { status: 500 });
  }
}
