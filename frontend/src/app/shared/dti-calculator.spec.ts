import { calculateDti, totalMonthlyDebt, dtiBand } from './dti-calculator';

describe('dti-calculator', () => {
  describe('calculateDti', () => {
    it('computes $2,350 / $6,000 × 100 = 39.166...%', () => {
      const result = calculateDti(6000, { housing: 1800, auto: 400, creditCards: 150 });
      expect(result).not.toBeNull();
      expect(result!).toBeCloseTo(39.16666, 4);
    });

    it('rounds to 39.2% for display purposes', () => {
      const result = calculateDti(6000, { housing: 1800, auto: 400, creditCards: 150 });
      expect(result!.toFixed(1)).toBe('39.2');
    });

    it('treats blank/undefined debt fields as zero', () => {
      const result = calculateDti(6000, { housing: 1800 }); // all other fields omitted
      expect(result).toBe(30);
    });

    it('returns null when income is zero (calculation is blocked)', () => {
      expect(calculateDti(0, { housing: 1000 })).toBeNull();
    });

    it('returns null for negative income (calculation is blocked, not inverted)', () => {
      expect(calculateDti(-6000, { housing: 1000 })).toBeNull();
    });

    it('ignores negative debt values rather than allowing them to reduce total debt', () => {
      const withNegative = calculateDti(6000, { housing: 1800, auto: -400 });
      const withoutAuto = calculateDti(6000, { housing: 1800 });
      expect(withNegative).toBe(withoutAuto);
    });

    it('handles decimal values correctly', () => {
      const result = calculateDti(5500.5, { housing: 1750.25, auto: 325.75 });
      expect(result!).toBeCloseTo(((1750.25 + 325.75) / 5500.5) * 100, 6);
    });
  });

  describe('totalMonthlyDebt', () => {
    it('equals the sum of all debt inputs', () => {
      const total = totalMonthlyDebt({
        housing: 1800, auto: 400, student: 250, creditCards: 150, personal: 100, other: 50,
      });
      expect(total).toBe(1800 + 400 + 250 + 150 + 100 + 50);
    });

    it('treats every omitted field as zero', () => {
      expect(totalMonthlyDebt({})).toBe(0);
    });
  });

  describe('dtiBand', () => {
    it('labels 36% or below as the healthy band', () => {
      expect(dtiBand(36).tone).toBe('good');
      expect(dtiBand(20).tone).toBe('good');
    });

    it('labels 36.1%–43% as the moderate band', () => {
      expect(dtiBand(39.2).tone).toBe('ok');
      expect(dtiBand(43).tone).toBe('ok');
    });

    it('labels above 43% as the higher band', () => {
      expect(dtiBand(43.1).tone).toBe('high');
      expect(dtiBand(60).tone).toBe('high');
    });

    it('never claims approval, prequalification, or a guaranteed outcome', () => {
      const allLabels = [dtiBand(20), dtiBand(40), dtiBand(60)].map(b => b.label.toLowerCase());
      for (const label of allLabels) {
        expect(label).not.toContain('approv');
        expect(label).not.toContain('qualif');
        expect(label).not.toContain('guarant');
      }
    });
  });
});
