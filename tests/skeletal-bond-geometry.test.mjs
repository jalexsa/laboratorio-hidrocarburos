import assert from "node:assert/strict";
import test from "node:test";

import { getSkeletalRingDoubleBondSegments } from "../app/skeletal-bond-geometry.ts";

const hexagon = Array.from({ length: 6 }, (_, index) => {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / 6;
  return {
    x: Math.cos(angle) * 175,
    y: Math.sin(angle) * 175,
  };
});

const projectedInset = (segment, start, end) => {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const length = Math.hypot(deltaX, deltaY);
  let normalX = -deltaY / length;
  let normalY = deltaX / length;
  const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  if (normalX * -midpoint.x + normalY * -midpoint.y < 0) {
    normalX *= -1;
    normalY *= -1;
  }
  return (segment.x - start.x) * normalX + (segment.y - start.y) * normalY;
};

test("places both cyclic double-bond strokes toward the ring interior", () => {
  const start = hexagon[0];
  const end = hexagon[1];
  const originalStart = { ...start };
  const originalEnd = { ...end };
  const [edge, inner] = getSkeletalRingDoubleBondSegments(start, end, hexagon);

  assert.ok(projectedInset(edge, start, end) > 0);
  assert.ok(projectedInset(inner, start, end) > projectedInset(edge, start, end));
  assert.deepEqual(start, originalStart);
  assert.deepEqual(end, originalEnd);
});

test("trims the inner Kekulé stroke symmetrically at both endpoints", () => {
  const start = hexagon[0];
  const end = hexagon[1];
  const [edge, inner] = getSkeletalRingDoubleBondSegments(start, end, hexagon);
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const length = Math.hypot(deltaX, deltaY);
  const tangentX = deltaX / length;
  const tangentY = deltaY / length;
  const startTrim = (inner.x - start.x) * tangentX + (inner.y - start.y) * tangentY;
  const endTrim = (end.x - inner.x2) * tangentX + (end.y - inner.y2) * tangentY;
  const edgeLength = Math.hypot(edge.x2 - edge.x, edge.y2 - edge.y);
  const innerLength = Math.hypot(inner.x2 - inner.x, inner.y2 - inner.y);

  assert.ok(Math.abs(startTrim - endTrim) < 1e-9);
  assert.ok(innerLength < edgeLength);
  assert.equal(edge.role, "edge");
  assert.equal(inner.role, "inner");
});
