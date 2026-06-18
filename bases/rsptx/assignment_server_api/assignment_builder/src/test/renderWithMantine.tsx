import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { render, RenderOptions, RenderResult } from "@testing-library/react";
import React from "react";

import { mantineTheme } from "@/theme/mantineTheme";

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MantineProvider theme={mantineTheme} defaultColorScheme="light" env="test">
    <ModalsProvider>
      <Notifications />
      {children}
    </ModalsProvider>
  </MantineProvider>
);

export const renderWithMantine = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">
): RenderResult => render(ui, { wrapper: Wrapper, ...options });

export * from "@testing-library/react";
