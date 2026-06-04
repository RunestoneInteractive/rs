import { Page, Response } from "@playwright/test";

import { APP_BASE } from "../playwright.config";

export const appPath = (path: string): string => {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${APP_BASE}${suffix}`;
};

export const gotoApp = (
  page: Page,
  path: string,
  options?: Parameters<Page["goto"]>[1]
): Promise<Response | null> => page.goto(appPath(path), options);
