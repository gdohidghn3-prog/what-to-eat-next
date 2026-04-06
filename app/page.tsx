"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Search, Shuffle, X, Star, Clock, Trash2, Map,
  ChevronDown, ChevronUp, RotateCcw, Plus,
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
}

interface PickRecord {
  restaurant: Restaurant;
  pickedAt: string;
  rating?: number;
  comment?: string;
}

// ── localStorage 키 ─────────────────────────────────────────

const STORAGE = {
  RESTAURANTS: "wtf-restaurants",
  HISTORY: "wtf-history",
  LOCATION: "wtf-location",
  EXCLUDED: "wtf-excluded",
};

// ── 네이버 지도 URL ─────────────────────────────────────────

function getNaverMapUrl(r: Restaurant): string {
  return `https://map.naver.com/v5/search/${encodeURIComponent(r.title + " " + r.roadAddress)}`;
}

// ── 카테고리 이모지 ─────────────────────────────────────────

function getCategoryEmoji(cat: string): string {
  if (cat.includes("한식")) return "🍚";
  if (cat.includes("중식") || cat.includes("중국")) return "🥟";
  if (cat.includes("일식") || cat.includes("초밥")) return "🍣";
  if (cat.includes("양식") || cat.includes("이탈리")) return "🍝";
  if (cat.includes("치킨")) return "🍗";
  if (cat.includes("피자")) return "🍕";
  if (cat.includes("카페") || cat.includes("디저트")) return "☕";
  if (cat.includes("분식")) return "🍢";
  if (cat.includes("고기") || cat.includes("육")) return "🥩";
  if (cat.includes("패스트")) return "🍔";
  if (cat.includes("해물") || cat.includes("생선")) return "🐟";
  return "🍽️";
}

function formatCategory(raw: string): string {
  const parts = raw.split(">");
  return parts[parts.length - 1]?.trim() || raw;
}

// ══════════════════════════════════════════════════════════════

