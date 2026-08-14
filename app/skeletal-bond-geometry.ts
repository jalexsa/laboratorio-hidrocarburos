export type SkeletalPoint = {
  x: number;
  y: number;
};

export type SkeletalBondSegment = SkeletalPoint & {
  x2: number;
  y2: number;
  role: "edge" | "inner";
};

export const SKELETAL_NODE_RADIUS = 20;
export const SKELETAL_BOND_END_BUFFER = 3;
export const SKELETAL_BOND_END_CLEARANCE = SKELETAL_NODE_RADIUS + SKELETAL_BOND_END_BUFFER;
export const SKELETAL_NUMBER_BADGE_OFFSET = { x: 20, y: -22 } as const;
export const SKELETAL_NUMBER_BADGE_RADIUS = 12;
export const SKELETAL_NUMBER_BADGE_STROKE_WIDTH = 2.5;
export const SKELETAL_NUMBER_BADGE_CLEARANCE = SKELETAL_NUMBER_BADGE_RADIUS
  + SKELETAL_NUMBER_BADGE_STROKE_WIDTH / 2
  + SKELETAL_BOND_END_BUFFER;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

/**
 * Recorta un trazo paralelo sin mover los átomos ni cambiar su inclinación.
 * La distancia se mide sobre el eje original del enlace, de modo que las dos
 * líneas de un enlace doble terminan alineadas aunque estén desplazadas.
 */
export function clipSkeletalBondSegment<
  Segment extends SkeletalPoint & { x2: number; y2: number },
>(
  segment: Segment,
  start: SkeletalPoint,
  end: SkeletalPoint,
  startClearance = SKELETAL_BOND_END_CLEARANCE,
  endClearance = startClearance,
): Segment {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const length = Math.hypot(deltaX, deltaY);

  if (length === 0) return { ...segment };

  const tangentX = deltaX / length;
  const tangentY = deltaY / length;
  // Conserva al menos 8 px de trazo incluso si llega una geometría anómala.
  const maximumClearance = Math.max(0, (length - 8) / 2);
  const safeStartClearance = clamp(startClearance, 0, maximumClearance);
  const safeEndClearance = clamp(endClearance, 0, maximumClearance);
  const existingStartTrim = (segment.x - start.x) * tangentX
    + (segment.y - start.y) * tangentY;
  const existingEndTrim = (end.x - segment.x2) * tangentX
    + (end.y - segment.y2) * tangentY;
  const startAdjustment = Math.max(0, safeStartClearance - existingStartTrim);
  const endAdjustment = Math.max(0, safeEndClearance - existingEndTrim);

  return {
    ...segment,
    x: segment.x + tangentX * startAdjustment,
    y: segment.y + tangentY * startAdjustment,
    x2: segment.x2 - tangentX * endAdjustment,
    y2: segment.y2 - tangentY * endAdjustment,
  };
}

type SkeletalCircleObstacle = {
  center: SkeletalPoint;
  radius: number;
};

type SkeletalParallelBondClipOptions = {
  startObstacle?: SkeletalCircleObstacle;
  endObstacle?: SkeletalCircleObstacle;
};

function getCircleEndClearance(
  segment: SkeletalPoint & { x2: number; y2: number },
  start: SkeletalPoint,
  end: SkeletalPoint,
  obstacle: SkeletalCircleObstacle,
  endpoint: "start" | "end",
) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const length = Math.hypot(deltaX, deltaY);
  if (length === 0) return 0;

  const tangentX = deltaX / length;
  const tangentY = deltaY / length;
  const existingStartTrim = (segment.x - start.x) * tangentX
    + (segment.y - start.y) * tangentY;
  const lineOrigin = {
    x: segment.x - tangentX * existingStartTrim,
    y: segment.y - tangentY * existingStartTrim,
  };
  const obstacleDeltaX = obstacle.center.x - lineOrigin.x;
  const obstacleDeltaY = obstacle.center.y - lineOrigin.y;
  const centerProjection = obstacleDeltaX * tangentX + obstacleDeltaY * tangentY;
  const perpendicularSquared = Math.max(
    0,
    obstacleDeltaX ** 2 + obstacleDeltaY ** 2 - centerProjection ** 2,
  );
  const radiusSquared = obstacle.radius ** 2;
  if (perpendicularSquared >= radiusSquared) return 0;

  const halfChord = Math.sqrt(radiusSquared - perpendicularSquared);
  const entry = centerProjection - halfChord;
  const exit = centerProjection + halfChord;
  if (exit <= 0 || entry >= length) return 0;

  return endpoint === "start"
    ? Math.max(0, exit)
    : Math.max(0, length - entry);
}

