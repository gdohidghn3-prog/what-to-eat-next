"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Search, Shuffle, X, Star, Clock, Trash2, Map,
  ChevronDown, ChevronUp, RotateCcw, Plus, Navigation, Phone,
  ExternalLink, Locate, SlidersHorizontal,
} from "lucide-react";

// ── 타입 ────────────────────────────────────────────────────

interface Restaurant {
  id: string;
  title: string;
  category: string;
  address: string;
  roadAddress: string;
  telephone: string;
  mapx: string;
  mapy: string;
  link: string;
  selected?: boolean;
  distance?: number;
}

interface PickRecord {
  restaurant: Restaurant;
  pickedAt: string;
  rating?: number;
  comment?: string;
}

interface SavedLocation {
  address: string;
  lat: number;
  lng: number;
  usedAt: string;
}

// ── localStorage 키 ─────────────────────────────────────────

const STORAGE = {
  RESTAURANTS: "wtf-restaurants",
  HISTORY: "wtf-history",
  LOCATIONS: "wtf-locations",
  EXCLUDED: "wtf-excluded",
  LAST_LOCATION: "wtf-last-location",
};

// ── 유틸 ────────────────────────────────────────────────────

function getNaverMapUrl(r: Restaurant): string {
  return `https://map.naver.com/v5/search/${encodeURIComponent(r.title + " " + (r.roadAddress || r.address))}`;
}

function getNaviUrl(r: Restaurant, myLat?: number, myLng?: number): string {
  if (myLat && myLng) {
    return `https://map.naver.com/v5/directions/${myLng},${myLat},내위치/${r.mapx ? "" : ""}${encodeURIComponent(r.title)}/-/walk`;
  }
  return `https://map.naver.com/v5/search/${encodeURIComponent(r.title)}`;
}

const CATEGORY_EMOJI: Record<string, string> = {
  "한식": "🍚", "중식": "🥟", "일식": "🍣", "양식": "🍝",
  "치킨": "🍗", "피자": "🍕", "카페": "☕", "분식": "🍢",
  "고기": "🥩", "육류": "🥩", "패스트푸드": "🍔", "햄버거": "🍔",
  "베이커리": "🥐", "해물": "🦐", "해산물": "🦐", "디저트": "🍰",
  "국밥": "🍲", "찌개": "🍲", "면": "🍜", "라멘": "🍜",
  "돈가스": "🍛", "초밥": "🍣", "회": "🐟", "샐러드": "🥗",
};

function getCategoryEmoji(cat: string): string {
  for (const [key, emoji] of Object.entries(CATEGORY_EMOJI)) {
    if (cat.includes(key)) return emoji;
  }
  return "🍽️";
}

function formatCategory(raw: string): string {
  const parts = raw.split(">");
  return parts.length >= 2 ? parts.slice(1).join("/").trim() : raw;
}

function getTopCategory(raw: string): string {
  const parts = raw.split(">");
  return parts.length >= 2 ? parts[1].trim() : (parts[0]?.trim() || "기타");
}

// ══════════════════════════════════════════════════════════════

