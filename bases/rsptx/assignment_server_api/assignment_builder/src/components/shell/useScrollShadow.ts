import { RefCallback, useCallback, useRef, useState } from "react";

export const useScrollShadow = () => {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [scrolled, setScrolled] = useState(false);

  const sentinelRef: RefCallback<HTMLElement> = useCallback((node) => {
    observerRef.current?.disconnect();
    observerRef.current = null;

    if (!node || typeof IntersectionObserver === "undefined") {
      setScrolled(false);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      setScrolled(!entry.isIntersecting);
    });

    observer.observe(node);
    observerRef.current = observer;
  }, []);

  return { sentinelRef, scrolled };
};
