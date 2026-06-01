import type { SavingsForecastData, SavingsTimelinePoint } from "../api/findings.api";

export const SVG_LEFT = 64;
export const SVG_TOP = 8;
export const SVG_RIGHT = 640;
export const SVG_BOTTOM = 220;
export const SVG_LABEL_Y = 252;
export const SVG_HEIGHT = 280;
export const SVG_WIDTH = 680;
const CHART_TICKS = 5;
const X_AXIS_TICKS = 6;

const buildAreaPath = (points: Array<{ x: number; y: number }>) => {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  const line = points.map((point) => `${point.x} ${point.y}`).join(" L ");
  return `M ${first.x} ${SVG_BOTTOM} L ${line} L ${last.x} ${SVG_BOTTOM} Z`;
};

const buildLinePath = (points: Array<{ x: number; y: number }>) => {
  if (points.length === 0) return "";
  return `M ${points.map((point) => `${point.x} ${point.y}`).join(" L ")}`;
};

const pickTickIndexes = (length: number, maxTicks: number) => {
  if (length <= maxTicks) {
    return Array.from({ length }, (_, index) => index);
  }

  const lastIndex = length - 1;
  const indexes = new Set<number>([0, lastIndex]);

  for (let i = 1; i < maxTicks - 1; i += 1) {
    indexes.add(Math.round((i / (maxTicks - 1)) * lastIndex));
  }

  return Array.from(indexes).sort((a, b) => a - b);
};

function normalizeForAxis(value: number) {
  if (value <= 0) return 0;
  if (value < 10_000) return Math.round(value / 100) * 100;
  if (value < 100_000) return Math.round(value / 1_000) * 1_000;
  return Math.round(value / 10_000) * 10_000;
}

export const buildChartModel = (forecast: SavingsForecastData | null) => {
  if (!forecast) {
    return null;
  }

  const currentTimeline = forecast.currentScenario.timeline;
  const adjustedTimeline = forecast.adjustedScenario.timeline;
  const maxProjectedBalance = Math.max(
    ...currentTimeline.map((point) => point.projectedBalance),
    ...adjustedTimeline.map((point) => point.projectedBalance),
    1
  );

  const mapPoint = (point: SavingsTimelinePoint, index: number, totalPoints: number) => {
    const usableWidth = SVG_RIGHT - SVG_LEFT;
    const usableHeight = SVG_BOTTOM - SVG_TOP;
    const x =
      totalPoints === 1
        ? SVG_LEFT
        : SVG_LEFT + (index / (totalPoints - 1)) * usableWidth;
    const y =
      SVG_BOTTOM - (point.projectedBalance / maxProjectedBalance) * usableHeight;
    return {
      x,
      y,
      ...point,
    };
  };

  const currentPoints = currentTimeline.map((point, index) =>
    mapPoint(point, index, currentTimeline.length)
  );
  const adjustedPoints = adjustedTimeline.map((point, index) =>
    mapPoint(point, index, adjustedTimeline.length)
  );

  const yTickValues = Array.from({ length: CHART_TICKS }, (_, index) => {
    const ratio = (CHART_TICKS - 1 - index) / (CHART_TICKS - 1);
    return normalizeForAxis(maxProjectedBalance * ratio);
  });

  const xTickIndexes = pickTickIndexes(adjustedTimeline.length, X_AXIS_TICKS);

  return {
    maxProjectedBalance,
    currentPoints,
    adjustedPoints,
    currentAreaPath: buildAreaPath(currentPoints),
    adjustedAreaPath: buildAreaPath(adjustedPoints),
    currentLinePath: buildLinePath(currentPoints),
    adjustedLinePath: buildLinePath(adjustedPoints),
    yTicks: yTickValues.map((value) => ({
      value,
      y:
        SVG_BOTTOM -
        (maxProjectedBalance === 0
          ? 0
          : (value / maxProjectedBalance) * (SVG_BOTTOM - SVG_TOP)),
    })),
    xTicks: xTickIndexes.map((index) => ({
      x: adjustedPoints[index].x,
      age: adjustedPoints[index].age,
      calendarYear: adjustedPoints[index].calendarYear,
    })),
  };
};

export const formatAxisCurrency = (value: number) => {
  if (value >= 1_000_000) {
    return `₪${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `₪${Math.round(value / 1_000)}K`;
  }

  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(value);
};
