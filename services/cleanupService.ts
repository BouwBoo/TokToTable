// services/cleanupService.ts

export type CleanupCategory = 'keys' | 'units' | 'prices' | 'pantry' | 'aisles';

export type CleanupSuggestion = {
  id: string;
  category: CleanupCategory;
  title: string;
  detail?: string;
  severity: 'low' | 'medium' | 'high';
  affectedCount?: number;
  // Optional payload for future "apply" (we don't execute anything in v1)
  payload?: unknown;
};

type ShoppingItemLike = {
  id: string;
  ingredientKey: string;
  label: string;
  unit?: string;
  quantity?: number;
  checked?: boolean;
};

type NormalizedPriceEntry = {
  ingredientKey: string;
  baseUnit: 'kg' | 'l' | 'pcs';
  pricePerBaseUnit: number;
  updatedAt: number;
};

type NormalizedPriceMap = Record<string, NormalizedPriceEntry>;

const normalizedKey = (ingredientKey: string, baseUnit: 'kg' | 'l' | 'pcs') => `${ingredientKey}::${baseUnit}`;

const detectBaseUnitFromItemUnit = (unitRaw: string): 'kg' | 'l' | 'pcs' => {
  const u = String(unitRaw || '').toLowerCase().trim();
  if (u === 'g' || u === 'kg') return 'kg';
  if (u === 'ml' || u === 'l') return 'l';
  if (u === 'pcs' || u === 'pc' || u === 'piece' || u === 'pieces' || u === 'stk' || u === 'st') return 'pcs';
  return 'pcs';
};

const isSnakeCase = (s: string) => /^[a-z0-9]+(_[a-z0-9]+)*$/.test(s);

