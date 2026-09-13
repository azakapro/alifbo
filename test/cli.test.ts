import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('CLI', () => {
  it('converts stdin to stdout', () => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/cli.ts', 'convert', '--to', 'new-latin'], {
      cwd: process.cwd(),
      input: 'shahar',
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('şahar');
  });

  it('converts a file without modifying it', () => {
    const directory = mkdtempSync(join(tmpdir(), 'alifbo-'));
    const file = join(directory, 'input.txt');
    writeFileSync(file, 'Шавкат', 'utf8');
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/cli.ts', 'convert', '--to', 'new-latin', file], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('Şavkat');
    expect(readFileSync(file, 'utf8')).toBe('Шавкат');
  });
});
