import { z } from 'zod';

export interface ExternalDrugInformation {
  brandNames: string[];
  genericName?: string;
  mechanism?: string;
  therapeuticClass?: string;
  indications?: string[];
  dosageAndAdministration?: string[];
  dosageForms?: string[];
  warnings?: string[];
  source: string;
  openFdaId?: string;
}

const OpenFdaResultSchema = z.object({
  id: z.string().optional(),
  set_id: z.string().optional(),
  openfda: z
    .object({
      brand_name: z.array(z.string()).optional(),
      generic_name: z.array(z.string()).optional(),
      substance_name: z.array(z.string()).optional(),
      pharm_class_epc: z.array(z.string()).optional(),
      pharm_class_cs: z.array(z.string()).optional(),
    })
    .optional(),
  indications_and_usage: z.array(z.string()).optional(),
  dosage_and_administration: z.array(z.string()).optional(),
  dosage_forms_and_strengths: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
  boxed_warning: z.array(z.string()).optional(),
  mechanism_of_action: z.array(z.string()).optional(),
});

const OpenFdaResponseSchema = z.object({
  results: z.array(OpenFdaResultSchema).optional(),
});

type OpenFdaResult = z.infer<typeof OpenFdaResultSchema>;

function normalizeTerm(term: string): string {
  return term
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|units)?\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(term: string): string[] {
  return normalizeTerm(term)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

function buildSearchTerms(term: string): string[] {
  const base = normalizeTerm(term);
  const tokens = tokenize(term);
  const terms = new Set<string>();

  if (base) {
    terms.add(base);
  }

  for (const token of tokens) {
    terms.add(token);
  }

  return Array.from(terms).filter(Boolean);
}

function collectCandidateNames(record: OpenFdaResult): string[] {
  const names: string[] = [];
  const openfda = record.openfda ?? {};

  if (openfda.brand_name) {
    names.push(...openfda.brand_name);
  }

  if (openfda.generic_name) {
    names.push(...openfda.generic_name);
  }

  if (openfda.substance_name) {
    names.push(...openfda.substance_name);
  }

  if (record.indications_and_usage) {
    names.push(...record.indications_and_usage);
  }

  if (record.mechanism_of_action) {
    names.push(...record.mechanism_of_action);
  }

  return names;
}

function computeMatchScore(record: OpenFdaResult, searchTerms: string[]): number {
  const normalizedNames = collectCandidateNames(record)
    .map((name) => normalizeTerm(name))
    .filter(Boolean);

  if (!normalizedNames.length) {
    return -5;
  }

  let score = 0;

  for (const term of searchTerms) {
    const tokens = tokenize(term);
    for (const name of normalizedNames) {
      if (!name) {
        continue;
      }

      if (name === term) {
        score += 15;
      } else if (name.includes(term)) {
        score += 8;
      } else if (tokens.length > 1 && tokens.every((token) => name.includes(token))) {
        score += 6;
      } else if (tokens.some((token) => name.includes(token))) {
        score += 3;
      }
    }
  }

  const homeopathicSignals = ['homeopathic', 'homeopathy', 'non-standardized'];
  if (
    normalizedNames.some((name) =>
      homeopathicSignals.some((signal) => name.includes(signal))
    )
  ) {
    score -= 10;
  }

  return score;
}

function pickBestRecord(results: OpenFdaResult[], searchTerms: string[]): OpenFdaResult | undefined {
  let best: { score: number; record?: OpenFdaResult } = { score: Number.NEGATIVE_INFINITY };

  for (const record of results) {
    const score = computeMatchScore(record, searchTerms);
    if (score > best.score) {
      best = { score, record };
    }
  }

  return best.score >= 5 ? best.record : undefined;
}

function sanitizeDrugName(drugName: string): string {
  return drugName.replace(/[^a-z0-9\s\-]/gi, ' ').replace(/\s+/g, ' ').trim();
}

function splitParagraphs(values?: string[]): string[] | undefined {
  if (!values?.length) return undefined;
  return values
    .flatMap((entry) => entry.split(/\n+/g))
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5);
}

export async function fetchDrugInformation(drugName: string, signal?: AbortSignal): Promise<ExternalDrugInformation | null> {
  const sanitizedName = sanitizeDrugName(drugName);
  if (!sanitizedName) {
    return null;
  }

  const searchTerms = buildSearchTerms(sanitizedName);
  if (!searchTerms.length) {
    return null;
  }

  const searchQuery = searchTerms
    .slice(0, 6)
    .map(
      (term) =>
        `(openfda.brand_name:"${term}" OR openfda.generic_name:"${term}" OR openfda.substance_name:"${term}")`
    )
    .join(' OR ');

  if (!searchQuery) {
    return null;
  }

  const url = `https://api.fda.gov/drug/label.json?search=${encodeURIComponent(searchQuery)}&limit=5`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal,
    });

    if (!response.ok) {
      console.warn('[DrugInformationService] OpenFDA request failed:', response.status, response.statusText);
      return null;
    }

    const json = await response.json();
    const parsed = OpenFdaResponseSchema.safeParse(json);

    if (!parsed.success || !parsed.data.results?.length) {
      return null;
    }

    const record = pickBestRecord(parsed.data.results, searchTerms);
    if (!record) {
      return null;
    }
    const openfda = record.openfda ?? {};

    const therapeuticClass = openfda.pharm_class_epc?.[0] || openfda.pharm_class_cs?.[0];

    return {
      brandNames: openfda.brand_name ?? [],
      genericName: openfda.generic_name?.[0] ?? openfda.substance_name?.[0],
      mechanism: record.mechanism_of_action?.[0],
      therapeuticClass,
      indications: splitParagraphs(record.indications_and_usage),
      dosageAndAdministration: splitParagraphs(record.dosage_and_administration),
      dosageForms: splitParagraphs(record.dosage_forms_and_strengths),
      warnings: splitParagraphs(record.boxed_warning ?? record.warnings),
      source: 'U.S. FDA Drug Label (OpenFDA)',
      openFdaId: record.set_id ?? record.id,
    };
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.warn('[DrugInformationService] OpenFDA request aborted');
      return null;
    }

    console.error('[DrugInformationService] Failed to fetch drug information:', error);
    return null;
  }
}
