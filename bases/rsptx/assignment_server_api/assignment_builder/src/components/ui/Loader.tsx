import { Loader as MantineLoader } from "@mantine/core";
import { FC } from "react";

export const Loader: FC<{ size?: number }> = ({ size = 50 }) => {
  return <MantineLoader size={size} />;
};
