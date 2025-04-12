import { useEffect, useCallback, useState } from "react";
import { useDispatch } from "react-redux";

interface JwtPayload {
  sub: string;
  exp: number;
  [key: string]: any;
}

export const useJwtUser = (): {
  username: string | null;
} => {
  const dispatch = useDispatch();
  const [username, setUsername] = useState<string | null>(null);

  const decodeJwtToken = (token: string): JwtPayload | null => {
    try {
      // Get payload part of JWT (second part)
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );

      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error("Error decoding JWT token:", error);
      return null;
    }
  };

  const extractUsernameFromToken = useCallback((token: string) => {
    const payload = decodeJwtToken(token);

    if (!payload) {
      console.error("Invalid JWT token");
      return null;
    }

    // Check if token is expired
    const currentTime = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < currentTime) {
      console.warn("JWT token is expired");
      return null;
    }

    // Extract username from sub claim
    return payload.sub;
  }, []);

  useEffect(() => {
    const getTokenFromCookies = (): string | null => {
      const cookies = document.cookie.split(";");

      const tokenCookie = cookies.find((cookie) => cookie.trim().startsWith("access_token="));

      if (!tokenCookie) return null;

      return tokenCookie.split("=")[1].trim();
    };

    const extractUsername = () => {
      const token = getTokenFromCookies();

      if (!token) {
        console.log("No JWT token found in cookies");
        return;
      }

      const extractedUsername = extractUsernameFromToken(token);

      if (extractedUsername) {
        setUsername(extractedUsername);
      }
    };

    extractUsername();
  }, [dispatch, extractUsernameFromToken]);

  return {
    username
  };
};
