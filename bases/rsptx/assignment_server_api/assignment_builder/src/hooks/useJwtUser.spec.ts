import { renderHook } from "@testing-library/react";
import React from "react";
import { Provider } from "react-redux";
import { setupStore } from "@store/store";
import { useJwtUser } from "./useJwtUser";

declare let eBookConfig: { username?: string };

const buildJwt = (payload: Record<string, unknown>): string => {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${header}.${body}.fakesig`;
};

const futureExp = (): number => Math.floor(Date.now() / 1000) + 3600;
const pastExp = (): number => Math.floor(Date.now() / 1000) - 3600;

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(Provider, { store: setupStore() }, children);

const setCookie = (value: string) => {
  Object.defineProperty(document, "cookie", {
    writable: true,
    value,
    configurable: true
  });
};

afterEach(() => {
  Object.defineProperty(document, "cookie", {
    writable: true,
    value: "",
    configurable: true
  });
  if (typeof eBookConfig !== "undefined") {
    (globalThis as any).eBookConfig = {};
  }
});

describe("useJwtUser", () => {
  it("returns null username when no cookie and no eBookConfig username are present", () => {
    setCookie("");
    (globalThis as any).eBookConfig = {};

    const { result } = renderHook(() => useJwtUser(), { wrapper });

    expect(result.current.username).toBeNull();
  });

  it("extracts username from a valid, non-expired JWT cookie", () => {
    const token = buildJwt({ sub: "alice", exp: futureExp() });
    setCookie(`access_token=${token}`);
    (globalThis as any).eBookConfig = {};

    const { result } = renderHook(() => useJwtUser(), { wrapper });

    expect(result.current.username).toBe("alice");
  });

  it("returns null when JWT token is expired", () => {
    const token = buildJwt({ sub: "bob", exp: pastExp() });
    setCookie(`access_token=${token}`);
    (globalThis as any).eBookConfig = {};

    const { result } = renderHook(() => useJwtUser(), { wrapper });

    expect(result.current.username).toBeNull();
  });

  it("returns null when JWT token payload is malformed", () => {
    setCookie("access_token=not.a.valid.jwt.at.all");
    (globalThis as any).eBookConfig = {};

    const { result } = renderHook(() => useJwtUser(), { wrapper });

    expect(result.current.username).toBeNull();
  });

  it("falls back to eBookConfig username when no access_token cookie exists", () => {
    setCookie("");
    (globalThis as any).eBookConfig = { username: "carol" };

    const { result } = renderHook(() => useJwtUser(), { wrapper });

    expect(result.current.username).toBe("carol");
  });

  it("prefers JWT token over eBookConfig when a valid token is present", () => {
    const token = buildJwt({ sub: "dave", exp: futureExp() });
    setCookie(`access_token=${token}`);
    (globalThis as any).eBookConfig = { username: "carol" };

    const { result } = renderHook(() => useJwtUser(), { wrapper });

    expect(result.current.username).toBe("dave");
  });

  it("ignores surrounding whitespace around the cookie value", () => {
    const token = buildJwt({ sub: "eve", exp: futureExp() });
    setCookie(`other=x; access_token= ${token} ; another=y`);
    (globalThis as any).eBookConfig = {};

    const { result } = renderHook(() => useJwtUser(), { wrapper });

    expect(result.current.username).toBe("eve");
  });

  it("returns null when JWT sub is an empty string because the hook does not update state for falsy sub", () => {
    const token = buildJwt({ sub: "" });
    setCookie(`access_token=${token}`);
    (globalThis as any).eBookConfig = {};

    const { result } = renderHook(() => useJwtUser(), { wrapper });

    expect(result.current.username).toBeNull();
  });

  it("returns a username when JWT has no exp claim (non-expiring token)", () => {
    const token = buildJwt({ sub: "frank" });
    setCookie(`access_token=${token}`);
    (globalThis as any).eBookConfig = {};

    const { result } = renderHook(() => useJwtUser(), { wrapper });

    expect(result.current.username).toBe("frank");
  });
});
