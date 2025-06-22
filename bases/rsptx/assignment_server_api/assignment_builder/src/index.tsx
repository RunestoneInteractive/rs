import { PrimeReactProvider } from "primereact/api";
import "primereact/resources/primereact.css";
import "primeflex/primeflex.css";
import "primeicons/primeicons.css";
import "./styles/layout.scss";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Provider } from "react-redux";

import { fetchAssignments } from "@/state/assignment/assignSlice";
import { fetchChooserData } from "@/state/epicker/ePickerSlice";
import { store } from "@/state/store";

import App from "./App.js";
import reportWebVitals from "./reportWebVitals";

/**
 * @description This is the main function that is called when the page is loaded.
 */
const main = () => {
  const root = createRoot(document.getElementById("root")!);

  root.render(
    <Provider store={store}>
      <PrimeReactProvider>
        <App />
      </PrimeReactProvider>
    </Provider>
  );
};

main();
// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals(console.log);