export default function WhatToEatPage() {
  // ── 상태 ───────────────────────────────────────────────────

  const [myCoords, setMyCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationText, setLocationText] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [radius, setRadius] = useState(300);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Restaurant[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [history, setHistory] = useState<PickRecord[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<Restaurant | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // ── 초기 로드 ──────────────────────────────────────────────

  useEffect(() => {
    try {
      const r = localStorage.getItem(STORAGE.RESTAURANTS);
      if (r) setRestaurants(JSON.parse(r));
      const h = localStorage.getItem(STORAGE.HISTORY);
      if (h) setHistory(JSON.parse(h));
      const l = localStorage.getItem(STORAGE.LOCATIONS);
      if (l) setSavedLocations(JSON.parse(l));
      const e = localStorage.getItem(STORAGE.EXCLUDED);
      if (e) setExcluded(new Set(JSON.parse(e)));
      const ll = localStorage.getItem(STORAGE.LAST_LOCATION);
      if (ll) {
        const parsed = JSON.parse(ll);
        setLocationText(parsed.text || "");
        setLocationInput(parsed.text || "");
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => { if (hydrated) localStorage.setItem(STORAGE.RESTAURANTS, JSON.stringify(restaurants)); }, [restaurants, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem(STORAGE.HISTORY, JSON.stringify(history)); }, [history, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem(STORAGE.LOCATIONS, JSON.stringify(savedLocations)); }, [savedLocations, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem(STORAGE.EXCLUDED, JSON.stringify([...excluded])); }, [excluded, hydrated]);

  // ── GPS 현재 위치 ──────────────────────────────────────────

  const getCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setLocationText("위치 확인 중...");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setMyCoords({ lat, lng });
        const text = `현재 위치 (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
        setLocationText(text);
        setLocationInput(text);
        localStorage.setItem(STORAGE.LAST_LOCATION, JSON.stringify({ text }));
        // 위치 기록 저장
        const loc: SavedLocation = { address: text, lat, lng, usedAt: new Date().toISOString() };
        setSavedLocations((prev) => [loc, ...prev.filter((l) => l.address !== text)].slice(0, 10));
      },
      () => setLocationText("위치 가져오기 실패"),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  // ── 주변 동기화 ────────────────────────────────────────────

  const syncNearby = useCallback(async () => {
    const query = locationInput.trim();
    if (!query) return;
    setSearchLoading(true);
    setLocationText(query);
    localStorage.setItem(STORAGE.LAST_LOCATION, JSON.stringify({ text: query }));

    // 위치 기록 저장
    const loc: SavedLocation = { address: query, lat: 0, lng: 0, usedAt: new Date().toISOString() };
    setSavedLocations((prev) => [loc, ...prev.filter((l) => l.address !== query)].slice(0, 10));

    try {
      const queries = [`${query} 맛집`, `${query} 음식점`, `${query} 식당`, `${query} 카페`];
      const allItems: Restaurant[] = [];
      const seen = new Set<string>();

      for (const q of queries) {
        const res = await fetch(`/api/search?query=${encodeURIComponent(q)}`);
        const data = await res.json();
        for (const item of data.items || []) {
          const id = `${item.title}-${item.mapx}-${item.mapy}`;
          if (!seen.has(id)) {
            seen.add(id);
            allItems.push({ ...item, id, selected: true });
          }
        }
      }

      setRestaurants(allItems);
      setCategoryFilter(new Set());
    } catch {}
    setSearchLoading(false);
  }, [locationInput]);

  // ── 음식점 검색 ───────────────────────────────────────────

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const query = locationText
        ? `${locationText} ${searchQuery.trim()}`
        : searchQuery.trim();
      const res = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(
        (data.items || []).map((item: Restaurant) => ({
          ...item,
          id: `${item.title}-${item.mapx}-${item.mapy}`,
          selected: true,
        })),
      );
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery, locationText]);

  const addRestaurant = (r: Restaurant) => {
    if (restaurants.some((ex) => ex.id === r.id)) return;
    setRestaurants((prev) => [...prev, { ...r, selected: true }]);
  };

  const toggleSelect = (id: string) => {
    setRestaurants((prev) =>
      prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r)),
    );
  };

  const removeRestaurant = (id: string) => {
    setRestaurants((prev) => prev.filter((r) => r.id !== id));
  };

  const toggleExclude = (id: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setRestaurants((prev) => prev.map((r) => ({ ...r, selected: true })));
  const deselectAll = () => setRestaurants((prev) => prev.map((r) => ({ ...r, selected: false })));

  // ── 카테고리 ───────────────────────────────────────────────

  const categories = Array.from(
    new Set(restaurants.map((r) => getTopCategory(r.category))),
  ).sort();

  const toggleCategoryFilter = (cat: string) => {
    setCategoryFilter((prev) => {
      if (cat === "__all__") return new Set();
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const selectCategory = (cat: string) => {
    setRestaurants((prev) =>
      prev.map((r) =>
        getTopCategory(r.category) === cat && !excluded.has(r.id) ? { ...r, selected: true } : r,
      ),
    );
  };

  const deselectCategory = (cat: string) => {
    setRestaurants((prev) =>
      prev.map((r) =>
        getTopCategory(r.category) === cat ? { ...r, selected: false } : r,
      ),
    );
  };

  // ── 필터링된 목록 ─────────────────────────────────────────

  const filteredRestaurants = categoryFilter.size === 0
    ? restaurants
    : restaurants.filter((r) => categoryFilter.has(getTopCategory(r.category)));

  const pickable = filteredRestaurants.filter((r) => r.selected && !excluded.has(r.id));

  // ── 카테고리별 그룹화 ─────────────────────────────────────

  const grouped = filteredRestaurants.reduce<Record<string, Restaurant[]>>((acc, r) => {
    const cat = getTopCategory(r.category);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(r);
    return acc;
  }, {});

  const groupedKeys = Object.keys(grouped).sort((a, b) => grouped[b].length - grouped[a].length);

  // ── 랜덤 뽑기 ─────────────────────────────────────────────

  const doPick = () => {
    if (pickable.length < 2 || spinning) return;
    setSpinning(true);
    setResult(null);

    let count = 0;
    const interval = setInterval(() => {
      setResult(pickable[Math.floor(Math.random() * pickable.length)]);
      count++;
      if (count > 15) {
        clearInterval(interval);
        const final = pickable[Math.floor(Math.random() * pickable.length)];
        setResult(final);
        setSpinning(false);
        setHistory((prev) => [{
          restaurant: final,
          pickedAt: new Date().toISOString(),
        }, ...prev].slice(0, 50));
      }
    }, 100);
  };

  const saveReview = (index: number, rating: number, comment: string) => {
    setHistory((prev) =>
      prev.map((h, i) => (i === index ? { ...h, rating, comment } : h)),
    );
  };

  if (!hydrated) {
    return <div className="min-h-screen flex items-center justify-center"><span className="text-[#94A3B8]">불러오는 중...</span></div>;
  }

  return (
    <div className="max-w-lg mx-auto px-4 pb-8">
      {/* 헤더 */}
      <div className="pt-6 pb-4 text-center">
        <h1 className="text-2xl font-bold text-[#1A1A2E]"><span className="text-3xl">🍽️</span> 오늘 뭐 먹지?</h1>
        <p className="text-sm text-[#94A3B8] mt-1">점심 고민 끝! 랜덤으로 정하자</p>
      </div>

      {/* ── 위치 설정 ─────────────────────────────────────── */}
      <section className="bg-white border border-[#E2E8F0] rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <MapPin size={16} className="text-[#FF6B35]" />
          <span className="text-sm font-semibold text-[#1A1A2E]">위치 설정</span>
        </div>

        {/* GPS + 입력 */}
        <div className="flex gap-2 mb-2">
          <button
            onClick={getCurrentLocation}
            className="shrink-0 px-3 py-2.5 bg-[#EEF2FF] text-[#6366F1] text-sm font-medium rounded-xl hover:bg-[#E0E7FF] transition-colors flex items-center gap-1"
          >
            <Locate size={14} /> GPS
          </button>
          <input
            type="text"
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && syncNearby()}
            placeholder="동네 이름 (예: 호매실동, 역삼동)"
            className="flex-1 border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FF6B35]"
          />
          <button
            onClick={syncNearby}
            disabled={!locationInput.trim() || searchLoading}
            className="shrink-0 px-4 py-2.5 bg-[#FF6B35] text-white text-sm font-medium rounded-xl disabled:opacity-40"
          >
            {searchLoading ? "..." : "동기화"}
          </button>
        </div>

        {/* 반경 슬라이더 */}
        <div className="flex items-center gap-3 mb-2">
          <SlidersHorizontal size={14} className="text-[#94A3B8] shrink-0" />
          <input
            type="range"
            min={100} max={1000} step={50}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="flex-1 accent-[#FF6B35]"
          />
          <span className="text-xs font-medium text-[#FF6B35] w-12 text-right">
            {radius >= 1000 ? `${(radius / 1000).toFixed(1)}km` : `${radius}m`}
          </span>
        </div>

        {/* 현재 위치 표시 */}
        {locationText && (
          <p className="text-xs text-[#16A34A] mb-2">📍 {locationText}</p>
        )}

        {/* 최근 위치 칩 */}
        {savedLocations.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {savedLocations.slice(0, 5).map((loc, i) => (
              <button
                key={i}
                onClick={() => { setLocationInput(loc.address); setLocationText(loc.address); }}
                className="shrink-0 text-[11px] px-2.5 py-1 bg-[#F1F5F9] text-[#64748B] rounded-full hover:bg-[#E2E8F0] truncate max-w-[140px]"
              >
                {loc.address}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── 음식점 검색/추가 ──────────────────────────────── */}
      <section className="bg-white border border-[#E2E8F0] rounded-2xl p-4 mb-4">
        <button onClick={() => setShowSearch(!showSearch)} className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Search size={16} className="text-[#FF6B35]" />
            <span className="text-sm font-semibold text-[#1A1A2E]">음식점 검색/추가</span>
          </div>
          {showSearch ? <ChevronUp size={16} className="text-[#94A3B8]" /> : <ChevronDown size={16} className="text-[#94A3B8]" />}
        </button>

        <AnimatePresence>
          {showSearch && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="flex gap-2 mt-3">
                <input
                  type="text" value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="음식점 이름 검색"
                  className="flex-1 border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FF6B35]"
                />
                <button onClick={handleSearch} disabled={searchLoading} className="shrink-0 px-3 py-2.5 bg-[#FF6B35] text-white rounded-xl text-sm">검색</button>
              </div>
              {searchResults.length > 0 && (
                <div className="mt-3 space-y-1.5 max-h-60 overflow-y-auto">
                  {searchResults.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-2.5 bg-[#F8FAFC] rounded-lg">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-lg shrink-0">{getCategoryEmoji(r.category)}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#1A1A2E] truncate">{r.title}</p>
                          <p className="text-[11px] text-[#94A3B8] truncate">{formatCategory(r.category)}</p>
                        </div>
                      </div>
                      <button onClick={() => addRestaurant(r)} className="shrink-0 ml-2 px-2.5 py-1 bg-[#FF6B35] text-white text-xs rounded-lg"><Plus size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── 카테고리 필터 칩 ──────────────────────────────── */}
      {restaurants.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-3 mb-1">
          <button
            onClick={() => toggleCategoryFilter("__all__")}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              categoryFilter.size === 0 ? "bg-[#FF6B35] text-white" : "bg-white border border-[#E2E8F0] text-[#64748B]"
            }`}
          >
            🍽️ 전체 ({restaurants.length})
          </button>
          {categories.map((cat) => {
            const count = restaurants.filter((r) => getTopCategory(r.category) === cat).length;
            const isActive = categoryFilter.size === 0 || categoryFilter.has(cat);
            return (
              <button
                key={cat}
                onClick={() => toggleCategoryFilter(cat)}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                  isActive ? "bg-[#FF6B35] text-white" : "bg-white border border-[#E2E8F0] text-[#64748B]"
                }`}
              >
                {getCategoryEmoji(cat)} {cat} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* ── 음식점 목록 (카테고리별 그룹) ────────────────── */}
      <section className="bg-white border border-[#E2E8F0] rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-[#1A1A2E]">
            🏪 음식점 ({pickable.length}/{filteredRestaurants.length})
          </span>
          <div className="flex gap-2">
            <button onClick={selectAll} className="text-[11px] text-[#6366F1]">전체선택</button>
            <button onClick={deselectAll} className="text-[11px] text-[#94A3B8]">해제</button>
            {restaurants.length > 0 && (
              <button onClick={() => setRestaurants([])} className="text-[11px] text-[#EF4444]">삭제</button>
            )}
          </div>
        </div>

        {restaurants.length === 0 ? (
          <div className="text-center py-6 text-[#94A3B8]">
            <p className="text-3xl mb-2">🍳</p>
            <p className="text-sm">위치를 설정하고 동기화 버튼을 눌러주세요</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {groupedKeys.map((cat) => (
              <div key={cat}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-[#64748B]">
                    {getCategoryEmoji(cat)} {cat} ({grouped[cat].length})
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => selectCategory(cat)} className="text-[10px] text-[#6366F1]">선택</button>
                    <button onClick={() => deselectCategory(cat)} className="text-[10px] text-[#94A3B8]">해제</button>
                  </div>
                </div>
                <div className="space-y-1">
                  {grouped[cat].map((r) => (
                    <div
                      key={r.id}
                      className={`flex items-center gap-2 p-2.5 rounded-lg transition-colors cursor-pointer ${
                        excluded.has(r.id) ? "bg-[#FEF2F2] opacity-50"
                          : r.selected ? "bg-[#F0FDF4]" : "bg-[#F8FAFC]"
                      }`}
                      onClick={() => toggleSelect(r.id)}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                        r.selected && !excluded.has(r.id) ? "bg-[#FF6B35] border-[#FF6B35]" : "border-[#CBD5E1]"
                      }`}>
                        {r.selected && !excluded.has(r.id) && (
                          <svg width="10" height="10" viewBox="0 0 14 14" fill="none"><path d="M3 7L6 10L11 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        )}
                      </div>
                      <span className="text-lg shrink-0">{getCategoryEmoji(r.category)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1A1A2E] truncate">{r.title}</p>
                        <p className="text-[11px] text-[#94A3B8] truncate">{formatCategory(r.category)} {r.telephone && `· ${r.telephone}`}</p>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setDetailId(detailId === r.id ? null : r.id)} className="p-1 text-[#94A3B8] hover:text-[#6366F1]">
                          <ExternalLink size={13} />
                        </button>
                        <a href={getNaverMapUrl(r)} target="_blank" rel="noopener noreferrer" className="p-1 text-[#94A3B8] hover:text-[#16A34A]">
                          <Map size={13} />
                        </a>
                        <button onClick={() => toggleExclude(r.id)} className={`p-1 ${excluded.has(r.id) ? "text-[#EF4444]" : "text-[#94A3B8]"}`}>
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 상세 오버레이 ─────────────────────────────────── */}
      <AnimatePresence>
        {detailId && (() => {
          const r = restaurants.find((r) => r.id === detailId);
          if (!r) return null;
          return (
            <motion.div
              key="detail"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center"
              onClick={() => setDetailId(null)}
            >
              <motion.div
                initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }}
                className="w-full max-w-lg bg-white rounded-t-2xl p-5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-[#1A1A2E]">{getCategoryEmoji(r.category)} {r.title}</h3>
                    <p className="text-sm text-[#64748B]">{formatCategory(r.category)}</p>
                  </div>
                  <button onClick={() => setDetailId(null)} className="text-[#94A3B8]"><X size={20} /></button>
                </div>
                {r.roadAddress && <p className="text-sm text-[#374151] mb-1">📍 {r.roadAddress}</p>}
                {r.address && <p className="text-xs text-[#94A3B8] mb-1">{r.address}</p>}
                {r.telephone && (
                  <a href={`tel:${r.telephone}`} className="text-sm text-[#6366F1] mb-3 block">
                    📞 {r.telephone}
                  </a>
                )}
                <div className="flex gap-2 mt-3">
                  <a href={getNaverMapUrl(r)} target="_blank" rel="noopener noreferrer" className="flex-1 py-2.5 bg-[#16A34A] text-white text-sm font-medium rounded-xl text-center flex items-center justify-center gap-1">
                    <Map size={14} /> 네이버 지도
                  </a>
                  <a href={getNaviUrl(r)} target="_blank" rel="noopener noreferrer" className="flex-1 py-2.5 bg-[#2563EB] text-white text-sm font-medium rounded-xl text-center flex items-center justify-center gap-1">
                    <Navigation size={14} /> 길찾기
                  </a>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ── 뽑기 버튼 ────────────────────────────────────── */}
      <button
        onClick={doPick}
        disabled={pickable.length < 2 || spinning}
        className="w-full py-4 bg-gradient-to-r from-[#FF6B35] to-[#FF8C5A] text-white text-lg font-bold rounded-2xl disabled:opacity-40 shadow-lg mb-4"
      >
        {spinning ? "🎰 돌리는 중..." : pickable.length < 2 ? "2개 이상 선택해주세요" : (
          <><Shuffle size={20} className="inline mr-2" />랜덤 뽑기! ({pickable.length}개 중)</>
        )}
      </button>

      {/* ── 결과 ──────────────────────────────────────────── */}
      <AnimatePresence>
        {result && !spinning && (
          <motion.div initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.3, opacity: 0 }}
            className="bg-gradient-to-br from-[#FFF7ED] to-[#FEF3C7] border-2 border-[#FF6B35] rounded-2xl p-6 mb-4 text-center"
          >
            <p className="text-sm text-[#FF6B35] font-medium mb-2">🎉 오늘의 점심은!</p>
            <p className="text-4xl mb-2">{getCategoryEmoji(result.category)}</p>
            <h2 className="text-xl font-bold text-[#1A1A2E] mb-1">{result.title}</h2>
            <p className="text-sm text-[#64748B] mb-1">{formatCategory(result.category)}</p>
            {result.roadAddress && <p className="text-xs text-[#94A3B8] mb-1">{result.roadAddress}</p>}
            {result.telephone && <p className="text-xs text-[#94A3B8] mb-3">{result.telephone}</p>}
            <div className="flex gap-2 justify-center">
              <a href={getNaverMapUrl(result)} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-[#16A34A] text-white text-sm font-medium rounded-lg flex items-center gap-1"><Map size={14} /> 지도</a>
              <a href={getNaviUrl(result)} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-[#2563EB] text-white text-sm font-medium rounded-lg flex items-center gap-1"><Navigation size={14} /> 길찾기</a>
              <button onClick={doPick} className="px-4 py-2 bg-[#FF6B35] text-white text-sm font-medium rounded-lg flex items-center gap-1"><RotateCcw size={14} /> 다시</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 뽑기 기록 ────────────────────────────────────── */}
      <section className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
        <button onClick={() => setShowHistory(!showHistory)} className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-[#FF6B35]" />
            <span className="text-sm font-semibold text-[#1A1A2E]">뽑기 기록 ({history.length})</span>
          </div>
          {showHistory ? <ChevronUp size={16} className="text-[#94A3B8]" /> : <ChevronDown size={16} className="text-[#94A3B8]" />}
        </button>
        <AnimatePresence>
          {showHistory && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              {history.length === 0 ? (
                <p className="text-sm text-[#94A3B8] text-center py-4">아직 기록이 없습니다.</p>
              ) : (
                <div className="mt-3 space-y-2 max-h-80 overflow-y-auto">
                  {history.map((h, i) => (
                    <div key={i} className="flex items-center gap-2 p-3 bg-[#F8FAFC] rounded-lg">
                      <span className="text-lg">{getCategoryEmoji(h.restaurant.category)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1A1A2E] truncate">{h.restaurant.title}</p>
                        <p className="text-[11px] text-[#94A3B8]">
                          {new Date(h.pickedAt).toLocaleDateString("ko-KR")} {new Date(h.pickedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {h.rating && <p className="text-[11px] text-[#F59E0B]">{"★".repeat(h.rating)}{"☆".repeat(5 - h.rating)} {h.comment}</p>}
                      </div>
                      {!h.rating && <RatingButton onRate={(rating, comment) => saveReview(i, rating, comment)} />}
                    </div>
                  ))}
                  <button onClick={() => setHistory([])} className="w-full text-center text-xs text-[#94A3B8] hover:text-[#EF4444] py-2">기록 전체 삭제</button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}

// ── 별점 버튼 ────────────────────────────────────────────────

function RatingButton({ onRate }: { onRate: (r: number, c: string) => void }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="text-[11px] px-2 py-1 bg-[#FEF3C7] text-[#D97706] rounded-md">
        <Star size={10} className="inline" /> 평가
      </button>
      {open && (
        <div className="absolute right-0 top-8 bg-white border border-[#E2E8F0] rounded-xl p-3 shadow-lg z-10 w-48">
          <div className="flex gap-1 mb-2 justify-center">
            {[1, 2, 3, 4, 5].map((v) => (
              <button key={v} onClick={() => setRating(v)} className={`text-xl ${v <= rating ? "text-[#F59E0B]" : "text-[#E2E8F0]"}`}>★</button>
            ))}
          </div>
          <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="한줄평 (선택)" className="w-full border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-xs mb-2 outline-none" />
          <button onClick={() => { if (rating > 0) { onRate(rating, comment); setOpen(false); } }} disabled={rating === 0} className="w-full py-1.5 bg-[#FF6B35] text-white text-xs rounded-lg disabled:opacity-40">저장</button>
        </div>
      )}
    </div>
  );
}
