import { useEffect } from "react";

export function useEnsureEbookConfigForGrader() {
  useEffect(() => {
    const w = window as any;
    if (!w.eBookConfig) w.eBookConfig = {};
    const cfg = w.eBookConfig;
    cfg.useRunestoneServices = cfg.useRunestoneServices !== false;
    cfg.isLoggedIn = cfg.isLoggedIn !== false;
    cfg.new_server_prefix = cfg.new_server_prefix ?? "/ns";
    cfg.app = cfg.app ?? "/runestone";
    cfg.python3 = cfg.python3 !== false;
    if (!cfg.course) cfg.course = "";
    if (!cfg.basecourse) cfg.basecourse = "";
    if (!cfg.email) cfg.email = cfg.username ?? "instructor";
  }, []);
}

