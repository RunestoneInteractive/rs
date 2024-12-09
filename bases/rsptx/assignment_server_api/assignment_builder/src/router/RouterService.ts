import { createBrowserRouter } from "react-router-dom";

class RouterService {
  private _router: ReturnType<typeof createBrowserRouter> | null = null;

  init(router: ReturnType<typeof createBrowserRouter>) {
    if (!this._router) this._router = router;

    return this._router;
  }

  destroy() {
    this._router = null;
  }

  get router() {
    if (!this._router) {
      throw new Error("There is no router instance...");
    }

    return this._router;
  }
}

export const routerService = new RouterService();
