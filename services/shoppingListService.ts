import {
  Ingredient,
  PlannerData,
  Recipe,
  ShoppingItem,
  ShoppingList,
  ShoppingSourceRef,
  ShoppingUnit,
  ShoppingPart,
} from '../types';

type UnitConversion = { to: 'g' | 'ml'; factor: number };

const UNIT_ALIASES: Record<string, string> = {
  gram: 'g',
  grams: 'g',
  grm: 'g',

  kilogram: 'kg',
  kilograms: 'kg',

  milliliter: 'ml',
  milliliters: 'ml',

  liter: 'l',
  liters: 'l',

  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tbspn: 'tbsp',

  teaspoon: 'tsp',
  teaspoons: 'tsp',
  tspn: 'tsp',

  piece: 'pcs',
  pieces: 'pcs',
};

const UNIT_MAP: Record<string, UnitConversion> = {
  kg: { to: 'g', factor: 1000 },
  g: { to: 'g', factor: 1 },

  l: { to: 'ml', factor: 1000 },
  ml: { to: 'ml', factor: 1 },

  tbsp: { to: 'ml', factor: 15 },
  tsp: { to: 'ml', factor: 5 },
};

const COUNT_UNITS = new Set(['pcs', 'piece', 'pieces', 'clove', 'cloves', 'can', 'cans']);

/**
 * Parse quantity into a number where possible.
 * Supports:
 * - number
 * - "2"
 * - "1.5"
 * - "1/2"
 * - "1 1/2"
 */
export function parseQuantity(input: string | number): number | null {
  if (typeof input === 'number' && Number.isFinite(input)) return input;

  const s = String(input ?? '').trim();
  if (!s) return null;

  // "1 1/2"
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const num = Number(mixed[2]);
    const den = Number(mixed[3]);
    if (den !== 0) return whole + num / den;
  }

  // "1/2"
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)/);
  if (frac) {
    const num = Number(frac[1]);
    const den = Number(frac[2]);
    if (den !== 0) return num / den;
  }

  // "1.5" or "2"
  const num = s.match(/^(\d+(\.\d+)?)/);
  if (num) {
    const val = Number(num[1]);
    return Number.isFinite(val) ? val : null;
  }

  return null;
}

export function normalizeUnit(rawUnit: string): string {
  const low = String(rawUnit ?? '').toLowerCase().trim();
  if (!low) return '';
  return UNIT_ALIASES[low] || low;
}

export function ingredientKeyFromIngredient(ing: Ingredient): string {
  const base = (ing.normalized_name || ing.name || '').toLowerCase().trim();
  return (
    base
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_') || 'unknown'
  );
}

export function displayLabelFromIngredient(ing: Ingredient): string {
  const label = (ing.name || ing.normalized_name || 'Unknown').trim();
  return label || 'Unknown';
}

export function normalizeQuantityAndUnit(
  quantity: string | number,
  unit: string
): { quantity: number | null; unit: ShoppingUnit } {
  const q = parseQuantity(quantity);
  const u = normalizeUnit(unit);

  if (q === null) {
    return { quantity: null, unit: u || '' };
  }

  // canonical counts
  if (!u || COUNT_UNITS.has(u)) {
    return { quantity: q, unit: 'pcs' };
  }

  const conv = UNIT_MAP[u];
  if (conv) {
    return { quantity: q * conv.factor, unit: conv.to };
  }

  // Unknown unit => keep as-is; do not merge with other units.
  return { quantity: q, unit: u };
}

export function buildShoppingListFromPlanner(planner: PlannerData, recipes: Recipe[]): ShoppingList {
  const now = Date.now();

  const byId = new Map<string, Recipe>();
  recipes.forEach(r => byId.set(r.id, r));

  const raw: Array<{ ing: Ingredient; src: ShoppingSourceRef }> = [];

  Object.keys(planner || {}).forEach(day => {
    const ids = planner[day] || [];
    ids.forEach(recipeId => {
      const r = byId.get(recipeId);
      if (!r) return;
      (r.ingredients || []).forEach(ing => {
        raw.push({ ing, src: { recipeId, day } });
      });
    });
  });

  const grouped = new Map<string, ShoppingItem>();

  for (const entry of raw) {
    const key = ingredientKeyFromIngredient(entry.ing);
    const label = displayLabelFromIngredient(entry.ing);

    const { quantity, unit } = normalizeQuantityAndUnit(entry.ing.quantity, entry.ing.unit);

    // If we can't parse quantity -> separate bucket to avoid lying.
    const unitBucket = quantity === null ? `raw_${normalizeUnit(entry.ing.unit) || 'unknown'}` : String(unit || 'unknown');
    const mergeKey = `${key}::${unitBucket}`;

    const part: ShoppingPart = {
      recipeId: entry.src.recipeId,
      day: entry.src.day,
      quantity: quantity ?? 0,
      unit: unitBucket.startsWith('raw_') ? normalizeUnit(entry.ing.unit) || '' : unit,
    };

    if (!grouped.has(mergeKey)) {
      grouped.set(mergeKey, {
        id: `shopitem-${now}-${Math.random().toString(16).slice(2)}`,
        ingredientKey: key,
        label,
        quantity: quantity ?? 0,
        unit: unitBucket.startsWith('raw_') ? normalizeUnit(entry.ing.unit) || '' : unit,
        checked: false,
        sources: [entry.src],
        parts: [part],
      });
    } else {
      const existing = grouped.get(mergeKey)!;
      existing.quantity = (existing.quantity || 0) + (quantity ?? 0);
      existing.sources = [...existing.sources, entry.src];
      existing.parts = [...existing.parts, part];
    }
  }

  const items = Array.from(grouped.values()).sort((a, b) => a.label.localeCompare(b.label));

  return {
    id: `shopping-${now}`,
    source: 'planner',
    items,
    createdAt: now,
    updatedAt: now,
  };
}

export function toggleItem(list: ShoppingList, itemId: string): ShoppingList {
  const items = list.items.map(it => (it.id === itemId ? { ...it, checked: !it.checked } : it));
  return { ...list, items, updatedAt: Date.now() };
}

export function resetChecks(list: ShoppingList): ShoppingList {
  const items = list.items.map(it => ({ ...it, checked: false }));
  return { ...list, items, updatedAt: Date.now() };
}

export function clearList(): ShoppingList {
  const now = Date.now();
  return {
    id: `shopping-${now}`,
    source: 'planner',
    items: [],
    createdAt: now,
    updatedAt: now,
  };
}