/**
 * Recorta el conjunto completo usando los valores más conservadores. Así las
 * líneas paralelas comparten exactamente sus topes y ninguna roza la insignia
 * numerada aunque solo una de ellas se cruce con su circunferencia.
 */
export function clipSkeletalParallelBondSegments<
  Segment extends SkeletalPoint & { x2: number; y2: number },
>(
  segments: readonly Segment[],
  start: SkeletalPoint,
  end: SkeletalPoint,
  options: SkeletalParallelBondClipOptions = {},
): Segment[] {
  let startClearance = SKELETAL_BOND_END_CLEARANCE;
  let endClearance = SKELETAL_BOND_END_CLEARANCE;

  if (options.startObstacle) {
    startClearance = Math.max(
      startClearance,
      ...segments.map((segment) => getCircleEndClearance(
        segment,
        start,
        end,
        options.startObstacle!,
        "start",
      )),
    );
  }

  if (options.endObstacle) {
    endClearance = Math.max(
      endClearance,
      ...segments.map((segment) => getCircleEndClearance(
        segment,
        start,
        end,
        options.endObstacle!,
        "end",
      )),
    );
  }

  return segments.map((segment) => clipSkeletalBondSegment(
    segment,
    start,
    end,
    startClearance,
    endClearance,
  ));
}

export function getSkeletalRingDoubleBondSegments(
  start: SkeletalPoint,
  end: SkeletalPoint,
  ringPoints: readonly SkeletalPoint[],
): SkeletalBondSegment[] {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const length = Math.hypot(deltaX, deltaY) || 1;
  const tangentX = deltaX / length;
  const tangentY = deltaY / length;
  let inwardX = -tangentY;
  let inwardY = tangentX;
  const ringCenter = ringPoints.reduce(
    (center, point) => ({
      x: center.x + point.x / Math.max(ringPoints.length, 1),
      y: center.y + point.y / Math.max(ringPoints.length, 1),
    }),
    { x: 0, y: 0 },
  );
  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
  const pointsTowardCenter = inwardX * (ringCenter.x - midpoint.x)
    + inwardY * (ringCenter.y - midpoint.y);

  if (pointsTowardCenter < 0) {
    inwardX *= -1;
    inwardY *= -1;
  }

  // La primera línea queda apenas dentro del perímetro para que su grosor no
  // sobresalga; la segunda se centra más hacia el anillo y se recorta igual en
  // ambos extremos, como en la representación clásica de Kekulé.
  const edgeInset = clamp(length * 0.015, 2.4, 3.2);
  const innerInset = clamp(length * 0.075, 10, 14);
  const endpointTrim = clamp(length * 0.12, 14, 24);

  return [
    {
      x: start.x + inwardX * edgeInset,
      y: start.y + inwardY * edgeInset,
      x2: end.x + inwardX * edgeInset,
      y2: end.y + inwardY * edgeInset,
      role: "edge",
    },
    {
      x: start.x + tangentX * endpointTrim + inwardX * innerInset,
      y: start.y + tangentY * endpointTrim + inwardY * innerInset,
      x2: end.x - tangentX * endpointTrim + inwardX * innerInset,
      y2: end.y - tangentY * endpointTrim + inwardY * innerInset,
      role: "inner",
    },
  ];
}
