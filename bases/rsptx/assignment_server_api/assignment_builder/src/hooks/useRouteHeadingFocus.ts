import { RefObject, useEffect, useRef } from "react";

/**
 * Moves focus to a page heading when its route changes so assistive
 * technology announces the newly rendered page context.
 */
export const useRouteHeadingFocus = (routeKey: string): RefObject<HTMLHeadingElement> => {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [routeKey]);

  return headingRef;
};