const normalizeKeyFromLabel = (label: string) => {
  return String(label || '')
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const ALLOWED_UNITS = new Set([
  'g',
  'kg',
  'ml',
  'l',
  'pcs',
  'pc',
  'st',
  'stk',
  // optional “cooking” units that may appear
  'tbsp',
  'tsp',
  'cup',
]);

export function buildCleanupSuggestions(args: {
  items: ShoppingItemLike[];
  visibleItems?: ShoppingItemLike[]; // if you want to respect filters (unchecked/pantry hidden), pass this
  pantrySet: Set<string>;
  aisleOverrides: Record<string, string>;
  prices: NormalizedPriceMap;
}): CleanupSuggestion[] {
  const items = args.items || [];
  const scope = args.visibleItems && args.visibleItems.length ? args.visibleItems : items;

  const suggestions: CleanupSuggestion[] = [];

  // 1) Ingredient keys that look “dirty”
  const badKey = scope.filter(it => {
    const k = String(it.ingredientKey || '').trim();
    if (!k) return true;
    if (k.length < 2) return true;
    if (!isSnakeCase(k)) return true;
    if (k === 'unknown' || k === 'n_a') return true;
    return false;
  });

  if (badKey.length) {
    // Show top examples
    const examples = badKey
      .slice(0, 6)
      .map(it => `"${it.label}" → "${it.ingredientKey || '(empty)'}" (suggest: "${normalizeKeyFromLabel(it.label)}")`)
      .join('\n');

    suggestions.push({
      id: 'keys-1',
      category: 'keys',
      title: `Ingredient keys opschonen (${badKey.length})`,
      detail:
        `Deze items hebben een lege of niet-snake_case ingredientKey.\n\nVoorbeelden:\n${examples}\n\n` +
        `Actie (handmatig in v1): bepaal vaste ingredientKey’s (snake_case) zodat pantry/prices/aisle consistent worden.`,
      severity: 'high',
      affectedCount: badKey.length,
    });
  }

  // 2) Units die niet in het “normale” setje zitten
  const weirdUnits = scope.filter(it => {
    const u = String(it.unit || '').toLowerCase().trim();
    if (!u) return false; // leeg = ok-ish (wordt vaak als pcs behandeld)
    return !ALLOWED_UNITS.has(u);
  });

  if (weirdUnits.length) {
    const examples = weirdUnits
      .slice(0, 8)
      .map(it => `${it.label}: "${String(it.unit || '')}"`)
      .join('\n');

    suggestions.push({
      id: 'units-1',
      category: 'units',
      title: `Units check (${weirdUnits.length})`,
      detail:
        `Deze items hebben “rare” units. Dat maakt totals + prijsberekening onbetrouwbaar.\n\nVoorbeelden:\n${examples}\n\n` +
        `Actie (handmatig in v1): converteer naar g/ml/pcs waar mogelijk.`,
      severity: 'medium',
      affectedCount: weirdUnits.length,
    });
  }

  // 3) Missing prices (respect your normalized pricing scheme kg/l/pcs)
  const missingPrices = scope.filter(it => {
    const key = String(it.ingredientKey || '').trim();
    if (!key) return false;
    const baseUnit = detectBaseUnitFromItemUnit(String(it.unit || ''));
    const entry = args.prices[normalizedKey(key, baseUnit)];
    if (!entry) return true;
    if (!Number.isFinite(entry.pricePerBaseUnit)) return true;
    return false;
  });

  if (missingPrices.length) {
    const examples = missingPrices
      .slice(0, 10)
      .map(it => {
        const baseUnit = detectBaseUnitFromItemUnit(String(it.unit || ''));
        return `${it.label} (${it.ingredientKey} • base ${baseUnit})`;
      })
      .join('\n');

    suggestions.push({
      id: 'prices-1',
      category: 'prices',
      title: `Prijzen ontbreken (${missingPrices.length})`,
      detail:
        `Voor deze items ontbreekt een prijs in jouw normalized store (€/kg, €/l, €/pcs).\n\nVoorbeelden:\n${examples}\n\n` +
        `Actie (handmatig in v1): vul pricePerBaseUnit in via de UI (Prices) of importeer CSV.`,
      severity: 'medium',
      affectedCount: missingPrices.length,
    });
  }

  // 4) Pantry sanity: keys die mogelijk pantry zouden moeten zijn (heuristiek)
  const pantryCandidates = scope.filter(it => {
    const k = `${it.label} ${it.ingredientKey}`.toLowerCase();
    // simpele heuristiek: “sauces/spices/dry” achtig
    const looksPantry = /(salt|pepper|oil|olive|vinegar|soy|sauce|ketchup|mustard|mayo|flour|sugar|honey|rice|pasta|noodle|spice|cumin|paprika|oregano|thyme|stock|broth)/.test(
      k
    );
    if (!looksPantry) return false;
    const key = String(it.ingredientKey || '').trim();
    if (!key) return false;
    return !args.pantrySet.has(key);
  });

  if (pantryCandidates.length) {
    const examples = pantryCandidates
      .slice(0, 10)
      .map(it => `${it.label} (${it.ingredientKey})`)
      .join('\n');

    suggestions.push({
      id: 'pantry-1',
      category: 'pantry',
      title: `Pantry candidates (${pantryCandidates.length})`,
      detail:
        `Deze items lijken pantry (blijvers) maar staan nog niet als pantry gemarkeerd.\n\nVoorbeelden:\n${examples}\n\n` +
        `Actie (handmatig in v1): markeer als pantry zodat ze optioneel verborgen/uitgesloten kunnen worden.`,
      severity: 'low',
      affectedCount: pantryCandidates.length,
    });
  }

  // 5) Aisle overrides: alleen zinvol als je overrides gebruikt; we kunnen “missing override” als suggestie doen
  // (Dit is bewust low-noise: alleen als je overrides al gebruikt.)
  const hasAnyOverrides = Object.keys(args.aisleOverrides || {}).length > 0;
  if (hasAnyOverrides) {
    const missingOverride = scope.filter(it => {
      const key = String(it.ingredientKey || '').trim();
      if (!key) return false;
      return !(key in args.aisleOverrides);
    });

    if (missingOverride.length >= 12) {
      suggestions.push({
        id: 'aisles-1',
        category: 'aisles',
        title: `Aisles: nog te weinig overrides (${missingOverride.length} zonder override)`,
        detail:
          `Je gebruikt aisle overrides, maar veel items vallen terug op inferAisle().\n` +
          `Actie (handmatig in v1): zet overrides voor jouw “top 20” ingredients voor stabiele indeling.`,
        severity: 'low',
        affectedCount: missingOverride.length,
      });
    }
  }

  return suggestions;
}
