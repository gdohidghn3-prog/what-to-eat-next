import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat, lng 필요" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ko`,
      { headers: { "User-Agent": "what-to-eat-app/1.0" } },
    );

    if (!res.ok) {
      return NextResponse.json({ error: `HTTP ${res.status}` }, { status: 500 });
    }

    const data = await res.json();
    const addr = data.address || {};

    // 동네 이름 조합: suburb(동) + city_district(구) + city(시)
    const parts = [
      addr.suburb || addr.neighbourhood || addr.quarter || "",
      addr.city_district || "",
      addr.city || addr.town || addr.county || "",
    ].filter(Boolean);

    const dongName = addr.suburb || addr.neighbourhood || addr.quarter || "";
    const district = addr.city_district || "";
    const city = addr.city || addr.town || addr.county || "";

    return NextResponse.json({
      address: parts.join(", "),
      dong: dongName,
      district,
      city,
      full: data.display_name || "",
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
