import React from "react";
import ReactDOM from "react-dom/client";

import "./index.css";
import { Provider } from "react-redux";

import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { fetchAssignments } from "./state/assignment/assignSlice";
import { fetchChooserData } from "./state/epicker/ePickerSlice";
import store from "./state/store";

import { PrimeReactProvider } from "primereact/api";

/**
 * @description This is the main function that is called when the page is loaded.
 */
async function main() {
  try {
    store.dispatch(fetchAssignments());
  } catch (error) {
    console.error(error);
  }
  store.dispatch(
    fetchChooserData({ skipreading: false, from_source_only: true, pages_only: false }),
  );

  const root = ReactDOM.createRoot(document.getElementById("root"));

  root.render(
    <Provider store={store}>
      <PrimeReactProvider>
        <App />
      </PrimeReactProvider>
    </Provider>,
  );
}
main();
// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals(console.log);
