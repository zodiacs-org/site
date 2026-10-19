/**
 * Race share cards — the per-sign weekly card, its rivalry variant, and the
 * season-champion card (surfaced at season close). Text comes verbatim from
 * the approved R1.1 pack (ZODIAC-GAMES.md Part 2 §G); the visual system is
 * the same one the Cabinet's collection seal uses (src/lib/aura-share-card.ts):
 * void ground, EB Garamond display, JetBrains Mono data, the sign's pastel
 * hue as the only chroma. The card carries standings facts only — never an
 * address, balance, price, or anything ownable.
 */
import { signBySlug, type Sign } from "../signs.js";
import {
  PORTRAIT_SHARE_CARD_BRAND_LAYOUT,
  drawShareBrandLockup,
  withShareBrandIcon,
} from "../share-card-brand.js";
import { SIGN_ID_PATTERN, ordinalLabel } from "./share-copy.js";

export interface RaceStandingRow {
  sign: string;
  points: number;
}

export interface RaceShareCardInput {
  sign: string;
  seasonName: string;
  daysLeft: number;
  isoWeek: number;
  standings: readonly RaceStandingRow[];
}

export interface ChampionShareCardInput {
  sign: string;
  seasonName: string;
  year: number;
}

export interface RaceShareSnapshot {
  variant: "weekly" | "rivalry" | "champion";
  sign: Pick<Sign, "slug" | "name" | "glyph" | "hue">;
  /** e.g. "1st this week" or "842 points behind Scorpio". */
  standingLine: string;
  /** e.g. "Week 34 · The Zodiac Games" or "6 days left in Leo Season". */
  contextLine: string;
  footerLine: string;
  /** Zodiac-ordered board strip; the card's sign is marked. */
  strip: readonly { slug: string; glyph: string; hue: string; mine: boolean }[];
}

export const RACE_SHARE_FILENAME = "zodiacs-race-card.png";
export type RaceShareActionOutcome =
  | "shared"
  | "downloaded"
  | "cancelled"
  | "unavailable";

const W = 1080;
const H = 1350;
const BG = "#060709";
const PANEL = "#0C0F15";
const INK = "#EEF1F7";
const MUTED = "#9CA5B8";
const HAIR = "rgba(205, 212, 226, 0.16)";
const SERIF = '"EB Garamond", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const RACE_URL = "zodiacs.org/race";
export const RACE_SHARE_CARD_BRAND_LAYOUT = Object.freeze({
  ...PORTRAIT_SHARE_CARD_BRAND_LAYOUT,
  centerY: 76,
});

const ZODIAC_ORDER = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
] as const;

function assertSign(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !SIGN_ID_PATTERN.test(value)) {
    throw new TypeError(`${field} must be a canonical zodiac sign.`);
  }
}

function cardStrip(slug: string): RaceShareSnapshot["strip"] {
  return ZODIAC_ORDER.map((entry) => {
    const sign = signBySlug(entry);
    return { slug: entry, glyph: sign.glyph, hue: sign.hue, mine: entry === slug };
  });
}

function boundedCount(value: unknown, field: string, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > max) {
    throw new TypeError(`${field} must be an integer between 1 and ${max}.`);
  }
  return value;
}

/**
 * Reduces live standings to the painted model. Rank 1 gets the weekly
 * leader card; every other rank gets the rivalry variant against the
 * current leader — the exact §G copy shapes.
 */
