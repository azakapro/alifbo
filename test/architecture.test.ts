import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('core architecture constraints', () => {
  it('contains no locale-aware or implicit Unicode case conversion calls', () => {
    const sourceDirectory = join(process.cwd(), 'src');
    const violations: string[] = [];
    for (const file of readdirSync(sourceDirectory).filter((name) => name.endsWith('.ts'))) {
      const source = readFileSync(join(sourceDirectory, file), 'utf8');
      if (/\.to(?:Locale)?(?:Upper|Lower)Case\s*\(/u.test(source)) violations.push(file);
    }
    expect(violations).toEqual([]);
  });

  it('keeps Node built-ins out of the browser-safe public entry point', () => {
    const source = readFileSync(join(process.cwd(), 'src/index.ts'), 'utf8');
    expect(source).not.toMatch(/from ['"]node:/u);
    expect(source).not.toContain("from './cli.js'");
  });
});
