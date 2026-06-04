import { CollisionDetection, closestCenter, pointerWithin } from "@dnd-kit/core";

const BLOCKS_CONTAINER_ID = "blocks-container";

export const parsonsCollisionDetection: CollisionDetection = (args) => {
  if (!args.pointerCoordinates) {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (container) => container.id !== BLOCKS_CONTAINER_ID
      )
    });
  }

  const pointerCollisions = pointerWithin(args);

  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }

  const containerRect = args.droppableRects.get(BLOCKS_CONTAINER_ID);

  if (!containerRect) {
    return [];
  }

  const coordinates = args.pointerCoordinates;

  if (
    coordinates.x >= containerRect.left &&
    coordinates.x <= containerRect.right &&
    coordinates.y >= containerRect.top &&
    coordinates.y <= containerRect.bottom
  ) {
    return [{ id: BLOCKS_CONTAINER_ID }];
  }

  return [];
};
