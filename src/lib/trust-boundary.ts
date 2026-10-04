/** Tool routes carry consumer navigation, without the separate collection brand. */
export function isAstrologyToolPath(path: string): boolean {
  const consumer = path.replace(/^\/(?:en|es|pt|fr|it|ru)(?=\/)/, '');
  return /^\/(?:tools|birth-chart|big-three|group-charts|chart-twins|sky-calendar|astrologer-kit|your-sky-wrapped|chart-of-the-day|moon-sign|rising-sign|compatibility|synastry|solar-return|lunar-return|saturn-return|transits|moon-phase|numerology|baby-zodiac|sun-sign|profile|today)(?:\/|$)/.test(consumer);
}