export default function WhatToEatPage() {
  // ── 상태 ───────────────────────────────────────────────────

  const [location, setLocation] = useState<string>("");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Restaurant[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [history, setHistory] = useState<PickRecord[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<Restaurant | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // ── 초기 로드 ──────────────────────────────────────────────

  useEffect(() => {
    try {
      const r = localStorage.getItem(STORAGE.RESTAURANTS);
      if (r) setRestaurants(JSON.parse(r));
      const h = localStorage.getItem(STORAGE.HISTORY);
      if (h) setHistory(JSON.parse(h));
      const l = localStorage.getItem(STORAGE.LOCATION);
      if (l) setLocation(l);
      const e = localStorage.getItem(STORAGE.EXCLUDED);
      if (e) setExcluded(new Set(JSON.parse(e)));
    } catch {}
    setHydrated(true);
  }, []);

  // ── 저장 ───────────────────────────────────────────────────

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE.RESTAURANTS, JSON.stringify(restaurants));
  }, [restaurants, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE.HISTORY, JSON.stringify(history));
  }, [history, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE.LOCATION, location);
  }, [location, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE.EXCLUDED, JSON.stringify([...excluded]));
  }, [excluded, hydrated]);

  // ── 검색 ───────────────────────────────────────────────────

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const query = location
        ? `${location} ${searchQuery.trim()}`
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
  }, [searchQuery, location]);

  // ── 주변 음식점 동기화 ────────────────────────────────────

  const syncNearby = useCallback(async () => {
    if (!location) return;
    setSearchLoading(true);
    try {
      const queries = [`${location} 맛집`, `${location} 음식점`, `${location} 식당`];
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
      setShowSearch(false);
    } catch {}
    setSearchLoading(false);
  }, [location]);

  // ── 음식점 추가 ───────────────────────────────────────────

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

  // ── 제외 ───────────────────────────────────────────────────

  const toggleExclude = (id: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── 뽑기 가능 목록 ────────────────────────────────────────

  const pickable = restaurants.filter(
    (r) => r.selected && !excluded.has(r.id),
  );

  // ── 랜덤 뽑기 ─────────────────────────────────────────────

  const doPick = () => {
    if (pickable.length < 2 || spinning) return;
    setSpinning(true);
    setResult(null);

    // 슬롯 머신 효과 (1.5초)
    let count = 0;
    const interval = setInterval(() => {
      const random = pickable[Math.floor(Math.random() * pickable.length)];
      setResult(random);
      count++;
      if (count > 15) {
        clearInterval(interval);
        const final = pickable[Math.floor(Math.random() * pickable.length)];
        setResult(final);
        setSpinning(false);

        // 기록 저장
        const record: PickRecord = {
          restaurant: final,
          pickedAt: new Date().toISOString(),
        };
        setHistory((prev) => [record, ...prev].slice(0, 50));
      }
    }, 100);
  };

  // ── 리뷰 저장 ─────────────────────────────────────────────

  const saveReview = (index: number, rating: number, comment: string) => {
    setHistory((prev) =>
      prev.map((h, i) => (i === index ? { ...h, rating, comment } : h)),
    );
  };

  // ── 렌더링 ────────────────────────────────────────────────

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-[#94A3B8]">불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 pb-8">
      {/* 헤더 */}
      <div className="pt-6 pb-4 text-center">
        <h1 className="text-2xl font-bold text-[#1A1A2E]">
          <span className="text-3xl">🍽️</span> 오늘 뭐 먹지?
        </h1>
        <p className="text-sm text-[#94A3B8] mt-1">점심 고민 끝! 랜덤으로 정하자</p>
      </div>

      {/* 위치 설정 */}
      <section className="bg-white border border-[#E2E8F0] rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <MapPin size={16} className="text-[#FF6B35]" />
          <span className="text-sm font-semibold text-[#1A1A2E]">위치 설정</span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="동네 이름 입력 (예: 호매실동)"
            className="flex-1 border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FF6B35]"
          />
          <button
            onClick={syncNearby}
            disabled={!location || searchLoading}
            className="shrink-0 px-4 py-2.5 bg-[#FF6B35] text-white text-sm font-medium rounded-xl disabled:opacity-40 hover:bg-[#E5612F] transition-colors"
          >
            {searchLoading ? "검색중..." : "동기화"}
          </button>
        </div>
      </section>

      {/* 음식점 검색/추가 */}
      <section className="bg-white border border-[#E2E8F0] rounded-2xl p-4 mb-4">
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-2">
            <Search size={16} className="text-[#FF6B35]" />
            <span className="text-sm font-semibold text-[#1A1A2E]">음식점 검색/추가</span>
          </div>
          {showSearch ? <ChevronUp size={16} className="text-[#94A3B8]" /> : <ChevronDown size={16} className="text-[#94A3B8]" />}
        </button>

        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="음식점 이름 검색"
                  className="flex-1 border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FF6B35]"
                />
                <button
                  onClick={handleSearch}
                  disabled={searchLoading}
                  className="shrink-0 px-3 py-2.5 bg-[#FF6B35] text-white rounded-xl text-sm"
                >
                  검색
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="mt-3 space-y-1.5 max-h-60 overflow-y-auto">
                  {searchResults.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between p-2.5 bg-[#F8FAFC] rounded-lg"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#1A1A2E] truncate">{r.title}</p>
                        <p className="text-[11px] text-[#94A3B8] truncate">{formatCategory(r.category)}</p>
                      </div>
                      <button
                        onClick={() => addRestaurant(r)}
                        className="shrink-0 ml-2 px-2.5 py-1 bg-[#FF6B35] text-white text-xs rounded-lg"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* 음식점 목록 */}
      <section className="bg-white border border-[#E2E8F0] rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-[#1A1A2E]">
            🏪 음식점 목록 ({pickable.length}/{restaurants.length})
          </span>
          {restaurants.length > 0 && (
            <button
              onClick={() => setRestaurants([])}
              className="text-[11px] text-[#94A3B8] hover:text-[#EF4444]"
            >
              전체삭제
            </button>
          )}
        </div>

        {restaurants.length === 0 ? (
          <div className="text-center py-6 text-[#94A3B8]">
            <p className="text-3xl mb-2">🍳</p>
            <p className="text-sm">위치를 설정하고 동기화 버튼을 눌러주세요</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {restaurants.map((r) => (
              <div
                key={r.id}
                className={`flex items-center gap-2 p-2.5 rounded-lg transition-colors ${
                  excluded.has(r.id)
                    ? "bg-[#FEF2F2] opacity-50"
                    : r.selected
                    ? "bg-[#F0FDF4]"
                    : "bg-[#F8FAFC]"
                }`}
              >
                <button
                  onClick={() => toggleSelect(r.id)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    r.selected && !excluded.has(r.id)
                      ? "bg-[#FF6B35] border-[#FF6B35]"
                      : "border-[#CBD5E1]"
                  }`}
                >
                  {r.selected && !excluded.has(r.id) && (
                    <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                      <path d="M3 7L6 10L11 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>

                <span className="text-lg shrink-0">{getCategoryEmoji(r.category)}</span>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1A1A2E] truncate">{r.title}</p>
                  <p className="text-[11px] text-[#94A3B8] truncate">{formatCategory(r.category)}</p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={getNaverMapUrl(r)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-[#94A3B8] hover:text-[#16A34A]"
                  >
                    <Map size={14} />
                  </a>
                  <button
                    onClick={() => toggleExclude(r.id)}
                    className={`p-1 ${excluded.has(r.id) ? "text-[#EF4444]" : "text-[#94A3B8] hover:text-[#EF4444]"}`}
                    title={excluded.has(r.id) ? "제외 해제" : "오늘 제외"}
                  >
                    <X size={14} />
                  </button>
                  <button
                    onClick={() => removeRestaurant(r.id)}
                    className="p-1 text-[#94A3B8] hover:text-[#EF4444]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 뽑기 버튼 */}
      <button
        onClick={doPick}
        disabled={pickable.length < 2 || spinning}
        className="w-full py-4 bg-gradient-to-r from-[#FF6B35] to-[#FF8C5A] text-white text-lg font-bold rounded-2xl disabled:opacity-40 hover:from-[#E5612F] hover:to-[#FF6B35] transition-all shadow-lg mb-4"
      >
        {spinning ? (
          "🎰 돌리는 중..."
        ) : pickable.length < 2 ? (
          "2개 이상 선택해주세요"
        ) : (
          <>
            <Shuffle size={20} className="inline mr-2" />
            랜덤 뽑기! ({pickable.length}개 중)
          </>
        )}
      </button>

      {/* 결과 */}
      <AnimatePresence>
        {result && !spinning && (
          <motion.div
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.3, opacity: 0 }}
            className="bg-gradient-to-br from-[#FFF7ED] to-[#FEF3C7] border-2 border-[#FF6B35] rounded-2xl p-6 mb-4 text-center"
          >
            <p className="text-sm text-[#FF6B35] font-medium mb-2">🎉 오늘의 점심은!</p>
            <p className="text-4xl mb-2">{getCategoryEmoji(result.category)}</p>
            <h2 className="text-xl font-bold text-[#1A1A2E] mb-1">{result.title}</h2>
            <p className="text-sm text-[#64748B] mb-3">{formatCategory(result.category)}</p>

            {result.roadAddress && (
              <p className="text-xs text-[#94A3B8] mb-1">{result.roadAddress}</p>
            )}
            {result.telephone && (
              <p className="text-xs text-[#94A3B8] mb-3">{result.telephone}</p>
            )}

            <div className="flex gap-2 justify-center">
              <a
                href={getNaverMapUrl(result)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-[#16A34A] text-white text-sm font-medium rounded-lg flex items-center gap-1"
              >
                <Map size={14} /> 네이버 지도
              </a>
              <button
                onClick={doPick}
                className="px-4 py-2 bg-[#FF6B35] text-white text-sm font-medium rounded-lg flex items-center gap-1"
              >
                <RotateCcw size={14} /> 다시 뽑기
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 기록 */}
      <section className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-[#FF6B35]" />
            <span className="text-sm font-semibold text-[#1A1A2E]">
              뽑기 기록 ({history.length})
            </span>
          </div>
          {showHistory ? <ChevronUp size={16} className="text-[#94A3B8]" /> : <ChevronDown size={16} className="text-[#94A3B8]" />}
        </button>

        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {history.length === 0 ? (
                <p className="text-sm text-[#94A3B8] text-center py-4">
                  아직 뽑기 기록이 없습니다.
                </p>
              ) : (
                <div className="mt-3 space-y-2 max-h-80 overflow-y-auto">
                  {history.map((h, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 p-3 bg-[#F8FAFC] rounded-lg"
                    >
                      <span className="text-lg">{getCategoryEmoji(h.restaurant.category)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1A1A2E] truncate">
                          {h.restaurant.title}
                        </p>
                        <p className="text-[11px] text-[#94A3B8]">
                          {new Date(h.pickedAt).toLocaleDateString("ko-KR")} {new Date(h.pickedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {h.rating && (
                          <p className="text-[11px] text-[#F59E0B]">
                            {"★".repeat(h.rating)}{"☆".repeat(5 - h.rating)}
                            {h.comment && ` ${h.comment}`}
                          </p>
                        )}
                      </div>
                      {!h.rating && (
                        <RatingButton onRate={(rating, comment) => saveReview(i, rating, comment)} />
                      )}
                    </div>
                  ))}

                  {history.length > 0 && (
                    <button
                      onClick={() => setHistory([])}
                      className="w-full text-center text-xs text-[#94A3B8] hover:text-[#EF4444] py-2"
                    >
                      기록 전체 삭제
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}

// ── 별점 버튼 컴포넌트 ──────────────────────────────────────

function RatingButton({ onRate }: { onRate: (rating: number, comment: string) => void }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-[11px] px-2 py-1 bg-[#FEF3C7] text-[#D97706] rounded-md"
      >
        <Star size={10} className="inline" /> 평가
      </button>
      {open && (
        <div className="absolute right-0 top-8 bg-white border border-[#E2E8F0] rounded-xl p-3 shadow-lg z-10 w-48">
          <div className="flex gap-1 mb-2 justify-center">
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                onClick={() => setRating(v)}
                className={`text-xl ${v <= rating ? "text-[#F59E0B]" : "text-[#E2E8F0]"}`}
              >
                ★
              </button>
            ))}
          </div>
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="한줄평 (선택)"
            className="w-full border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-xs mb-2 outline-none"
          />
          <button
            onClick={() => { if (rating > 0) { onRate(rating, comment); setOpen(false); } }}
            disabled={rating === 0}
            className="w-full py-1.5 bg-[#FF6B35] text-white text-xs rounded-lg disabled:opacity-40"
          >
            저장
          </button>
        </div>
      )}
    </div>
  );
}
