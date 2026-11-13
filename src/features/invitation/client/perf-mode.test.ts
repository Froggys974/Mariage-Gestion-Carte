import { describe, expect, it, vi } from 'vitest';
import { chooseMode, createFpsMonitor } from './perf-mode';

describe('chooseMode', () => {
  it('respecte prefers-reduced-motion', () => {
    expect(chooseMode({ reducedMotion: true, preserve3d: true, cores: 8, memoryGb: 8 })).toBe('reduced');
  });
  it('passe en économie sans preserve-3d', () => {
    expect(chooseMode({ reducedMotion: false, preserve3d: false, cores: 8 })).toBe('economy');
  });
  it('passe en économie sur un appareil faible (≤ 4 cœurs, pas ≥ 4 Go)', () => {
    expect(chooseMode({ reducedMotion: false, preserve3d: true, cores: 4 })).toBe('economy');
    expect(chooseMode({ reducedMotion: false, preserve3d: true, cores: 4, memoryGb: 2 })).toBe('economy');
  });
  it('reste complet avec 4 cœurs et 4 Go, ou plus de 4 cœurs', () => {
    expect(chooseMode({ reducedMotion: false, preserve3d: true, cores: 4, memoryGb: 4 })).toBe('full');
    expect(chooseMode({ reducedMotion: false, preserve3d: true, cores: 8 })).toBe('full');
  });
});

describe('createFpsMonitor', () => {
  it('se déclenche sous 40 i/s pendant un mouvement', () => {
    const onLow = vi.fn();
    const m = createFpsMonitor(onLow);
    for (let i = 0; i < 60; i++) m.frame(33, true); // ~30 i/s
    expect(onLow).toHaveBeenCalledOnce();
    expect(onLow.mock.calls[0]?.[0]).toBeLessThan(40);
  });
  it('ignore le repos et les pauses d’onglet', () => {
    const onLow = vi.fn();
    const m = createFpsMonitor(onLow);
    for (let i = 0; i < 100; i++) m.frame(50, false);
    m.frame(1000, true);
    for (let i = 0; i < 200; i++) m.frame(16.7, true);
    expect(onLow).not.toHaveBeenCalled();
  });
});
