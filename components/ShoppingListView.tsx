import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PlannerData, Recipe, ShoppingList } from '../types';

interface ShoppingListViewProps {
  shoppingList: ShoppingList | null;
  planner: PlannerData;
  recipes: Recipe[];

  onGenerate: () => void;
  onToggleItem: (itemId: string) => void;
  onResetChecks: () => void;
  onClear: () => void;
}

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

type ViewMode = 'totals' | 'by_recipe';

type Aisle =
  | 'Produce'
  | 'Dairy'
  | 'Meat'
  | 'Seafood'
  | 'Dry'
  | 'Spices'
  | 'Frozen'
  | 'Bakery'
  | 'Beverages'
  | 'Other';

const AISLES: Aisle[] = ['Produce', 'Dairy', 'Meat', 'Seafood', 'Dry', 'Spices', 'Frozen', 'Bakery', 'Beverages', 'Other'];

const LS_AISLE_OVERRIDES = 'tokchef_aisle_overrides_v1';
const LS_PANTRY = 'tokchef_pantry_v1';

// v1.4 legacy store (unit-specific)
const LS_PRICES_V1 = 'tokchef_prices_v1';

// v1.5 normalized store (base unit: kg/l/pcs)
const LS_PRICES_V2 = 'tokchef_prices_v2';

// Route A: persist UI prefs
const LS_UI_PREFS = 'toktotable_ui_prefs_v1';

type BaseUnit = 'kg' | 'l' | 'pcs';

type NormalizedPriceEntry = {
  ingredientKey: string;
  baseUnit: BaseUnit; // kg/l/pcs
  pricePerBaseUnit: number; // € per kg / l / pcs
  updatedAt: number;
};

type NormalizedPriceMap = Record<string, NormalizedPriceEntry>; // key = `${ingredientKey}::${baseUnit}`

// Legacy (for migration)
type LegacyPriceEntry = {
  ingredientKey: string;
  unit: string;
  pricePerUnit: number;
  updatedAt: number;
};
type LegacyPriceMap = Record<string, LegacyPriceEntry>;

const formatQty = (qty: number) => {
  if (!Number.isFinite(qty)) return '';
  const rounded = Math.round(qty * 100) / 100;
  return String(rounded).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
};

const formatMoney = (value: number) => {
  if (!Number.isFinite(value)) return '—';
  const rounded = Math.round(value * 100) / 100;
  return `€ ${rounded.toFixed(2)}`;
};

const prettyAmount = (qty: number, unit: string): { qty: number; unit: string } => {
  if (!Number.isFinite(qty)) return { qty, unit };
  if (unit === 'g' && qty >= 1000) return { qty: qty / 1000, unit: 'kg' };
  if (unit === 'ml' && qty >= 1000) return { qty: qty / 1000, unit: 'l' };
  return { qty, unit };
};

const dayShort = (day?: string) => {
  if (!day) return '';
  const map: Record<string, string> = {
    Monday: 'Mon',
    Tuesday: 'Tue',
    Wednesday: 'Wed',
    Thursday: 'Thu',
    Friday: 'Fri',
    Saturday: 'Sat',
    Sunday: 'Sun',
    mon: 'Mon',
    tue: 'Tue',
    wed: 'Wed',
    thu: 'Thu',
    fri: 'Fri',
    sat: 'Sat',
    sun: 'Sun',
  };
  return map[day] || day;
};

