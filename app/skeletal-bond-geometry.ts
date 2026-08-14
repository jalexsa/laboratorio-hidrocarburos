export type SkeletalPoint = {
  x: number;
  y: number;
};

export type SkeletalBondSegment = SkeletalPoint & {
  x2: number;
  y2: number;
  role: "edge" | "inner";
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

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
