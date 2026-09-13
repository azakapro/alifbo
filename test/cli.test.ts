import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('CLI', () => {
  it('converts stdin to stdout', () => {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'src/cli.ts', 'convert', '--to', 'new-latin'],
      {
        cwd: process.cwd(),
        input: 'shahar',
        encoding: 'utf8',
      },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('şahar');
    expect(result.stderr).toBe('');
  });

  it('converts a file without modifying it', () => {
    const directory = mkdtempSync(join(tmpdir(), 'alifbo-'));
    const file = join(directory, 'input.txt');
    writeFileSync(file, 'Шавкат', 'utf8');
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'src/cli.ts', 'convert', '--to', 'new-latin', file],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('Şavkat');
    expect(readFileSync(file, 'utf8')).toBe('Шавкат');
  });

  it('prints lossy-conversion warnings to stderr without contaminating stdout', () => {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'src/cli.ts', 'convert', '--to', 'new-latin'],
      {
        cwd: process.cwd(),
        input: 'Елена',
        encoding: 'utf8',
      },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('Yelena');
    expect(result.stderr).toContain('[cyrillic.e.positional]');
    expect(result.stderr).toContain('Alternatives: "e", "ye"');
  });

  it('shows help successfully', () => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/cli.ts', '--help'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage: alifbo convert');
    expect(result.stderr).toBe('');
  });

  it('supports old Latin and Cyrillic targets', () => {
    const oldLatin = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'src/cli.ts', 'convert', '--to', 'old-latin'],
      { cwd: process.cwd(), input: 'Şahar', encoding: 'utf8' },
    );
    const cyrillic = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'src/cli.ts', 'convert', '--to', 'cyrillic'],
      { cwd: process.cwd(), input: 'Şavkat', encoding: 'utf8' },
    );
    expect(oldLatin.status).toBe(0);
    expect(oldLatin.stdout).toBe('Shahar');
    expect(cyrillic.status).toBe(0);
    expect(cyrillic.stdout).toBe('Шавкат');
  });

  it('rejects unsupported targets without reading stdin', () => {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'src/cli.ts', 'convert', '--to', 'unknown'],
      { cwd: process.cwd(), encoding: 'utf8' },
    );
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Usage: alifbo convert');
  });
});
