export interface ConversionOptions {
  /** Leave URLs, email addresses and code spans untouched. Default true. */
  protectSpans?: boolean;
  /** Additional literal strings never to convert (brand names, proper nouns). */
  protectedTerms?: string[];
  /** Word-level overrides applied before rule-based conversion, longest match first. */
  exceptions?: Record<string, string>;
  /** Treat `ng` as an unchanged digraph. Default true. See README TODO. */
  ngAsDigraph?: boolean;
}

export interface Warning {
  index: number;
  length: number;
  rule: string;
  message: string;
  alternatives?: string[];
}

export interface ConversionResult {
  text: string;
  warnings: Warning[];
}

export type Alphabet = 'cyrillic' | 'old-latin' | 'new-latin' | 'mixed' | 'unknown';