const escapeCsv = (value: string) => {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const downloadTextFile = (filename: string, content: string, mime = 'text/plain') => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const inferAisle = (label: string, key: string): Aisle => {
  const s = `${label} ${key}`.toLowerCase();

  if (
    /(tomato|onion|garlic|lettuce|spinach|pepper|paprika|cucumber|carrot|celery|leek|broccoli|cauliflower|zucchini|courgette|aubergine|eggplant|mushroom|champignon|potato|sweet_potato|avocado|lemon|lime|orange|apple|banana|berries|strawberry|blueberry|herb|cilantro|coriander|parsley|basil|mint|dill)/.test(
      s
    )
  )
    return 'Produce';

  if (/(milk|cream|yogurt|yoghurt|butter|cheese|mozzarella|parmesan|feta|ricotta)/.test(s)) return 'Dairy';

  if (/(chicken|beef|pork|bacon|ham|sausage|turkey|lamb)/.test(s)) return 'Meat';
  if (/(salmon|tuna|shrimp|prawn|cod|fish|mussel|clam)/.test(s)) return 'Seafood';

  if (/(bread|bun|bagel|wrap|tortilla|pita|naan|croissant)/.test(s)) return 'Bakery';
  if (/(frozen|ice_cream)/.test(s)) return 'Frozen';

  if (/(water|sparkling|soda|cola|juice|beer|wine|coffee|tea)/.test(s)) return 'Beverages';

  if (
    /(salt|peppercorn|paprika_powder|cumin|coriander_seed|turmeric|curry|chili|cinnamon|nutmeg|clove|spice|oregano|thyme|rosemary|bay_leaf)/.test(
      s
    )
  )
    return 'Spices';

  if (
    /(rice|pasta|noodle|flour|sugar|honey|oil|olive_oil|vinegar|soy|sauce|ketchup|mustard|mayo|bean|lentil|chickpea|tomato_paste|canned|tin|stock|broth)/.test(
      s
    )
  )
    return 'Dry';

  return 'Other';
};

const detectBaseUnitFromItemUnit = (unitRaw: string): BaseUnit => {
  const u = String(unitRaw || '').toLowerCase().trim();
  if (u === 'g' || u === 'kg') return 'kg';
  if (u === 'ml' || u === 'l') return 'l';
  if (u === 'pcs' || u === 'pc' || u === 'piece' || u === 'pieces' || u === 'stk' || u === 'st') return 'pcs';
  return 'pcs';
};

const normalizedKey = (ingredientKey: string, baseUnit: BaseUnit) => `${ingredientKey}::${baseUnit}`;

const convertQuantityToBase = (quantity: number, unitRaw: string, baseUnit: BaseUnit): number | null => {
  if (!Number.isFinite(quantity)) return null;
  const u = String(unitRaw || '').toLowerCase().trim();

  if (baseUnit === 'kg') {
    if (u === 'kg') return quantity;
    if (u === 'g') return quantity / 1000;
    return null;
  }

  if (baseUnit === 'l') {
    if (u === 'l') return quantity;
    if (u === 'ml') return quantity / 1000;
    return null;
  }

  // pcs
  if (baseUnit === 'pcs') {
    if (u === '' || u === 'pcs' || u === 'pc' || u === 'piece' || u === 'pieces' || u === 'stk' || u === 'st') return quantity;
    return quantity;
  }

  return null;
};

type PlannerOccurrence = {
  key: string;
  day: string;
  recipeId: string;
  idx: number;
  title: string;
};

type ContributionRow = {
  key: string;
  day: string;
  title: string;
  quantity: number;
  unit: string;
  cost: number | null;
};

type RecipeGroupRow = {
  itemId: string;
  label: string;
  checked: boolean;
  quantity: number;
  unit: string;
  cost: number | null;
};

type RecipeGroup = {
  key: string;
  day: string;
  recipeId: string;
  title: string;
  rows: RecipeGroupRow[];
  recipeCost: number | null;
  pricedCoverage: { priced: number; total: number };
};

const migratePricesV1toV2 = (rawV1: unknown): NormalizedPriceMap => {
  const out: NormalizedPriceMap = {};
  if (!rawV1 || typeof rawV1 !== 'object') return out;

  const v1 = rawV1 as LegacyPriceMap;

  for (const entry of Object.values(v1) as LegacyPriceEntry[]) {
    if (!entry) continue;
    const ingredientKey = String(entry.ingredientKey || '');
    const unit = String(entry.unit || '').toLowerCase().trim();
    const ppu = Number(entry.pricePerUnit);

    if (!ingredientKey || !Number.isFinite(ppu) || ppu < 0) continue;

    let baseUnit: BaseUnit = detectBaseUnitFromItemUnit(unit);
    let pricePerBaseUnit = ppu;

    if (unit === 'g') {
      baseUnit = 'kg';
      pricePerBaseUnit = ppu * 1000;
    } else if (unit === 'ml') {
      baseUnit = 'l';
      pricePerBaseUnit = ppu * 1000;
    } else if (unit === 'kg') {
      baseUnit = 'kg';
      pricePerBaseUnit = ppu;
    } else if (unit === 'l') {
      baseUnit = 'l';
      pricePerBaseUnit = ppu;
    } else {
      baseUnit = 'pcs';
      pricePerBaseUnit = ppu;
    }

    const k = normalizedKey(ingredientKey, baseUnit);
    out[k] = {
      ingredientKey,
      baseUnit,
      pricePerBaseUnit,
      updatedAt: Date.now(),
    };
  }

  return out;
};

const pillBtn = (active: boolean) =>
  `px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
    active ? 'bg-pink-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
  }`;

const smallBtn =
  'px-3 py-2 rounded-xl text-[11px] font-bold bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all';

const iconBtn =
  'w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all grid place-items-center text-slate-300';

const field =
  'w-full bg-slate-950/60 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink-500/40 focus:ring-2 focus:ring-pink-500/10';

type AisleStats = {
  aisle: Aisle;
  totalItems: number;
  missingPrices: number;
  complete: boolean;
  subtotalKnown: number; // sum of known item costs (excluding pantry if excludePantryFromTotalsCost)
  firstMissingItemId: string | null;
};

type UiPrefs = {
  mode: ViewMode;
  showOnlyUnchecked: boolean;
  groupByAisle: boolean;
  hidePantry: boolean;
  showCosts: boolean;
  excludePantryFromTotalsCost: boolean;
  autoExpandUnchecked: boolean;
  collapseCompleteAisles: boolean;
  collapsedAisles: Aisle[];
};

const safeParseJson = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const ShoppingListView: React.FC<ShoppingListViewProps> = ({
  shoppingList,
  planner,
  recipes,
  onGenerate,
  onToggleItem,
  onResetChecks,
  onClear,
}) => {
  // ---------- Route A: load UI prefs once ----------
  const uiPrefs = useMemo(() => safeParseJson<UiPrefs>(localStorage.getItem(LS_UI_PREFS)), []);

  const [mode, setMode] = useState<ViewMode>(uiPrefs?.mode ?? 'totals');
  const [showOnlyUnchecked, setShowOnlyUnchecked] = useState(uiPrefs?.showOnlyUnchecked ?? true);

  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());
  const [autoExpandUnchecked, setAutoExpandUnchecked] = useState(uiPrefs?.autoExpandUnchecked ?? false);

  const [groupByAisle, setGroupByAisle] = useState(uiPrefs?.groupByAisle ?? true);
  const [hidePantry, setHidePantry] = useState(uiPrefs?.hidePantry ?? false);

  const [showCosts, setShowCosts] = useState(uiPrefs?.showCosts ?? true);
  const [excludePantryFromTotalsCost, setExcludePantryFromTotalsCost] = useState(uiPrefs?.excludePantryFromTotalsCost ?? true);

  const [cleanupOpen, setCleanupOpen] = useState(false);

  // polish: collapse complete aisles (optional)
  const [collapseCompleteAisles, setCollapseCompleteAisles] = useState(uiPrefs?.collapseCompleteAisles ?? true);
  const [collapsedAisles, setCollapsedAisles] = useState<Set<Aisle>>(() => new Set(uiPrefs?.collapsedAisles ?? []));

  // polish: keyboard flow & highlight
  const priceInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [highlightItemId, setHighlightItemId] = useState<string | null>(null);

  const listTopRef = useRef<HTMLDivElement | null>(null);

  const [aisleOverrides, setAisleOverrides] = useState<Record<string, Aisle>>(() => {
    try {
      const raw = localStorage.getItem(LS_AISLE_OVERRIDES);
      return raw ? (JSON.parse(raw) as Record<string, Aisle>) : {};
    } catch {
      return {};
    }
  });

  const [pantrySet, setPantrySet] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(LS_PANTRY);
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      return new Set(arr);
    } catch {
      return new Set();
    }
  });

  const [prices, setPrices] = useState<NormalizedPriceMap>(() => {
    try {
      const rawV2 = localStorage.getItem(LS_PRICES_V2);
      if (rawV2) {
        const parsed = JSON.parse(rawV2) as NormalizedPriceMap;
        return parsed && typeof parsed === 'object' ? parsed : {};
      }

      const rawV1 = localStorage.getItem(LS_PRICES_V1);
      if (rawV1) {
        const parsedV1 = JSON.parse(rawV1);
        const migrated = migratePricesV1toV2(parsedV1);
        localStorage.setItem(LS_PRICES_V2, JSON.stringify(migrated));
        return migrated;
      }

      return {};
    } catch {
      return {};
    }
  });

  // persist stores
  useEffect(() => {
    try {
      localStorage.setItem(LS_AISLE_OVERRIDES, JSON.stringify(aisleOverrides));
    } catch {
      // ignore
    }
  }, [aisleOverrides]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_PANTRY, JSON.stringify(Array.from(pantrySet)));
    } catch {
      // ignore
    }
  }, [pantrySet]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_PRICES_V2, JSON.stringify(prices));
    } catch {
      // ignore
    }
  }, [prices]);

  // ---------- Route A: persist UI prefs ----------
  useEffect(() => {
    try {
      const prefs: UiPrefs = {
        mode,
        showOnlyUnchecked,
        groupByAisle,
        hidePantry,
        showCosts,
        excludePantryFromTotalsCost,
        autoExpandUnchecked,
        collapseCompleteAisles,
        collapsedAisles: Array.from(collapsedAisles),
      };
      localStorage.setItem(LS_UI_PREFS, JSON.stringify(prefs));
    } catch {
      // ignore
    }
  }, [
    mode,
    showOnlyUnchecked,
    groupByAisle,
    hidePantry,
    showCosts,
    excludePantryFromTotalsCost,
    autoExpandUnchecked,
    collapseCompleteAisles,
    collapsedAisles,
  ]);

  const items = shoppingList?.items || [];
  const checkedCount = items.filter(i => i.checked).length;

  const recipeTitleById = useMemo(() => {
    const m = new Map<string, string>();
    recipes.forEach(r => m.set(r.id, r.title));
    return m;
  }, [recipes]);

  const plannerOccurrences: PlannerOccurrence[] = useMemo(() => {
    const out: PlannerOccurrence[] = [];
    DAY_ORDER.forEach(day => {
      const ids = (planner as any)?.[day] || [];
      ids.forEach((recipeId: string, idx: number) => {
        const title = recipeTitleById.get(recipeId) || 'Unknown recipe';
        out.push({ key: `${day}-${idx}-${recipeId}`, day, recipeId, idx, title });
      });
    });
    return out;
  }, [planner, recipeTitleById]);

  const hasParts = useMemo(() => items.some((i: any) => Array.isArray(i.parts) && i.parts.length > 0), [items]);

  const getAisleForItem = (ingredientKey: string, label: string): Aisle => {
    return aisleOverrides[ingredientKey] || inferAisle(label, ingredientKey);
  };

  const isPantry = (ingredientKey: string) => pantrySet.has(ingredientKey);

  const getNormalizedPrice = (ingredientKey: string, baseUnit: BaseUnit): number | null => {
    const entry = prices[normalizedKey(ingredientKey, baseUnit)];
    if (!entry) return null;
    if (!Number.isFinite(entry.pricePerBaseUnit)) return null;
    return entry.pricePerBaseUnit;
  };

  const setNormalizedPrice = (ingredientKey: string, baseUnit: BaseUnit, pricePerBaseUnit: number | null) => {
    const k = normalizedKey(ingredientKey, baseUnit);
    setPrices(prev => {
      const next = { ...prev };
      if (pricePerBaseUnit === null || !Number.isFinite(pricePerBaseUnit) || pricePerBaseUnit < 0) {
        delete next[k];
      } else {
        next[k] = { ingredientKey, baseUnit, pricePerBaseUnit, updatedAt: Date.now() };
      }
      return next;
    });
  };

  const itemCost = (ingredientKey: string, unitRaw: string, quantity: number): number | null => {
    const baseUnit = detectBaseUnitFromItemUnit(unitRaw);
    const pricePerBase = getNormalizedPrice(ingredientKey, baseUnit);
    if (pricePerBase === null) return null;

    const qtyBase = convertQuantityToBase(quantity, unitRaw, baseUnit);
    if (qtyBase === null) return null;

    return qtyBase * pricePerBase;
  };

  const visibleTotals = useMemo(() => {
    let base = showOnlyUnchecked ? items.filter((i: any) => !i.checked) : items;
    if (hidePantry) base = base.filter((i: any) => !isPantry(i.ingredientKey));
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, showOnlyUnchecked, hidePantry, pantrySet]);

  useEffect(() => {
    if (mode !== 'totals') return;
    if (!autoExpandUnchecked) return;

    const next = new Set<string>();
    visibleTotals.forEach((i: any) => {
      if (!i.checked) next.add(i.id);
    });
    setExpandedItemIds(next);
  }, [autoExpandUnchecked, mode, visibleTotals]);

  const totalsByAisle = useMemo(() => {
    const map = new Map<Aisle, any[]>();
    for (const a of AISLES) map.set(a, []);
    for (const it of visibleTotals) {
      const aisle = getAisleForItem(it.ingredientKey, it.label);
      map.get(aisle)!.push(it);
    }
    for (const a of AISLES) {
      map.set(a, (map.get(a) || []).slice().sort((x: any, y: any) => x.label.localeCompare(y.label)));
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleTotals, aisleOverrides]);

  // missing ids in visible list (excl pantry cost if configured)
  const missingItemIds = useMemo(() => {
    const ids: string[] = [];
    if (!showCosts) return ids;

    for (const it of visibleTotals) {
      if (excludePantryFromTotalsCost && isPantry(it.ingredientKey)) continue;
      const unit = String(it.unit || '');
      const baseUnit = detectBaseUnitFromItemUnit(unit);
      if (getNormalizedPrice(it.ingredientKey, baseUnit) === null) {
        ids.push(it.id);
      }
    }
    return ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleTotals, prices, pantrySet, excludePantryFromTotalsCost, showCosts]);

  const focusItemPrice = (itemId: string) => {
    const el = priceInputRefs.current[itemId];
    if (!el) return;

    document.getElementById(`item-${itemId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    requestAnimationFrame(() => {
      el.focus();
      el.select?.();
    });

    setHighlightItemId(itemId);
    window.setTimeout(() => setHighlightItemId(prev => (prev === itemId ? null : prev)), 800);
  };

  const focusNextMissingAfter = (afterItemId: string | null) => {
    if (!showCosts) return;
    if (missingItemIds.length === 0) return;

    if (!afterItemId) {
      focusItemPrice(missingItemIds[0]);
      return;
    }

    const idx = missingItemIds.indexOf(afterItemId);
    const nextId = idx === -1 ? missingItemIds[0] : missingItemIds[idx + 1] ?? null;
    if (nextId) focusItemPrice(nextId);
  };

  const jumpToNextMissing = () => focusNextMissingAfter(null);

  // Route A: totals should always be useful -> known total + missing count
  const totalsKnownSummary = useMemo(() => {
    if (!showCosts) return { knownTotal: 0, missingCount: 0 };

    let known = 0;
    let missing = 0;

    for (const it of visibleTotals) {
      if (excludePantryFromTotalsCost && isPantry(it.ingredientKey)) continue;
      const c = itemCost(it.ingredientKey, String(it.unit || ''), Number(it.quantity || 0));
      if (c === null) missing += 1;
      else known += c;
    }

    return { knownTotal: known, missingCount: missing };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleTotals, showCosts, prices, pantrySet, excludePantryFromTotalsCost]);

  const aisleStats = useMemo(() => {
    const by = new Map<Aisle, AisleStats>();

    for (const a of AISLES) {
      by.set(a, {
        aisle: a,
        totalItems: 0,
        missingPrices: 0,
        complete: true,
        subtotalKnown: 0,
        firstMissingItemId: null,
      });
    }

    if (!groupByAisle) return by;

    for (const a of AISLES) {
      const rows = totalsByAisle.get(a) || [];
      const st = by.get(a)!;
      st.totalItems = rows.length;

      let missing = 0;
      let subtotalKnown = 0;
      let firstMissing: string | null = null;

      for (const it of rows) {
        if (!showCosts) continue;

        if (excludePantryFromTotalsCost && isPantry(it.ingredientKey)) {
          continue;
        }

        const unit = String(it.unit || '');
        const c = itemCost(it.ingredientKey, unit, Number(it.quantity || 0));

        if (c === null) {
          missing += 1;
          if (!firstMissing) firstMissing = it.id;
        } else {
          subtotalKnown += c;
        }
      }

      st.missingPrices = missing;
      st.complete = showCosts ? missing === 0 : true;
      st.subtotalKnown = subtotalKnown;
      st.firstMissingItemId = firstMissing;

      by.set(a, st);
    }

    return by;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalsByAisle, groupByAisle, showCosts, prices, pantrySet, excludePantryFromTotalsCost]);

  const groups: RecipeGroup[] = useMemo(() => {
    if (!shoppingList) return [];

    const recipeById = new Map<string, Recipe>();
    recipes.forEach(r => recipeById.set(r.id, r));

    const out: RecipeGroup[] = [];

    DAY_ORDER.forEach(day => {
      const ids = (planner as any)?.[day] || [];
      ids.forEach((recipeId: string, idx: number) => {
        const recipe = recipeById.get(recipeId);
        const title = recipe?.title || 'Unknown recipe';

        const rowMap = new Map<string, RecipeGroupRow>();

        for (const it of items as any[]) {
          const parts = it.parts || [];
          const relevant = parts.filter((p: any) => p.recipeId === recipeId && (p.day ? p.day === day : true));
          if (relevant.length === 0) continue;

          let qty = 0;
          let unit = String(it.unit || '');
          for (const p of relevant) {
            qty += Number(p.quantity || 0);
            unit = String(p.unit || unit);
          }

          const bucketKey = `${it.id}::${unit || ''}`;
          const cost = itemCost(it.ingredientKey, unit, qty);

          const existing = rowMap.get(bucketKey);
          if (existing) {
            existing.quantity += qty;
            existing.cost = existing.cost === null || cost === null ? null : existing.cost + cost;
          } else {
            rowMap.set(bucketKey, {
              itemId: it.id,
              label: it.label,
              checked: it.checked,
              quantity: qty,
              unit,
              cost,
            });
          }
        }

        let rows = Array.from(rowMap.values()).sort((a, b) => a.label.localeCompare(b.label));
        if (showOnlyUnchecked) rows = rows.filter(r => !r.checked);

        let priced = 0;
        let total = rows.length;
        let sum = 0;
        let allPriced = true;

        for (const r of rows) {
          if (r.cost === null) allPriced = false;
          else {
            priced += 1;
            sum += r.cost;
          }
        }

        out.push({
          key: `${day}-${idx}-${recipeId}`,
          day,
          recipeId,
          title,
          rows,
          recipeCost: total === 0 ? 0 : allPriced ? sum : null,
          pricedCoverage: { priced, total },
        });
      });
    });

    return out;
  }, [shoppingList, planner, recipes, items, showOnlyUnchecked, prices]);

  const exportTextTotals = useMemo(() => {
    const lines = visibleTotals
      .slice()
      .sort((a: any, b: any) => a.label.localeCompare(b.label))
      .map((i: any) => {
        const p = prettyAmount(i.quantity, String(i.unit || ''));
        const amount = `${formatQty(p.qty)} ${p.unit}`.trim();
        const prefix = i.checked ? '[x]' : '[ ]';
        const cost = showCosts ? itemCost(i.ingredientKey, String(i.unit || ''), i.quantity) : null;
        const costStr = showCosts ? ` • ${cost === null ? '€ —' : formatMoney(cost)}` : '';
        return `${prefix} ${i.label} — ${amount}${costStr}`;
      });
    return lines.join('\n');
  }, [visibleTotals, showCosts, prices]);

  const exportTextByRecipe = useMemo(() => {
    const lines: string[] = [];
    for (const g of groups) {
      if (g.rows.length === 0) continue;

      const costLabel =
        showCosts && g.pricedCoverage.total > 0
          ? g.recipeCost === null
            ? ` • Cost: ${g.pricedCoverage.priced}/${g.pricedCoverage.total} priced`
            : ` • Cost: ${formatMoney(g.recipeCost)}`
          : '';

      lines.push(`${g.title} (${dayShort(g.day)})${costLabel}`);

      for (const r of g.rows) {
        const p = prettyAmount(r.quantity, r.unit);
        const amount = `${formatQty(p.qty)} ${p.unit}`.trim();
        const costStr = showCosts ? ` • ${r.cost === null ? '€ —' : formatMoney(r.cost)}` : '';
        lines.push(`  ${r.checked ? '[x]' : '[ ]'} ${r.label} — ${amount}${costStr}`.trim());
      }
      lines.push('');
    }
    return lines.join('\n').trim();
  }, [groups, showCosts]);

  const handleCopy = async () => {
    try {
      const text = mode === 'totals' ? exportTextTotals : exportTextByRecipe;
      await navigator.clipboard.writeText(text);
      alert('Copied to clipboard.');
    } catch {
      alert('Copy failed (browser permissions). Use Print instead.');
    }
  };

  const handlePrint = () => {
    const win = window.open('', '_blank', 'noopener,noreferrer');
    if (!win) {
      alert('Pop-up blocked. Allow pop-ups to print.');
      return;
    }

    const text = mode === 'totals' ? exportTextTotals : exportTextByRecipe;

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>TokToTable — Shopping List</title>
          <style>
            body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px; }
            h1 { margin: 0 0 12px 0; font-size: 18px; }
            pre { white-space: pre-wrap; font-size: 13px; line-height: 1.5; }
            .meta { color: #666; font-size: 12px; margin-bottom: 12px; }
          </style>
        </head>
        <body>
          <h1>TokToTable — Shopping List</h1>
          <div class="meta">Mode: ${mode === 'totals' ? 'Shopping (Totals)' : 'Cooking (By recipe)'} • Generated: ${new Date(
      shoppingList?.updatedAt ?? Date.now()
    ).toLocaleString()}</div>
          <pre>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
          <script>window.print();</script>
        </body>
      </html>
    `;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  const handleExportShoppingCsv = () => {
    const rows = visibleTotals.map((i: any) => {
      const aisle = getAisleForItem(i.ingredientKey, i.label);
      const pantry = isPantry(i.ingredientKey) ? '1' : '0';
      const unit = String(i.unit || '');
      const baseUnit = detectBaseUnitFromItemUnit(unit);
      const pricePerBaseUnit = getNormalizedPrice(i.ingredientKey, baseUnit);
      const cost = showCosts ? itemCost(i.ingredientKey, unit, i.quantity) : null;

      return {
        checked: i.checked ? '1' : '0',
        label: i.label,
        quantity: String(i.quantity ?? ''),
        unit: unit,
        aisle,
        pantry,
        ingredientKey: i.ingredientKey,
        baseUnit,
        pricePerBaseUnit: String(pricePerBaseUnit ?? ''),
        itemCost: String(cost ?? ''),
      };
    });

    const header = [
      'checked',
      'label',
      'quantity',
      'unit',
      'aisle',
      'pantry',
      'ingredientKey',
      'baseUnit',
      'pricePerBaseUnit',
      'itemCost',
    ];

    const csv = header.join(',') + '\n' + rows.map(r => header.map(h => escapeCsv((r as any)[h])).join(',')).join('\n');

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadTextFile(`toktotable-shopping-${stamp}.csv`, csv, 'text/csv');
  };

  const handleExportPriceCsv = () => {
    const entries = (Object.values(prices) as NormalizedPriceEntry[]).sort((a, b) =>
      (a.ingredientKey + '::' + a.baseUnit).localeCompare(b.ingredientKey + '::' + b.baseUnit)
    );

    const header = ['ingredientKey', 'baseUnit', 'pricePerBaseUnit', 'updatedAt'];
    const csv =
      header.join(',') +
      '\n' +
      entries
        .map(e => [e.ingredientKey, e.baseUnit, String(e.pricePerBaseUnit), String(e.updatedAt)].map(escapeCsv).join(','))
        .join('\n');

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadTextFile(`toktotable-prices-${stamp}.csv`, csv, 'text/csv');
  };

  const handleImportPriceCsv = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      alert('CSV has no data.');
      return;
    }

    const header = lines[0].split(',').map(h => h.trim());
    const idxKey = header.indexOf('ingredientKey');

    const idxBaseUnit = header.indexOf('baseUnit');
    const idxPriceBase = header.indexOf('pricePerBaseUnit');

    const idxUnitLegacy = header.indexOf('unit');
    const idxPriceLegacy = header.indexOf('pricePerUnit');

    if (idxKey === -1) {
      alert('CSV must have column: ingredientKey');
      return;
    }

    const parseRow = (line: string) => {
      const out: string[] = [];
      let cur = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === ',' && !inQuotes) {
          out.push(cur);
          cur = '';
        } else {
          cur += ch;
        }
      }
      out.push(cur);
      return out.map(s => s.trim());
    };

    const parsed: NormalizedPriceMap = {};
    let added = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = parseRow(lines[i]);
      const ingredientKey = (cols[idxKey] || '').trim();
      if (!ingredientKey) continue;

      if (idxBaseUnit !== -1 && idxPriceBase !== -1) {
        const baseUnitRaw = (cols[idxBaseUnit] || '').trim().toLowerCase();
        const baseUnit: BaseUnit =
          baseUnitRaw === 'kg' || baseUnitRaw === 'l' || baseUnitRaw === 'pcs' ? (baseUnitRaw as BaseUnit) : 'pcs';
        const priceStr = cols[idxPriceBase] || '';
        const price = Number(String(priceStr).replace(',', '.'));
        if (!Number.isFinite(price) || price < 0) continue;

        const k = normalizedKey(ingredientKey, baseUnit);
        parsed[k] = { ingredientKey, baseUnit, pricePerBaseUnit: price, updatedAt: Date.now() };
        added += 1;
        continue;
      }

      if (idxUnitLegacy !== -1 && idxPriceLegacy !== -1) {
        const unit = (cols[idxUnitLegacy] || '').trim().toLowerCase();
        const priceStr = cols[idxPriceLegacy] || '';
        const ppu = Number(String(priceStr).replace(',', '.'));
        if (!Number.isFinite(ppu) || ppu < 0) continue;

        let baseUnit: BaseUnit = detectBaseUnitFromItemUnit(unit);
        let pricePerBaseUnit = ppu;

        if (unit === 'g') {
          baseUnit = 'kg';
          pricePerBaseUnit = ppu * 1000;
        } else if (unit === 'ml') {
          baseUnit = 'l';
          pricePerBaseUnit = ppu * 1000;
        } else if (unit === 'kg') {
          baseUnit = 'kg';
          pricePerBaseUnit = ppu;
        } else if (unit === 'l') {
          baseUnit = 'l';
          pricePerBaseUnit = ppu;
        } else {
          baseUnit = 'pcs';
          pricePerBaseUnit = ppu;
        }

        const k = normalizedKey(ingredientKey, baseUnit);
        parsed[k] = { ingredientKey, baseUnit, pricePerBaseUnit, updatedAt: Date.now() };
        added += 1;
        continue;
      }
    }

    if (added === 0) {
      alert('No valid price rows found. Use columns: ingredientKey,baseUnit,pricePerBaseUnit (or legacy unit,pricePerUnit).');
      return;
    }

    setPrices(prev => ({ ...prev, ...parsed }));
    alert(`Imported ${added} price entries.`);
  };

  const applyShoppingPreset = () => {
    setMode('totals');
    setShowOnlyUnchecked(true);
    setAutoExpandUnchecked(false);
    setExpandedItemIds(new Set());
    setCleanupOpen(false);
    requestAnimationFrame(() => listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const applyCookingPreset = () => {
    setMode('by_recipe');
    setShowOnlyUnchecked(false);
    setAutoExpandUnchecked(false);
    setExpandedItemIds(new Set());
    setCleanupOpen(false);
    requestAnimationFrame(() => listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const toggleExpanded = (itemId: string) => {
    setExpandedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const collapseAll = () => setExpandedItemIds(new Set());
  const expandAllVisible = () => setExpandedItemIds(new Set(visibleTotals.map((i: any) => i.id)));

  const setOverride = (ingredientKey: string, aisle: Aisle) => {
    setAisleOverrides(prev => ({ ...prev, [ingredientKey]: aisle }));
  };

  const clearOverride = (ingredientKey: string) => {
    setAisleOverrides(prev => {
      const next = { ...prev };
      delete next[ingredientKey];
      return next;
    });
  };

  const togglePantry = (ingredientKey: string) => {
    setPantrySet(prev => {
      const next = new Set(prev);
      if (next.has(ingredientKey)) next.delete(ingredientKey);
      else next.add(ingredientKey);
      return next;
    });
  };

  const getContributionsForItem = (itemId: string): ContributionRow[] => {
    const item = (items as any[]).find(i => i.id === itemId);
    if (!item) return [];
    const parts = item.parts || [];

    const rows: ContributionRow[] = [];
    for (const occ of plannerOccurrences) {
      const relevant = parts.filter((p: any) => p.recipeId === occ.recipeId && (p.day ? p.day === occ.day : true));
      if (relevant.length === 0) continue;

      let qty = 0;
      let unit = String(item.unit || '');
      for (const p of relevant) {
        qty += Number(p.quantity || 0);
        unit = String(p.unit || unit);
      }
      if (qty === 0) continue;

      const cost = itemCost(item.ingredientKey, unit, qty);
      rows.push({ key: occ.key, day: occ.day, title: occ.title, quantity: qty, unit, cost });
    }
    return rows;
  };

  const pricedCoverageLabel =
    mode === 'totals'
      ? showCosts
        ? totalsKnownSummary.missingCount === 0
          ? 'All priced'
          : `${Math.max(0, visibleTotals.length - totalsKnownSummary.missingCount)}/${visibleTotals.length} priced`
        : 'Costs hidden'
      : showCosts
        ? 'Costs on'
        : 'Costs hidden';

  const onPriceInput = (ingredientKey: string, unitRaw: string, value: string) => {
    const baseUnit = detectBaseUnitFromItemUnit(unitRaw);
    const clean = value.trim();
    if (!clean) {
      setNormalizedPrice(ingredientKey, baseUnit, null);
      return;
    }
    const num = Number(clean.replace(',', '.'));
    if (!Number.isFinite(num) || num < 0) return; // ignore invalid
    setNormalizedPrice(ingredientKey, baseUnit, num);
  };

  const renderTotalsRow = (it: any) => {
    const unit = String(it.unit || '');
    const p = prettyAmount(Number(it.quantity || 0), unit);
    const baseUnit = detectBaseUnitFromItemUnit(unit);
    const price = getNormalizedPrice(it.ingredientKey, baseUnit);
    const cost = showCosts ? itemCost(it.ingredientKey, unit, Number(it.quantity || 0)) : null;

    const expanded = expandedItemIds.has(it.id);

return (
  <div
    key={it.id}
    id={`item-${it.id}`}
    data-itemid={it.id}
    tabIndex={0}
    onClick={e => {
      // focus row when you click anywhere on it (but don't steal focus from inputs)
      if ((e.target as HTMLElement)?.tagName?.toLowerCase() === 'input') return;
      (e.currentTarget as HTMLDivElement).focus();
    }}
onKeyDown={e => {
  // Route B light: only when the ROW has focus (not when typing in inputs)
  if (e.key === ' ' || e.key === 'Spacebar') {
    e.preventDefault(); // prevent page scroll
    onToggleItem(it.id);
    return;
  }

  if (e.key === 'p' || e.key === 'P') {
    e.preventDefault();
    togglePantry(it.ingredientKey);
    return;
  }

if (e.key === 'f' || e.key === 'F') {
  e.preventDefault();

  // Shift+F = focus next missing after current item
  if (e.shiftKey) {
    focusNextMissingAfter(it.id);
    return;
  }

  // F = focus this item's price input
  const input = priceInputRefs.current[it.id];
  if (input) {
    input.focus();
    input.select?.();
  }
  return;
}

}}

    className={`rounded-2xl border overflow-hidden transition-colors outline-none focus:ring-2 focus:ring-pink-500/20 ${
      highlightItemId === it.id
        ? 'border-pink-500/40 bg-pink-500/[0.06]'
        : it.checked
          ? 'border-white/5 bg-white/[0.02]'
          : 'border-white/10 bg-white/[0.03]'
    }`}
  >

        <div className="p-3 md:p-4 flex items-start gap-3">
          <button
            onClick={() => onToggleItem(it.id)}
            className={`mt-1 w-6 h-6 rounded-lg border grid place-items-center transition-all ${
              it.checked
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                : 'bg-black/20 border-white/15 text-slate-400 hover:text-white'
            }`}
            title="Toggle checked"
          >
            <i className={`fa-solid ${it.checked ? 'fa-check' : 'fa-minus'} text-[10px]`}></i>
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`font-black text-sm md:text-base truncate ${it.checked ? 'text-slate-500 line-through' : 'text-slate-100'}`}>
                    {it.label}
                  </p>

                  <button
                    onClick={() => togglePantry(it.ingredientKey)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase border transition-all ${
                      isPantry(it.ingredientKey)
                        ? 'bg-cyan-500/15 border-cyan-400/30 text-cyan-200'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    }`}
                    title="Mark as pantry"
                  >
                    <i className="fa-solid fa-box-archive mr-1"></i>
                    Pantry
                  </button>

                  <button
                    onClick={() => {
                      const current = getAisleForItem(it.ingredientKey, it.label);
                      const idx = AISLES.indexOf(current);
                      const next = AISLES[(idx + 1) % AISLES.length];
                      setOverride(it.ingredientKey, next);
                    }}
                    className="hidden md:inline-flex px-2 py-1 rounded-lg text-[10px] font-black uppercase bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all"
                    title="Cycle aisle"
                  >
                    <i className="fa-solid fa-store mr-1"></i>
                    {getAisleForItem(it.ingredientKey, it.label)}
                  </button>

                  {aisleOverrides[it.ingredientKey] && (
                    <button
                      onClick={() => clearOverride(it.ingredientKey)}
                      className="hidden md:inline-flex px-2 py-1 rounded-lg text-[10px] font-black uppercase bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all"
                      title="Clear aisle override"
                    >
                      <i className="fa-solid fa-eraser mr-1"></i>
                      Reset
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 mt-1">
                  <span className="font-bold text-slate-300">{`${formatQty(p.qty)} ${p.unit}`.trim()}</span>
                  {showCosts && (
                    <>
                      <span className="text-slate-600 mx-2">•</span>
                      <span className={`${cost === null ? 'text-slate-500' : 'text-slate-300'}`}>{cost === null ? '€ —' : formatMoney(cost)}</span>
                    </>
                  )}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2 min-w-[140px]">
                {showCosts && (
                  <div className="w-full">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Price</p>
                      <p className="text-[10px] font-black text-slate-500">{`€/ ${baseUnit}`}</p>
                    </div>

                    <input
                      ref={el => {
                        priceInputRefs.current[it.id] = el;
                      }}
                      className={`${field} text-sm`}
                      placeholder={price === null ? '—' : String(price)}
                      defaultValue={price === null ? '' : String(price)}
                      inputMode="decimal"
                      onFocus={e => {
                        e.currentTarget.select();
                        (e.currentTarget as HTMLInputElement).dataset.initial = e.currentTarget.value;
                      }}
                      onKeyDown={e => {
                        const input = e.currentTarget as HTMLInputElement;

                        if (e.key === 'Enter') {
                          input.blur();
                          window.setTimeout(() => {
                            focusNextMissingAfter(it.id);
                          }, 50);
                        }

                        if (e.key === 'Escape') {
                          input.value = input.dataset.initial ?? '';
                          input.blur();
                        }
                      }}
                      onBlur={e => onPriceInput(it.ingredientKey, unit, e.currentTarget.value)}
                    />
                  </div>
                )}

                {hasParts && (
                  <button
                    onClick={() => toggleExpanded(it.id)}
                    className="text-[11px] font-bold text-slate-400 hover:text-white transition-all"
                    title="Show breakdown"
                  >
                    <i className={`fa-solid ${expanded ? 'fa-chevron-up' : 'fa-chevron-down'} mr-2`}></i>
                    Breakdown
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {hasParts && expanded && (
          <div className="border-t border-white/10 bg-black/20 p-3 md:p-4">
            <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-3">Contributions</p>
            <div className="space-y-2">
              {getContributionsForItem(it.id).map(row => {
                const pp = prettyAmount(row.quantity, row.unit);
                const c = showCosts ? row.cost : null;
                return (
                  <div key={row.key} className="flex items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold truncate">
                        {row.title} <span className="text-slate-500 font-black">({dayShort(row.day)})</span>
                      </p>
                      <p className="text-[11px] text-slate-400">{`${formatQty(pp.qty)} ${pp.unit}`.trim()}</p>
                    </div>
                    {showCosts && <p className="text-[12px] font-black text-slate-200">{c === null ? '€ —' : formatMoney(c)}</p>}
                  </div>
                );
              })}
              {getContributionsForItem(it.id).length === 0 && <p className="text-slate-500 text-sm">No breakdown available for this item.</p>}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTotals = () => {
    if (!shoppingList || items.length === 0) {
      return (
        <div className="text-center py-20 glass-panel rounded-3xl border-dashed border-2 border-white/5">
          <i className="fa-solid fa-basket-shopping text-4xl text-slate-700 mb-4"></i>
          <p className="text-slate-500">No shopping list yet. Generate one from your planner.</p>
          <div className="mt-6 flex justify-center">
            <button
              onClick={onGenerate}
              className="px-6 py-3 rounded-2xl font-black bg-pink-500 hover:bg-pink-400 text-white transition-all shadow-xl shadow-pink-900/20 flex items-center gap-3"
            >
              <i className="fa-solid fa-wand-magic-sparkles"></i>
              Generate from Planner
            </button>
          </div>
        </div>
      );
    }

    if (!groupByAisle) {
      return <div className="space-y-3">{visibleTotals.map(renderTotalsRow)}</div>;
    }

    return (
      <div className="space-y-8">
        {AISLES.map(aisle => {
          const rows = totalsByAisle.get(aisle) || [];
          if (rows.length === 0) return null;

          const st = aisleStats.get(aisle)!;

          const isCollapsed = (collapseCompleteAisles && showCosts && st.complete) || collapsedAisles.has(aisle);

          const toggleCollapse = () => {
            setCollapsedAisles(prev => {
              const next = new Set(prev);
              if (next.has(aisle)) next.delete(aisle);
              else next.add(aisle);
              return next;
            });
          };

          const jumpAisleMissing = () => {
            if (!st.firstMissingItemId) return;
            focusItemPrice(st.firstMissingItemId);
          };

          // Route A: always show known subtotal (even if incomplete)
          const subtotalLabel = showCosts ? formatMoney(st.subtotalKnown) : '—';

          return (
            <div key={aisle}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest flex items-center gap-2">
                    <span
                      className={`inline-flex items-center justify-center w-5 h-5 rounded-lg border ${
                        showCosts
                          ? st.complete
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                            : 'border-white/10 bg-white/5 text-slate-400'
                          : 'border-white/10 bg-white/5 text-slate-400'
                      }`}
                      title={showCosts ? (st.complete ? 'Complete' : 'Incomplete') : 'Costs hidden'}
                    >
                      <i className={`fa-solid ${showCosts ? (st.complete ? 'fa-check' : 'fa-circle-dot') : 'fa-circle'} text-[10px]`}></i>
                    </span>
                    {aisle}
                  </p>

                  <span className="text-[10px] font-black text-slate-600">{rows.length} items</span>

                  {showCosts && (
                    <>
                      <span className={`text-[10px] font-black ${st.complete ? 'text-slate-300' : 'text-slate-500'}`}>
                        {st.complete ? 'Total:' : 'Known:'} {subtotalLabel}
                      </span>

                      {st.missingPrices > 0 && (
                        <button
                          type="button"
                          onClick={jumpAisleMissing}
                          className="text-[10px] font-black text-slate-500 hover:text-white underline underline-offset-4"
                          title="Jump to first missing price in this aisle"
                        >
                          Missing: {st.missingPrices}
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleCollapse}
                    className="px-3 py-1 rounded-xl text-[10px] font-black uppercase bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                    title={isCollapsed ? 'Expand aisle' : 'Collapse aisle'}
                  >
                    <i className={`fa-solid ${isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'} mr-2`}></i>
                    {isCollapsed ? 'Expand' : 'Collapse'}
                  </button>
                </div>
              </div>

              {!isCollapsed && <div className="space-y-3">{rows.map(renderTotalsRow)}</div>}
            </div>
          );
        })}
      </div>
    );
  };

  const renderByRecipe = () => {
    if (!shoppingList || items.length === 0) {
      return (
        <div className="text-center py-20 glass-panel rounded-3xl border-dashed border-2 border-white/5">
          <i className="fa-solid fa-bowl-food text-4xl text-slate-700 mb-4"></i>
          <p className="text-slate-500">No shopping list yet. Generate one first.</p>
          <div className="mt-6 flex justify-center">
            <button
              onClick={onGenerate}
              className="px-6 py-3 rounded-2xl font-black bg-pink-500 hover:bg-pink-400 text-white transition-all shadow-xl shadow-pink-900/20 flex items-center gap-3"
            >
              <i className="fa-solid fa-wand-magic-sparkles"></i>
              Generate from Planner
            </button>
          </div>
        </div>
      );
    }

    if (groups.length === 0) {
      return (
        <div className="text-center py-14 glass-panel rounded-3xl border border-white/10">
          <p className="text-slate-500">No planner meals found for this list.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {groups.map(g => {
          if (g.rows.length === 0) return null;

          const costLabel =
            showCosts && g.pricedCoverage.total > 0
              ? g.recipeCost === null
                ? `${g.pricedCoverage.priced}/${g.pricedCoverage.total} priced`
                : formatMoney(g.recipeCost)
              : null;

          return (
            <div key={g.key} className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">
              <div className="p-4 md:p-5 flex items-center justify-between gap-4 border-b border-white/10">
                <div className="min-w-0">
                  <p className="font-black text-lg truncate">
                    {g.title} <span className="text-slate-500 font-black">({dayShort(g.day)})</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {g.rows.length} items
                    {showCosts && (
                      <>
                        <span className="text-slate-600 mx-2">•</span>
                        <span className="text-slate-300 font-bold">{costLabel ?? '€ —'}</span>
                      </>
                    )}
                  </p>
                </div>

                <button
                  onClick={() => {
                    const ids = g.rows.map(r => r.itemId);
                    setExpandedItemIds(prev => {
                      const next = new Set(prev);
                      const allExpanded = ids.every(id => next.has(id));
                      if (allExpanded) ids.forEach(id => next.delete(id));
                      else ids.forEach(id => next.add(id));
                      return next;
                    });
                  }}
                  className={smallBtn}
                >
                  Toggle breakdown
                </button>
              </div>

              <div className="p-4 md:p-5 space-y-3">
                {g.rows.map(r => {
                  const pp = prettyAmount(r.quantity, r.unit);
                  return (
                    <div key={`${g.key}-${r.itemId}-${r.unit}`} className="rounded-2xl border border-white/10 bg-black/20 p-3 md:p-4">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => onToggleItem(r.itemId)}
                          className={`mt-1 w-6 h-6 rounded-lg border grid place-items-center transition-all ${
                            r.checked
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                              : 'bg-black/20 border-white/15 text-slate-400 hover:text-white'
                          }`}
                          title="Toggle checked"
                        >
                          <i className={`fa-solid ${r.checked ? 'fa-check' : 'fa-minus'} text-[10px]`}></i>
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className={`font-black truncate ${r.checked ? 'text-slate-500 line-through' : 'text-slate-100'}`}>{r.label}</p>
                              <p className="text-[11px] text-slate-400 mt-1">
                                <span className="font-bold text-slate-300">{`${formatQty(pp.qty)} ${pp.unit}`.trim()}</span>
                                {showCosts && (
                                  <>
                                    <span className="text-slate-600 mx-2">•</span>
                                    <span className={`${r.cost === null ? 'text-slate-500' : 'text-slate-300'}`}>{r.cost === null ? '€ —' : formatMoney(r.cost)}</span>
                                  </>
                                )}
                              </p>
                            </div>

                            {hasParts && (
                              <button
                                onClick={() => toggleExpanded(r.itemId)}
                                className="text-[11px] font-bold text-slate-400 hover:text-white transition-all"
                              >
                                <i className={`fa-solid ${expandedItemIds.has(r.itemId) ? 'fa-chevron-up' : 'fa-chevron-down'} mr-2`}></i>
                                Breakdown
                              </button>
                            )}
                          </div>

                          {hasParts && expandedItemIds.has(r.itemId) && (
                            <div className="mt-3 pt-3 border-t border-white/10">
                              <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-2">Contributions</p>
                              <div className="space-y-2">
                                {getContributionsForItem(r.itemId).map(row => {
                                  const ppp = prettyAmount(row.quantity, row.unit);
                                  return (
                                    <div key={row.key} className="flex items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                                      <div className="min-w-0">
                                        <p className="text-[12px] font-bold truncate">
                                          {row.title} <span className="text-slate-500 font-black">({dayShort(row.day)})</span>
                                        </p>
                                        <p className="text-[11px] text-slate-400">{`${formatQty(ppp.qty)} ${ppp.unit}`.trim()}</p>
                                      </div>
                                      {showCosts && <p className="text-[12px] font-black text-slate-200">{row.cost === null ? '€ —' : formatMoney(row.cost)}</p>}
                                    </div>
                                  );
                                })}
                                {getContributionsForItem(r.itemId).length === 0 && (
                                  <p className="text-slate-500 text-sm">No breakdown available for this item.</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCleanupPanel = () => {
    if (!cleanupOpen) return null;

    return (
      <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
        <div className="glass-panel w-full max-w-4xl rounded-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border-pink-500/20 bg-slate-950">
          <div className="p-5 border-b border-white/10 flex justify-between items-center bg-slate-900">
            <div>
              <p className="font-black text-lg">Cleanup</p>
              <p className="text-[11px] text-slate-500 mt-1">Quick actions for missing prices & pantry. (Totals view uses normalized prices per base unit.)</p>
            </div>
            <button onClick={() => setCleanupOpen(false)} className={iconBtn} title="Close">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="font-black">Missing prices</p>
                  <p className="text-[11px] text-slate-500">Set €/kg, €/l or €/pcs inline. Leaving blank removes stored price.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={smallBtn}
                    onClick={() => {
                      const keys = missingItemIds
                        .map(id => (visibleTotals as any[]).find(i => i.id === id)?.ingredientKey)
                        .filter(Boolean) as string[];
                      setPantrySet(prev => new Set([...Array.from(prev), ...keys]));
                    }}
                  >
                    Mark all as pantry
                  </button>
                  <button
                    className={smallBtn}
                    onClick={() => {
                      const keys = missingItemIds
                        .map(id => (visibleTotals as any[]).find(i => i.id === id)?.ingredientKey)
                        .filter(Boolean) as string[];
                      setPantrySet(prev => {
                        const next = new Set(prev);
                        keys.forEach(k => next.delete(k));
                        return next;
                      });
                    }}
                  >
                    Unmark pantry
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {!showCosts ? (
                  <p className="text-slate-500">Costs are off.</p>
                ) : missingItemIds.length === 0 ? (
                  <p className="text-slate-500">No missing prices 🎉</p>
                ) : (
                  missingItemIds.map(id => {
                    const it = (visibleTotals as any[]).find(i => i.id === id);
                    if (!it) return null;

                    const unit = String(it.unit || '');
                    const baseUnit = detectBaseUnitFromItemUnit(unit);

                    return (
                      <div key={`cleanup-${it.id}`} className="flex flex-col md:flex-row md:items-center gap-3 border border-white/10 bg-black/20 rounded-2xl p-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-black truncate">{it.label}</p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Amount:{' '}
                            <span className="text-slate-300 font-bold">{`${formatQty(prettyAmount(it.quantity, unit).qty)} ${prettyAmount(it.quantity, unit).unit}`}</span>
                            <span className="text-slate-600 mx-2">•</span>
                            Base: <span className="text-slate-300 font-bold">{baseUnit}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => togglePantry(it.ingredientKey)}
                            className={`px-3 py-2 rounded-xl text-[11px] font-black border transition-all ${
                              isPantry(it.ingredientKey)
                                ? 'bg-cyan-500/15 border-cyan-400/30 text-cyan-200'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                            }`}
                          >
                            <i className="fa-solid fa-box-archive mr-2"></i>
                            Pantry
                          </button>

                          <div className="w-[160px]">
                            <input
                              className={field}
                              placeholder={`€/ ${baseUnit}`}
                              onBlur={e => onPriceInput(it.ingredientKey, unit, e.currentTarget.value)}
                              inputMode="decimal"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="font-black">Export / Import</p>
              <p className="text-[11px] text-slate-500 mt-1">Useful to fill prices in a sheet and import back.</p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button className={smallBtn} onClick={handleExportShoppingCsv}>
                  <i className="fa-solid fa-file-csv mr-2"></i> Export Shopping CSV
                </button>
                <button className={smallBtn} onClick={handleExportPriceCsv}>
                  <i className="fa-solid fa-download mr-2"></i> Export Prices CSV
                </button>

                <label className={`${smallBtn} cursor-pointer`}>
                  <i className="fa-solid fa-upload mr-2"></i> Import Prices CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      handleImportPriceCsv(f);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-white/10 bg-slate-900 flex items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500">Tip: in Totals view, fill prices while shopping. Next week, costs are already there.</p>
            <button
              onClick={() => setCleanupOpen(false)}
              className="px-5 py-2 rounded-2xl font-black bg-pink-500 hover:bg-pink-400 text-white transition-all"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="animate-fadeIn">
      <div ref={listTopRef} className="text-center mb-10">
        <h2 className="text-4xl font-black mb-2">
          Shopping <span className="text-pink-400">List</span>
        </h2>
        <p className="text-slate-400">Shopping mode = fast checklist + inline prices. Cooking mode = per recipe breakdown.</p>
      </div>

      {/* Sticky summary / actions */}
      <div className="sticky top-0 z-[50] -mx-6 px-6 py-4 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 mb-6">
        <div className="container mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                <button onClick={applyShoppingPreset} className={pillBtn(mode === 'totals')}>
                  Shopping
                </button>
                <button onClick={applyCookingPreset} className={pillBtn(mode === 'by_recipe')}>
                  Cooking
                </button>
              </div>

              <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                <span className="text-[10px] uppercase font-black text-slate-500 ml-2 mr-1">Filters</span>
                <button onClick={() => setShowOnlyUnchecked(v => !v)} className={pillBtn(showOnlyUnchecked)}>
                  {showOnlyUnchecked ? 'Unchecked only' : 'Show all'}
                </button>
                <button onClick={() => setHidePantry(v => !v)} className={pillBtn(hidePantry)}>
                  {hidePantry ? 'Hide pantry' : 'Show pantry'}
                </button>
              </div>

              <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                <span className="text-[10px] uppercase font-black text-slate-500 ml-2 mr-1">Costs</span>
                <button onClick={() => setShowCosts(v => !v)} className={pillBtn(showCosts)}>
                  {showCosts ? 'On' : 'Off'}
                </button>
                <button
                  onClick={() => setExcludePantryFromTotalsCost(v => !v)}
                  className={pillBtn(excludePantryFromTotalsCost)}
                >
                  {excludePantryFromTotalsCost ? 'Exclude pantry' : 'Include pantry'}
                </button>
              </div>

              {mode === 'totals' && (
                <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                  <span className="text-[10px] uppercase font-black text-slate-500 ml-2 mr-1">Group</span>
                  <button onClick={() => setGroupByAisle(v => !v)} className={pillBtn(groupByAisle)}>
                    {groupByAisle ? 'By aisle' : 'Flat'}
                  </button>
                  <button onClick={() => setAutoExpandUnchecked(v => !v)} className={pillBtn(autoExpandUnchecked)}>
                    Auto expand
                  </button>

                  {groupByAisle && showCosts && (
                    <button onClick={() => setCollapseCompleteAisles(v => !v)} className={pillBtn(collapseCompleteAisles)}>
                      {collapseCompleteAisles ? 'Collapse complete' : 'Show complete'}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-left">
                  <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Status</p>
                  <p className="text-sm font-black text-slate-200">
                    {items.length} items • {checkedCount} checked • {pricedCoverageLabel}
                  </p>

                  {showCosts && mode === 'totals' && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      {totalsKnownSummary.missingCount === 0 ? (
                        <>
                          Total:{' '}
                          <span className="text-slate-200 font-black">{formatMoney(totalsKnownSummary.knownTotal)}</span>
                        </>
                      ) : (
                        <>
                          Known:{' '}
                          <span className="text-slate-200 font-black">{formatMoney(totalsKnownSummary.knownTotal)}</span>
                          <button
                            type="button"
                            onClick={jumpToNextMissing}
                            className="ml-2 text-slate-500 hover:text-white underline underline-offset-4"
                            title="Jump to next missing price"
                          >
                            • Missing prices: {totalsKnownSummary.missingCount}
                          </button>
                        </>
                      )}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={onGenerate} className={smallBtn} title="Generate from planner">
                  <i className="fa-solid fa-basket-shopping mr-2"></i> Generate
                </button>

                <button onClick={() => setCleanupOpen(true)} className={smallBtn} title="Cleanup panel">
                  <i className="fa-solid fa-broom mr-2"></i> Cleanup
                </button>

                <button onClick={handleCopy} className={iconBtn} title="Copy list">
                  <i className="fa-solid fa-copy"></i>
                </button>
                <button onClick={handlePrint} className={iconBtn} title="Print">
                  <i className="fa-solid fa-print"></i>
                </button>

                {mode === 'totals' && (
                  <>
                    <button onClick={expandAllVisible} className={iconBtn} title="Expand all visible">
                      <i className="fa-solid fa-down-left-and-up-right-to-center"></i>
                    </button>
                    <button onClick={collapseAll} className={iconBtn} title="Collapse all">
                      <i className="fa-solid fa-up-right-and-down-left-from-center"></i>
                    </button>
                  </>
                )}

                <button onClick={onResetChecks} className={smallBtn} title="Reset checks">
                  <i className="fa-solid fa-rotate-left mr-2"></i> Reset
                </button>

                <button
                  onClick={() => {
                    if (confirm('Clear the shopping list?')) onClear();
                  }}
                  className={`${smallBtn} hover:border-red-400/30 hover:bg-red-500/10`}
                  title="Clear list"
                >
                  <i className="fa-solid fa-trash mr-2"></i> Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-6">{mode === 'totals' ? renderTotals() : renderByRecipe()}</div>

      {renderCleanupPanel()}
    </section>
  );
};

export default ShoppingListView;
