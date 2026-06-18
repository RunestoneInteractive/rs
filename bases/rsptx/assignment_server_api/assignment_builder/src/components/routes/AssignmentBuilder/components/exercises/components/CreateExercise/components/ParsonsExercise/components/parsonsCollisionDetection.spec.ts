import { CollisionDetection } from "@dnd-kit/core";

import { parsonsCollisionDetection } from "./parsonsCollisionDetection";

type CollisionArgs = Parameters<CollisionDetection>[0];

const rect = (top: number, height: number) => ({
  top,
  bottom: top + height,
  left: 0,
  right: 400,
  width: 400,
  height
});

const buildArgs = (overrides: Partial<CollisionArgs>): CollisionArgs => {
  const droppableRects = new Map([
    ["blocks-container", rect(0, 300)],
    ["block-a", rect(0, 40)],
    ["block-b", rect(50, 40)]
  ]);
  const droppableContainers = [...droppableRects.keys()].map((id) => ({ id }));

  return {
    active: { id: "block-a" },
    collisionRect: rect(50, 40),
    droppableRects,
    droppableContainers,
    pointerCoordinates: null,
    ...overrides
  } as unknown as CollisionArgs;
};

describe("parsonsCollisionDetection", () => {
  it("resolves keyboard drags (no pointer) to the nearest block instead of nothing", () => {
    const collisions = parsonsCollisionDetection(buildArgs({ pointerCoordinates: null }));

    expect(collisions.length).toBeGreaterThan(0);
    expect(collisions[0].id).toBe("block-b");
  });

  it("never targets the blocks container on keyboard drags", () => {
    const collisions = parsonsCollisionDetection(buildArgs({ pointerCoordinates: null }));

    expect(collisions.map((collision) => collision.id)).not.toContain("blocks-container");
  });

  it("targets the block under the pointer for mouse drags", () => {
    const collisions = parsonsCollisionDetection(
      buildArgs({ pointerCoordinates: { x: 10, y: 60 } })
    );

    expect(collisions[0].id).toBe("block-b");
  });

  it("falls back to the blocks container when the pointer is inside it but between blocks", () => {
    const collisions = parsonsCollisionDetection(
      buildArgs({ pointerCoordinates: { x: 10, y: 200 } })
    );

    expect(collisions.map((collision) => collision.id)).toEqual(["blocks-container"]);
  });

  it("returns no collisions when the pointer is outside the container", () => {
    const collisions = parsonsCollisionDetection(
      buildArgs({ pointerCoordinates: { x: 10, y: 500 } })
    );

    expect(collisions).toEqual([]);
  });
});
