import React, { useEffect, useMemo, useState } from 'react';
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

const AISLES: Aisle[] = [
  'Produce',
  'Dairy',
  'Meat',
  'Seafood',
  'Dry',
  'Spices',
  'Frozen',
  'Bakery',
  'Beverages',
  'Other',
];

const LS_AISLE_OVERRIDES = 'tokchef_aisle_overrides_v1';
const LS_PANTRY = 'tokchef_pantry_v1';

// Cost bundle storage
// price is stored PER ingredientKey + unit, in EUR per unit (e.g. €/g, €/ml, €/pcs)
const LS_PRICES = 'tokchef_prices_v1';

type PriceEntry = {
  ingredientKey: string;
  unit: string; // same unit as shopping item unit (e.g. g/ml/pcs)
  pricePerUnit: number; // EUR per unit
  updatedAt: number;
};

type PriceMap = Record<string, PriceEntry>; // key = `${ingredientKey}::${unit}`

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

const prettyPriceUnit = (unit: string, pricePerUnit: number): { unitLabel: string; price: number } => {
  if (!Number.isFinite(pricePerUnit)) return { unitLabel: `€/${unit}`, price: pricePerUnit };
  if (unit === 'g') return { unitLabel: '€/kg', price: pricePerUnit * 1000 };
  if (unit === 'ml') return { unitLabel: '€/l', price: pricePerUnit * 1000 };
  return { unitLabel: `€/${unit || 'unit'}`, price: pricePerUnit };
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

type PlannerOccurrence = {
  key: string; // `${day}-${idx}-${recipeId}`
  day: string;
  recipeId: string;
  idx: number;
  title: string;
};

type ContributionRow = {
  key: string; // occurrence key
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
  recipeCost: number | null; // null when missing prices
  pricedCoverage: { priced: number; total: number };
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
  const [mode, setMode] = useState<ViewMode>('totals');
  const [showOnlyUnchecked, setShowOnlyUnchecked] = useState(true);

  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());
  const [autoExpandUnchecked, setAutoExpandUnchecked] = useState(false);

  const [groupByAisle, setGroupByAisle] = useState(true);
  const [hidePantry, setHidePantry] = useState(false);

  const [showCosts, setShowCosts] = useState(true);
  const [excludePantryFromTotalsCost, setExcludePantryFromTotalsCost] = useState(true);

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

  const [prices, setPrices] = useState<PriceMap>(() => {
    try {
      const raw = localStorage.getItem(LS_PRICES);
      return raw ? (JSON.parse(raw) as PriceMap) : {};
    } catch {
      return {};
    }
  });

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
      localStorage.setItem(LS_PRICES, JSON.stringify(prices));
    } catch {
      // ignore
    }
  }, [prices]);

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
      const ids = planner?.[day] || [];
      ids.forEach((recipeId, idx) => {
        const title = recipeTitleById.get(recipeId) || 'Unknown recipe';
        out.push({
          key: `${day}-${idx}-${recipeId}`,
          day,
          recipeId,
          idx,
          title,
        });
      });
    });
    return out;
  }, [planner, recipeTitleById]);

  const hasParts = useMemo(() => items.some(i => Array.isArray(i.parts) && i.parts.length > 0), [items]);

  const getAisleForItem = (ingredientKey: string, label: string): Aisle => {
    return aisleOverrides[ingredientKey] || inferAisle(label, ingredientKey);
  };

  const isPantry = (ingredientKey: string) => pantrySet.has(ingredientKey);

  const priceKey = (ingredientKey: string, unit: string) => `${ingredientKey}::${unit || ''}`;

  const getPricePerUnit = (ingredientKey: string, unit: string): number | null => {
    const entry = prices[priceKey(ingredientKey, unit)];
    if (!entry) return null;
    if (!Number.isFinite(entry.pricePerUnit)) return null;
    return entry.pricePerUnit;
  };

  const setPricePerUnit = (ingredientKey: string, unit: string, pricePerUnit: number | null) => {
    const k = priceKey(ingredientKey, unit);
    setPrices(prev => {
      const next = { ...prev };
      if (pricePerUnit === null || !Number.isFinite(pricePerUnit)) {
        delete next[k];
      } else {
        next[k] = { ingredientKey, unit, pricePerUnit, updatedAt: Date.now() };
      }
      return next;
    });
  };

  const itemCost = (ingredientKey: string, unit: string, quantity: number): number | null => {
    const ppu = getPricePerUnit(ingredientKey, unit);
    if (ppu === null) return null;
    if (!Number.isFinite(quantity)) return null;
    return quantity * ppu;
  };

  const visibleTotals = useMemo(() => {
    let base = showOnlyUnchecked ? items.filter(i => !i.checked) : items;
    if (hidePantry) base = base.filter(i => !isPantry(i.ingredientKey));
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, showOnlyUnchecked, hidePantry, pantrySet]);

  useEffect(() => {
    if (mode !== 'totals') return;
    if (!autoExpandUnchecked) return;

    const next = new Set<string>();
    visibleTotals.forEach(i => {
      if (!i.checked) next.add(i.id);
    });
    setExpandedItemIds(next);
  }, [autoExpandUnchecked, mode, visibleTotals]);

  const totalsByAisle = useMemo(() => {
    const map = new Map<Aisle, typeof visibleTotals>();
    for (const a of AISLES) map.set(a, []);
    for (const it of visibleTotals) {
      const aisle = getAisleForItem(it.ingredientKey, it.label);
      map.get(aisle)!.push(it);
    }
    for (const a of AISLES) {
      map.set(
        a,
        (map.get(a) || []).slice().sort((x, y) => x.label.localeCompare(y.label))
      );
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleTotals, aisleOverrides]);

  const groups: RecipeGroup[] = useMemo(() => {
    if (!shoppingList) return [];

    const recipeById = new Map<string, Recipe>();
    recipes.forEach(r => recipeById.set(r.id, r));

    const out: RecipeGroup[] = [];

    DAY_ORDER.forEach(day => {
      const ids = planner?.[day] || [];
      ids.forEach((recipeId, idx) => {
        const recipe = recipeById.get(recipeId);
        const title = recipe?.title || 'Unknown recipe';

        const rowMap = new Map<string, RecipeGroupRow>();

        for (const it of items) {
          const parts = it.parts || [];
          const relevant = parts.filter(p => p.recipeId === recipeId && (p.day ? p.day === day : true));
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
          if (r.cost === null) {
            allPriced = false;
          } else {
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
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(i => {
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
          <div className="meta">Mode: ${mode === 'totals' ? 'Shopping (Totals)' : 'Cooking (By recipe)'} • Generated: ${new Date(
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
    const rows = visibleTotals.map(i => {
      const aisle = getAisleForItem(i.ingredientKey, i.label);
      const pantry = isPantry(i.ingredientKey) ? '1' : '0';
      const cost = showCosts ? itemCost(i.ingredientKey, String(i.unit || ''), i.quantity) : null;

      return {
        checked: i.checked ? '1' : '0',
        label: i.label,
        quantity: String(i.quantity ?? ''),
        unit: String(i.unit ?? ''),
        aisle,
        pantry,
        ingredientKey: i.ingredientKey,
        pricePerUnit: String(getPricePerUnit(i.ingredientKey, String(i.unit || '')) ?? ''),
        itemCost: String(cost ?? ''),
      };
    });

    const header = ['checked', 'label', 'quantity', 'unit', 'aisle', 'pantry', 'ingredientKey', 'pricePerUnit', 'itemCost'];
    const csv =
      header.join(',') +
      '\n' +
      rows.map(r => header.map(h => escapeCsv((r as any)[h])).join(',')).join('\n');

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadTextFile(`toktotable-shopping-${stamp}.csv`, csv, 'text/csv');
  };

  // ✅ FIXED: Object.values(prices) typed as PriceEntry[]
  const handleExportPriceCsv = () => {
    const entries = (Object.values(prices) as PriceEntry[]).sort((a, b) =>
      (a.ingredientKey + '::' + a.unit).localeCompare(b.ingredientKey + '::' + b.unit)
    );

    const header = ['ingredientKey', 'unit', 'pricePerUnit', 'updatedAt'];
    const csv =
      header.join(',') +
      '\n' +
      entries
        .map((e: PriceEntry) =>
          [e.ingredientKey, e.unit, String(e.pricePerUnit), String(e.updatedAt)].map(escapeCsv).join(',')
        )
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
    const idxUnit = header.indexOf('unit');
    const idxPrice = header.indexOf('pricePerUnit');

    if (idxKey === -1 || idxUnit === -1 || idxPrice === -1) {
      alert('CSV must have columns: ingredientKey, unit, pricePerUnit');
      return;
    }

    const parsed: PriceMap = {};
    let added = 0;

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

    for (let i = 1; i < lines.length; i++) {
      const cols = parseRow(lines[i]);
      const ingredientKey = cols[idxKey] || '';
      const unit = cols[idxUnit] || '';
      const priceStr = cols[idxPrice] || '';

      if (!ingredientKey || !unit) continue;

      const price = Number(String(priceStr).replace(',', '.'));
      if (!Number.isFinite(price) || price < 0) continue;

      const k = priceKey(ingredientKey, unit);
      parsed[k] = { ingredientKey, unit, pricePerUnit: price, updatedAt: Date.now() };
      added += 1;
    }

    if (added === 0) {
      alert('No valid price rows found.');
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
  };

  const applyCookingPreset = () => {
    setMode('by_recipe');
    setShowOnlyUnchecked(false);
    setAutoExpandUnchecked(false);
    setExpandedItemIds(new Set());
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
  const expandAllVisible = () => setExpandedItemIds(new Set(visibleTotals.map(i => i.id)));

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
    const item = items.find(i => i.id === itemId);
    if (!item) return [];
    const parts = item.parts || [];

    const rows: ContributionRow[] = [];
    for (const occ of plannerOccurrences) {
      const relevant = parts.filter(p => p.recipeId === occ.recipeId && (p.day ? p.day === occ.day : true));
      if (relevant.length === 0) continue;

      let qty = 0;
      let unit = String(item.unit || '');
      for (const p of relevant) {
        qty += Number(p.quantity || 0);
        unit = String(p.unit || unit);
      }
      if (qty === 0) continue;

      const cost = itemCost(item.ingredientKey, unit, qty);

      rows.push({
        key: occ.key,
        day: occ.day,
        title: occ.title,
        quantity: qty,
        unit,
        cost,
      });
    }
    return rows;
  };

  const totalsCostSummary = useMemo(() => {
    if (!showCosts) return { totalCost: null as number | null, priced: 0, total: 0, excludedPantry: 0 };

    let sum = 0;
    let priced = 0;
    let total = 0;
    let excludedPantry = 0;

    for (const it of visibleTotals) {
      total += 1;

      if (excludePantryFromTotalsCost && isPantry(it.ingredientKey)) {
        excludedPantry += 1;
        continue;
      }

      const c = itemCost(it.ingredientKey, String(it.unit || ''), it.quantity);
      if (c === null) continue;
      priced += 1;
      sum += c;
    }

    const allPriced = priced === (total - excludedPantry);
    return { totalCost: allPriced ? sum : null, priced, total, excludedPantry };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleTotals, showCosts, prices, excludePantryFromTotalsCost, pantrySet]);

  const weeklyCostSummary = useMemo(() => {
    if (!showCosts) return { totalCost: null as number | null, pricedRecipes: 0, totalRecipes: 0 };

    let sum = 0;
    let pricedRecipes = 0;
    let totalRecipes = 0;

    for (const g of groups) {
      if (g.rows.length === 0) continue;
      totalRecipes += 1;
      if (g.recipeCost === null) continue;
      pricedRecipes += 1;
      sum += g.recipeCost;
    }

    const allPriced = pricedRecipes === totalRecipes;
    return { totalCost: allPriced ? sum : null, pricedRecipes, totalRecipes };
  }, [groups, showCosts]);

  const totalVisibleRowsByRecipe = groups.reduce((acc, g) => acc + g.rows.length, 0);

  return (
    <section className="animate-fadeIn">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-black mb-2">
          Shopping <span className="text-pink-400">List</span>
        </h2>
        <p className="text-slate-400">
          {mode === 'totals'
            ? 'Shopping mode: totals (deduplicated). Aisles + pantry + prices.'
            : 'Cooking mode: grouped by recipe in planner order + recipe costs.'}
        </p>
      </div>

      <div className="glass-panel p-6 rounded-3xl border-white/5 bg-slate-900/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-5 mb-6">
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Status</p>
            <p className="text-sm text-slate-300 font-semibold">
              {items.length === 0
                ? 'No items yet.'
                : mode === 'totals'
                ? `${items.length} items • ${checkedCount} checked • ${visibleTotals.length} shown`
                : `${items.length} aggregated items • ${checkedCount} checked • ${totalVisibleRowsByRecipe} shown`}
            </p>

            {mode === 'totals' && !hasParts && items.length > 0 && (
              <p className="text-[11px] text-amber-300/90 mt-2">
                Tip: click <span className="font-bold">Generate (overwrite)</span> once to enable per-recipe breakdown.
              </p>
            )}

            {showCosts && items.length > 0 && (
              <div className="mt-3 text-[12px] text-slate-400 space-y-1">
                {mode === 'totals' ? (
                  <div>
                    <span className="font-bold text-slate-300">Totals cost:</span>{' '}
                    {totalsCostSummary.totalCost === null
                      ? `${totalsCostSummary.priced}/${Math.max(0, totalsCostSummary.total - totalsCostSummary.excludedPantry)} priced`
                      : formatMoney(totalsCostSummary.totalCost)}
                    {totalsCostSummary.excludedPantry > 0 && (
                      <span className="text-slate-500"> (excluded pantry: {totalsCostSummary.excludedPantry})</span>
                    )}
                  </div>
                ) : (
                  <div>
                    <span className="font-bold text-slate-300">Weekly cost:</span>{' '}
                    {weeklyCostSummary.totalCost === null
                      ? `${weeklyCostSummary.pricedRecipes}/${weeklyCostSummary.totalRecipes} recipes priced`
                      : formatMoney(weeklyCostSummary.totalCost)}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={onGenerate}
              className="px-5 py-2.5 rounded-2xl font-bold bg-pink-500 hover:bg-pink-400 text-white transition-all shadow-lg shadow-pink-900/20 flex items-center gap-2"
              title="Overwrite list from planner"
            >
              <i className="fa-solid fa-wand-magic-sparkles"></i>
              Generate (overwrite)
            </button>

            <button
              onClick={onResetChecks}
              className="px-5 py-2.5 rounded-2xl font-bold bg-white/10 hover:bg-white/15 text-slate-200 transition-all flex items-center gap-2"
              disabled={items.length === 0}
            >
              <i className="fa-solid fa-rotate-left"></i>
              Reset checks
            </button>

            <button
              onClick={handleCopy}
              className="px-5 py-2.5 rounded-2xl font-bold bg-white/10 hover:bg-white/15 text-slate-200 transition-all flex items-center gap-2"
              disabled={items.length === 0}
              title="Copy current view to clipboard"
            >
              <i className="fa-solid fa-copy"></i>
              Copy
            </button>

            <button
              onClick={handlePrint}
              className="px-5 py-2.5 rounded-2xl font-bold bg-white/10 hover:bg-white/15 text-slate-200 transition-all flex items-center gap-2"
              disabled={items.length === 0}
              title="Print current view"
            >
              <i className="fa-solid fa-print"></i>
              Print
            </button>

            <button
              onClick={handleExportShoppingCsv}
              className="px-5 py-2.5 rounded-2xl font-bold bg-white/10 hover:bg-white/15 text-slate-200 transition-all flex items-center gap-2"
              disabled={visibleTotals.length === 0}
              title="Export totals as CSV (includes prices if set)"
            >
              <i className="fa-solid fa-file-csv"></i>
              CSV
            </button>

            <button
              onClick={handleExportPriceCsv}
              className="px-5 py-2.5 rounded-2xl font-bold bg-white/10 hover:bg-white/15 text-slate-200 transition-all flex items-center gap-2"
              disabled={Object.keys(prices).length === 0}
              title="Export price book to CSV"
            >
              <i className="fa-solid fa-coins"></i>
              Prices CSV
            </button>

            <label
              className="px-5 py-2.5 rounded-2xl font-bold bg-white/10 hover:bg-white/15 text-slate-200 transition-all flex items-center gap-2 cursor-pointer"
              title="Import price book CSV (ingredientKey,unit,pricePerUnit)"
            >
              <i className="fa-solid fa-file-import"></i>
              Import Prices
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  handleImportPriceCsv(f).finally(() => {
                    e.currentTarget.value = '';
                  });
                }}
              />
            </label>

            <button
              onClick={() => {
                if (confirm('Clear shopping list?')) onClear();
              }}
              className="px-5 py-2.5 rounded-2xl font-bold bg-white/10 hover:bg-red-500/20 text-slate-200 hover:text-red-300 transition-all flex items-center gap-2"
              disabled={items.length === 0}
            >
              <i className="fa-solid fa-trash-can"></i>
              Clear
            </button>
          </div>
        </div>

        {/* Presets + Controls */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-white/5 p-1 rounded-2xl border border-white/10">
              <button
                onClick={applyShoppingPreset}
                className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                  mode === 'totals' && showOnlyUnchecked ? 'bg-pink-500 text-white' : 'text-slate-300 hover:text-white'
                }`}
                title="Totals + only unchecked + collapsed"
              >
                Shopping mode
              </button>
              <button
                onClick={applyCookingPreset}
                className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                  mode === 'by_recipe' ? 'bg-cyan-500 text-white' : 'text-slate-300 hover:text-white'
                }`}
                title="Grouped by recipe in planner order"
              >
                Cooking mode
              </button>
            </div>

            <div className="flex items-center gap-2 bg-white/5 p-1 rounded-2xl border border-white/10">
              <button
                onClick={() => setMode('totals')}
                className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                  mode === 'totals' ? 'bg-white/15 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Totals
              </button>
              <button
                onClick={() => setMode('by_recipe')}
                className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                  mode === 'by_recipe' ? 'bg-white/15 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                By recipe
              </button>
            </div>

            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={showOnlyUnchecked}
                onChange={e => setShowOnlyUnchecked(e.target.checked)}
                className="rounded border-white/20 bg-slate-800 text-pink-500 focus:ring-pink-500/20 w-5 h-5 cursor-pointer"
              />
              Only show unchecked
            </label>

            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={showCosts}
                onChange={e => setShowCosts(e.target.checked)}
                className="rounded border-white/20 bg-slate-800 text-pink-500 focus:ring-pink-500/20 w-5 h-5 cursor-pointer"
              />
              Show costs
            </label>

            {mode === 'totals' && (
              <>
                <label className="flex items-center gap-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={groupByAisle}
                    onChange={e => setGroupByAisle(e.target.checked)}
                    className="rounded border-white/20 bg-slate-800 text-pink-500 focus:ring-pink-500/20 w-5 h-5 cursor-pointer"
                  />
                  Group by aisle
                </label>

                <label className="flex items-center gap-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={hidePantry}
                    onChange={e => setHidePantry(e.target.checked)}
                    className="rounded border-white/20 bg-slate-800 text-pink-500 focus:ring-pink-500/20 w-5 h-5 cursor-pointer"
                  />
                  Hide pantry
                </label>

                <label className="flex items-center gap-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={excludePantryFromTotalsCost}
                    onChange={e => setExcludePantryFromTotalsCost(e.target.checked)}
                    className="rounded border-white/20 bg-slate-800 text-pink-500 focus:ring-pink-500/20 w-5 h-5 cursor-pointer"
                  />
                  Exclude pantry from totals cost
                </label>
              </>
            )}
          </div>

          {mode === 'totals' && (
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={autoExpandUnchecked}
                  onChange={e => setAutoExpandUnchecked(e.target.checked)}
                  className="rounded border-white/20 bg-slate-800 text-pink-500 focus:ring-pink-500/20 w-5 h-5 cursor-pointer"
                />
                Auto-expand unchecked
              </label>

              <button
                onClick={expandAllVisible}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-slate-200 transition-all"
                disabled={visibleTotals.length === 0}
                title="Expand all visible items"
              >
                Expand all
              </button>
              <button
                onClick={collapseAll}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-slate-200 transition-all"
                disabled={visibleTotals.length === 0}
                title="Collapse all items"
              >
                Collapse all
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        {items.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-3xl">
            <i className="fa-solid fa-basket-shopping text-4xl text-slate-700 mb-4"></i>
            <p className="text-slate-500 font-medium">Generate your list from the Planner.</p>
          </div>
        ) : mode === 'totals' ? (
          visibleTotals.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-3xl">
              <i className="fa-solid fa-check text-4xl text-slate-700 mb-4"></i>
              <p className="text-slate-500 font-medium">Nothing to buy (given your filters) 🎉</p>
            </div>
          ) : (
            <div className="space-y-5">
              {(groupByAisle ? AISLES : (['__ALL__'] as any)).map((aisle: Aisle | '__ALL__') => {
                const list =
                  aisle === '__ALL__'
                    ? visibleTotals.slice().sort((a, b) => a.label.localeCompare(b.label))
                    : totalsByAisle.get(aisle as Aisle) || [];
                if (list.length === 0) return null;

                return (
                  <div key={String(aisle)} className="rounded-3xl border border-white/10 bg-slate-950/30 overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                          {aisle === '__ALL__' ? 'All items' : aisle}
                        </p>
                        <h3 className="font-black text-slate-100 truncate">{aisle === '__ALL__' ? 'Totals' : `${aisle}`}</h3>
                      </div>
                      <div className="text-xs text-slate-500 font-bold flex-shrink-0">
                        {list.length} item{list.length === 1 ? '' : 's'}
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      {list.map(item => {
                        const p = prettyAmount(item.quantity, String(item.unit || ''));
                        const amount = `${formatQty(p.qty)} ${p.unit}`.trim();
                        const expanded = expandedItemIds.has(item.id);

                        const sources = item.sources || [];
                        const aisleEffective = getAisleForItem(item.ingredientKey, item.label);
                        const overridden = aisleOverrides[item.ingredientKey] !== undefined;
                        const pantry = isPantry(item.ingredientKey);

                        const unit = String(item.unit || '');
                        const ppu = getPricePerUnit(item.ingredientKey, unit);
                        const c = showCosts ? itemCost(item.ingredientKey, unit, item.quantity) : null;

                        const prettyPpu = ppu === null ? null : prettyPriceUnit(unit, ppu);

                        const contributions = expanded && hasParts ? getContributionsForItem(item.id) : [];

                        return (
                          <div
                            key={item.id}
                            className={`rounded-2xl border transition-all overflow-hidden ${
                              item.checked
                                ? 'bg-emerald-500/5 border-emerald-500/20 opacity-90'
                                : 'bg-slate-950/40 border-white/5 hover:border-pink-500/20'
                            }`}
                          >
                            <div className="p-4">
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-4 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={item.checked}
                                    onChange={() => onToggleItem(item.id)}
                                    className="rounded border-white/20 bg-slate-800 text-pink-500 focus:ring-pink-500/20 w-5 h-5 cursor-pointer"
                                  />

                                  <button
                                    onClick={() => toggleExpanded(item.id)}
                                    className="text-left min-w-0 flex items-center gap-3 group"
                                    title={expanded ? 'Hide details' : 'Show details'}
                                  >
                                    <i
                                      className={`fa-solid ${
                                        expanded ? 'fa-chevron-down' : 'fa-chevron-right'
                                      } text-slate-500 group-hover:text-slate-200 transition-colors`}
                                    ></i>

                                    <div className="min-w-0">
                                      <p
                                        className={`font-bold truncate ${
                                          item.checked ? 'text-emerald-200 line-through' : 'text-slate-100'
                                        }`}
                                      >
                                        {item.label}
                                      </p>
                                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold flex gap-2 flex-wrap">
                                        <span>{sources.length} source{sources.length === 1 ? '' : 's'}</span>
                                        <span>•</span>
                                        <span>{aisleEffective}</span>
                                        {pantry && (
                                          <>
                                            <span>•</span>
                                            <span className="text-amber-300/90">Pantry</span>
                                          </>
                                        )}
                                        {overridden && (
                                          <>
                                            <span>•</span>
                                            <span className="text-cyan-300/90">Override</span>
                                          </>
                                        )}
                                      </p>
                                    </div>
                                  </button>
                                </div>

                                <div className="text-right flex-shrink-0">
                                  <p className="font-black text-slate-200">{amount}</p>
                                  {showCosts && <p className="text-xs text-slate-400 font-bold">{c === null ? '€ —' : formatMoney(c)}</p>}
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2 items-center">
                                <button
                                  onClick={() => togglePantry(item.ingredientKey)}
                                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                    pantry ? 'bg-amber-500/20 text-amber-200' : 'bg-white/10 hover:bg-white/15 text-slate-200'
                                  }`}
                                  title="Mark as pantry item (already have it)"
                                >
                                  <i className={`fa-solid ${pantry ? 'fa-box' : 'fa-box-open'} mr-2`}></i>
                                  Pantry
                                </button>

                                <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                                  <span className="text-[10px] uppercase font-black tracking-widest text-slate-500 ml-2">Aisle</span>
                                  <select
                                    value={aisleEffective}
                                    onChange={e => setOverride(item.ingredientKey, e.target.value as Aisle)}
                                    className="bg-transparent text-slate-200 text-xs font-bold px-2 py-1 outline-none"
                                    title="Override aisle for this ingredient"
                                  >
                                    {AISLES.map(a => (
                                      <option key={a} value={a}>
                                        {a}
                                      </option>
                                    ))}
                                  </select>

                                  <button
                                    onClick={() => clearOverride(item.ingredientKey)}
                                    className="px-2 py-1 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/15 text-slate-200 transition-all"
                                    disabled={!overridden}
                                    title="Clear override"
                                  >
                                    Reset
                                  </button>
                                </div>

                                {showCosts && (
                                  <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-500 ml-2">Price</span>

                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      step="0.01"
                                      min="0"
                                      placeholder="€ / unit"
                                      value={ppu === null ? '' : String(ppu)}
                                      onChange={e => {
                                        const v = e.target.value;
                                        if (v.trim() === '') {
                                          setPricePerUnit(item.ingredientKey, unit, null);
                                          return;
                                        }
                                        const n = Number(v);
                                        if (!Number.isFinite(n) || n < 0) return;
                                        setPricePerUnit(item.ingredientKey, unit, n);
                                      }}
                                      className="bg-transparent text-slate-200 text-xs font-bold px-2 py-1 outline-none w-28"
                                      title={`Price per ${unit || 'unit'} (stored locally)`}
                                    />

                                    <span className="text-xs text-slate-500 font-bold mr-2">{unit ? `€/${unit}` : ''}</span>

                                    {prettyPpu && (
                                      <span className="text-xs text-slate-400 font-bold mr-2">
                                        {prettyPpu.unitLabel}: {formatMoney(prettyPpu.price)}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {expanded && (
                              <div className="px-4 pb-4">
                                {hasParts ? (
                                  contributions.length === 0 ? (
                                    <div className="mt-2 text-[11px] text-slate-500">No per-recipe contributions found.</div>
                                  ) : (
                                    <div className="mt-3 pt-3 border-t border-white/10">
                                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">
                                        Per recipe (planner order)
                                      </p>
                                      <div className="flex flex-col gap-2">
                                        {contributions.map((cRow, idx) => {
                                          const pp = prettyAmount(cRow.quantity, cRow.unit);
                                          const aa = `${formatQty(pp.qty)} ${pp.unit}`.trim();
                                          const costStr =
                                            showCosts && cRow.cost !== null ? formatMoney(cRow.cost) : showCosts ? '€ —' : '';

                                          return (
                                            <div
                                              key={`${item.id}-c-${cRow.key}-${idx}`}
                                              className="text-xs text-slate-300 flex items-center justify-between gap-4 bg-white/5 border border-white/10 rounded-xl px-3 py-2"
                                            >
                                              <span className="truncate">{cRow.title}</span>
                                              <div className="flex items-center gap-3 flex-shrink-0">
                                                <span className="text-slate-500 font-bold">{dayShort(cRow.day) || '—'}</span>
                                                <span className="text-slate-200 font-black">{aa}</span>
                                                {showCosts && <span className="text-slate-300 font-black">{costStr}</span>}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )
                                ) : (
                                  <div className="mt-3 pt-3 border-t border-white/10">
                                    <p className="text-[11px] text-slate-500">
                                      This list has no breakdown yet. Click <span className="font-bold">Generate (overwrite)</span> once.
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="space-y-5">
            {groups.map(group => {
              if (group.rows.length === 0) return null;

              const costLabel =
                showCosts && group.pricedCoverage.total > 0
                  ? group.recipeCost === null
                    ? `${group.pricedCoverage.priced}/${group.pricedCoverage.total} priced`
                    : formatMoney(group.recipeCost)
                  : null;

              return (
                <div key={group.key} className="rounded-3xl border border-white/10 bg-slate-950/30 overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{dayShort(group.day)}</p>
                      <h3 className="font-black text-slate-100 truncate">{group.title}</h3>
                      {showCosts && <p className="text-xs text-slate-400 font-bold mt-1">Recipe cost: {costLabel ?? '—'}</p>}
                    </div>
                    <div className="text-xs text-slate-500 font-bold flex-shrink-0">
                      {group.rows.length} item{group.rows.length === 1 ? '' : 's'}
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    {group.rows.map(row => {
                      const pp = prettyAmount(row.quantity, row.unit);
                      const amount = `${formatQty(pp.qty)} ${pp.unit}`.trim();
                      const costStr = showCosts ? (row.cost === null ? '€ —' : formatMoney(row.cost)) : '';

                      return (
                        <div
                          key={`${group.key}-${row.itemId}-${row.unit}`}
                          className={`flex items-center justify-between gap-4 p-3 rounded-2xl border transition-all ${
                            row.checked
                              ? 'bg-emerald-500/5 border-emerald-500/20 opacity-80'
                              : 'bg-slate-950/40 border-white/5 hover:border-pink-500/20'
                          }`}
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <input
                              type="checkbox"
                              checked={row.checked}
                              onChange={() => onToggleItem(row.itemId)}
                              className="rounded border-white/20 bg-slate-800 text-pink-500 focus:ring-pink-500/20 w-5 h-5 cursor-pointer"
                            />
                            <p className={`font-bold truncate ${row.checked ? 'text-emerald-200 line-through' : 'text-slate-100'}`}>
                              {row.label}
                            </p>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <p className="font-black text-slate-200">{amount}</p>
                            {showCosts && <p className="text-xs text-slate-400 font-bold">{costStr}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {shoppingList && (
          <div className="mt-8 text-[10px] text-slate-600 flex flex-wrap gap-3 justify-between">
            <span>List ID: {shoppingList.id}</span>
            <span>Updated: {new Date(shoppingList.updatedAt).toLocaleString()}</span>
          </div>
        )}
      </div>
    </section>
  );
};

export default ShoppingListView;
