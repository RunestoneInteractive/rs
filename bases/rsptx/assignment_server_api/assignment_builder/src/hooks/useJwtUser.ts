import { useEffect, useCallback, useState } from "react";
import { useDispatch } from "react-redux";
// At the top of your TypeScript file or in a separate `globals.d.ts` file
declare var eBookConfig: {
  username?: string;
  // add other known properties here
};
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
        // If no token is found, check if eBookConfig has a username
        if (eBookConfig && eBookConfig.username) {
          setUsername(eBookConfig.username);
          return;
        }
        // If no token and no username in eBookConfig, log a message        
        console.log("No JWT token found in cookies and no username in eBookConfig.");
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