export function raceShareSnapshot(input: RaceShareCardInput): RaceShareSnapshot {
  if (!input || typeof input !== "object") {
    throw new TypeError("A race share input is required.");
  }
  assertSign(input.sign, "sign");
  const sign = signBySlug(input.sign);
  const seasonName = String(input.seasonName ?? "").trim();
  if (!seasonName) throw new TypeError("seasonName is required.");
  const daysLeft = boundedCount(input.daysLeft, "daysLeft", 40);
  const isoWeek = boundedCount(input.isoWeek, "isoWeek", 53);
  if (!Array.isArray(input.standings) || input.standings.length === 0) {
    throw new TypeError("standings must be the current non-empty board.");
  }
  const board = input.standings.map((row, index) => {
    assertSign(row?.sign, `standings[${index}].sign`);
    if (typeof row.points !== "number" || !Number.isFinite(row.points) || row.points < 0) {
      throw new TypeError(`standings[${index}].points must be a non-negative number.`);
    }
    return { sign: row.sign, points: row.points };
  });
  const rank = board.findIndex((row) => row.sign === input.sign);
  if (rank === -1) {
    throw new TypeError("standings must include the card's sign.");
  }

  if (rank === 0) {
    return {
      variant: "weekly",
      sign,
      standingLine: `${ordinalLabel(1)} this week`,
      contextLine: `Week ${isoWeek} · The Zodiac Games`,
      footerLine: RACE_URL,
      strip: cardStrip(sign.slug),
    };
  }

  const leader = signBySlug(board[0]!.sign);
  const gap = board[0]!.points - board[rank]!.points;
  return {
    variant: "rivalry",
    sign,
    standingLine: `${gap.toLocaleString("en")} points behind ${leader.name}`,
    contextLine: `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left in ${seasonName} Season`,
    footerLine: RACE_URL,
    strip: cardStrip(sign.slug),
  };
}

/** The season-close card (§G), surfaced by the season-close packet. */
export function championShareSnapshot(input: ChampionShareCardInput): RaceShareSnapshot {
  if (!input || typeof input !== "object") {
    throw new TypeError("A champion share input is required.");
  }
  assertSign(input.sign, "sign");
  const sign = signBySlug(input.sign);
  const seasonName = String(input.seasonName ?? "").trim();
  if (!seasonName) throw new TypeError("seasonName is required.");
  if (typeof input.year !== "number" || !Number.isInteger(input.year)
    || input.year < 2026 || input.year > 2100) {
    throw new TypeError("year must be a plausible season year.");
  }
  return {
    variant: "champion",
    sign,
    standingLine: `${seasonName} Season Champion · ${input.year}`,
    contextLine: "The Zodiac Games",
    footerLine: RACE_URL,
    strip: cardStrip(sign.slug),
  };
}

/** Complete generated-text equivalent of the raster card. */
export function raceShareAccessibleDescription(snapshot: RaceShareSnapshot): string {
  const identity = `${snapshot.sign.glyph} ${snapshot.sign.name}`;
  if (snapshot.variant === "champion") {
    return `${identity}. ${snapshot.standingLine}. ${snapshot.contextLine} · ${snapshot.footerLine}.`;
  }
  return `${identity} · ${snapshot.standingLine}. ${snapshot.contextLine}. ${snapshot.footerLine}.`;
}

function circle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
): void {
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
}

/**
 * Loads one official SDK circle icon for canvas painting. Resolves null on
 * any failure so the card can fall back to the painted-glyph rendering —
 * a card must never fail to render because an icon fetch did.
 */
function loadSignIcon(tier: 48 | 400, slug: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = `/assets/zodiac-icons/${tier}/${slug}.webp`;
  });
}

function drawStrip(
  context: CanvasRenderingContext2D,
  snapshot: RaceShareSnapshot,
  y: number,
  icons: readonly (HTMLImageElement | null)[],
): void {
  const gap = 82;
  const startX = W / 2 - (gap * 11) / 2;
  snapshot.strip.forEach((entry, index) => {
    const x = startX + index * gap;
    const icon = icons[index] ?? null;
    if (entry.mine) {
      if (icon) {
        context.drawImage(icon, x - 26, y - 26, 52, 52);
        context.strokeStyle = entry.hue;
        context.lineWidth = 2;
        circle(context, x, y, 27);
        context.stroke();
        return;
      }
      context.fillStyle = entry.hue;
      circle(context, x, y, 26);
      context.fill();
      context.fillStyle = BG;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = `500 26px ${SERIF}`;
      context.fillText(`${entry.glyph}︎`, x, y + 1);
    } else {
      if (icon) {
        context.globalAlpha = 0.5;
        context.drawImage(icon, x - 16, y - 16, 32, 32);
        context.globalAlpha = 1;
        return;
      }
      context.strokeStyle = HAIR;
      context.lineWidth = 1;
      circle(context, x, y, 16);
      context.stroke();
      context.fillStyle = MUTED;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = `500 16px ${SERIF}`;
      context.fillText(`${entry.glyph}︎`, x, y + 1);
    }
  });
}

