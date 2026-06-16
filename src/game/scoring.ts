export interface ScoreEntry {
  name: string;
  distance: number;
  date: string;
}

const STORAGE_KEY = 'sanssurf_scores';
const METERS_PER_UNIT = 1.0;

export class Scoring {
  private distanceMeters = 0;

  reset(): void { this.distanceMeters = 0; }

  update(speed: number, dt: number): void {
    this.distanceMeters += speed * dt * METERS_PER_UNIT;
  }

  getDistance(): number { return Math.floor(this.distanceMeters); }

  loadScores(): ScoreEntry[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as ScoreEntry[];
    } catch {
      return [];
    }
  }

  saveScore(name: string): void {
    const scores = this.loadScores();
    scores.push({ name: name.toUpperCase().slice(0, 3), distance: this.getDistance(), date: new Date().toISOString() });
    scores.sort((a, b) => b.distance - a.distance);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores.slice(0, 10)));
  }

  getPersonalBest(): number {
    const scores = this.loadScores();
    return scores.length > 0 ? (scores[0]?.distance ?? 0) : 0;
  }
}
