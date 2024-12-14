import { ProgressSpinner } from "primereact/progressspinner";
import { FC } from "react";

export const Loader: FC<{ size?: number }> = ({ size = 50 }) => {
  const pixelSize = `${size}px`;

  return (
    <ProgressSpinner
      style={{ width: pixelSize, height: pixelSize }}
      strokeWidth="8"
      fill="var(--surface-ground)"
      animationDuration=".5s"
    />
  );
};