export async function drawRaceShareCard(snapshot: RaceShareSnapshot): Promise<Blob> {
  if (typeof document.fonts !== "undefined") {
    await document.fonts.ready;
    await Promise.all([
      document.fonts.load(`500 120px ${SERIF}`),
      document.fonts.load(`500 24px ${MONO}`),
    ]).catch(() => {});
  }

  // The official SDK circle icons; a failed fetch falls back to glyphs.
  const [centerIcon, stripIcons] = await Promise.all([
    loadSignIcon(400, snapshot.sign.slug),
    Promise.all(snapshot.strip.map((entry) => loadSignIcon(48, entry.slug))),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas_unavailable");

  context.fillStyle = BG;
  context.fillRect(0, 0, W, H);
  if (typeof context.roundRect === "function") {
    context.strokeStyle = HAIR;
    context.lineWidth = 1;
    context.beginPath();
    context.roundRect(28.5, 28.5, W - 57, H - 57, 26);
    context.stroke();
  }

  context.textBaseline = "middle";
  context.textAlign = "center";
  context.fillStyle = MUTED;
  context.font = `500 22px ${MONO}`;
  context.fillText("THE ZODIAC GAMES", W / 2, 96);

  // The sign's disc — the official icon inside the sign-hued ring.
  const discY = 430;
  context.fillStyle = PANEL;
  circle(context, W / 2, discY, 218);
  context.fill();
  context.strokeStyle = snapshot.sign.hue;
  context.lineWidth = 3;
  circle(context, W / 2, discY, 218);
  context.stroke();
  if (centerIcon) {
    context.drawImage(centerIcon, W / 2 - 178, discY - 178, 356, 356);
  } else {
    context.fillStyle = snapshot.sign.hue;
    circle(context, W / 2, discY, 178);
    context.fill();
    context.fillStyle = BG;
    context.font = `500 210px ${SERIF}`;
    context.fillText(`${snapshot.sign.glyph}︎`, W / 2, discY + 8);
  }

  context.fillStyle = INK;
  context.font = `500 118px ${SERIF}`;
  context.fillText(snapshot.sign.name.toUpperCase(), W / 2, 772);

  context.fillStyle = snapshot.variant === "champion" ? INK : MUTED;
  context.font = snapshot.variant === "champion"
    ? `400 46px ${SERIF}`
    : `500 40px ${SERIF}`;
  context.fillText(snapshot.standingLine, W / 2, 866);

  context.fillStyle = MUTED;
  context.font = `500 25px ${MONO}`;
  context.fillText(snapshot.contextLine.toUpperCase(), W / 2, 946);

  drawStrip(context, snapshot, 1090, stripIcons);

  context.strokeStyle = HAIR;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(66, 1190);
  context.lineTo(W - 66, 1190);
  context.stroke();
  context.fillStyle = INK;
  context.font = `500 27px ${MONO}`;
  context.fillText(snapshot.footerLine.toUpperCase(), W / 2, 1252);

  await withShareBrandIcon((brandIcon) => {
    drawShareBrandLockup(context, brandIcon, {
      ...RACE_SHARE_CARD_BRAND_LAYOUT,
      serif: SERIF,
      // The ring brings the card's sign forward.
      front: snapshot.sign.slug,
    });
  });

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("png_encode_failed");
  return blob;
}

export function canShareRaceCardBlob(blob: Blob): boolean {
  try {
    const file = new File([blob], RACE_SHARE_FILENAME, { type: "image/png" });
    return (
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    );
  } catch {
    return false;
  }
}

/** Shares the reviewed PNG without adding a caption, title, text, or URL. */
export async function shareRaceCardBlob(blob: Blob): Promise<RaceShareActionOutcome> {
  if (!canShareRaceCardBlob(blob)) return "unavailable";
  const file = new File([blob], RACE_SHARE_FILENAME, { type: "image/png" });
  try {
    await navigator.share({ files: [file] });
    return "shared";
  } catch (error) {
    return (error as DOMException)?.name === "AbortError"
      ? "cancelled"
      : "unavailable";
  }
}

/** Downloads the exact PNG the share sheet would carry. */
export function downloadRaceCardBlob(blob: Blob): "downloaded" {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = RACE_SHARE_FILENAME;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return "downloaded";
}
