import { useState, useEffect, useCallback, RefObject } from "react";
import screenfull from "screenfull";

interface UseFullscreenReturn {
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  enterFullscreen: () => void;
  exitFullscreen: () => void;
  isSupported: boolean;
}

export const useFullscreen = (elementRef?: RefObject<HTMLElement>): UseFullscreenReturn => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!screenfull.isEnabled) return;

    const handleChange = () => {
      setIsFullscreen(screenfull.isFullscreen);
    };

    screenfull.on("change", handleChange);

    return () => {
      screenfull.off("change", handleChange);
    };
  }, []);

  const enterFullscreen = useCallback(async () => {
    if (!screenfull.isEnabled) return;

    try {
      const element = elementRef?.current || document.documentElement;
      await screenfull.request(element);
    } catch (error) {
      console.error("Failed to enter fullscreen:", error);
    }
  }, [elementRef]);

  const exitFullscreen = useCallback(async () => {
    if (!screenfull.isEnabled) return;

    try {
      await screenfull.exit();
    } catch (error) {
      console.error("Failed to exit fullscreen:", error);
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (isFullscreen) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  return {
    isFullscreen,
    toggleFullscreen,
    enterFullscreen,
    exitFullscreen,
    isSupported: screenfull.isEnabled
  };
};
