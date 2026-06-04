import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import interWoff2 from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.layer.css";
import "@mantine/dates/styles.layer.css";
import "@mantine/dropzone/styles.layer.css";
import "@mantine/notifications/styles.layer.css";
import "@mantine/tiptap/styles.layer.css";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import "./styles/utilities.css";
import "./styles/tokens.css";
import "./styles/typography.css";
import "./styles/global.css";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Provider } from "react-redux";

import { store } from "@/state/store";

import App from "./App.js";
import reportWebVitals from "./reportWebVitals";
import { mantineTheme } from "./theme/mantineTheme";

/**
 * @description This is the main function that is called when the page is loaded.
 */
const main = () => {
  const fontPreload = document.createElement("link");

  fontPreload.rel = "preload";
  fontPreload.as = "font";
  fontPreload.type = "font/woff2";
  fontPreload.href = interWoff2;
  fontPreload.crossOrigin = "anonymous";
  document.head.prepend(fontPreload);

  const root = createRoot(document.getElementById("root")!);

  root.render(
    <Provider store={store}>
      <MantineProvider theme={mantineTheme} defaultColorScheme="light">
        <ModalsProvider>
          <Notifications position="bottom-right" autoClose={4000} transitionDuration={320} />
          <App />
        </ModalsProvider>
      </MantineProvider>
    </Provider>
  );
};

main();
// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals(console.log);
