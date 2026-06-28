import type { NavigationAPI, DialogAPI } from "../types";

// Bridge for the few privileged operations that live in React state inside
// App.tsx (navigation history, the modal dialog, directory refresh). App connects
// a provider once; capabilities read through it. This is what lets `nav`, `dialog`
// and `app.refresh` capabilities exist without the core knowing about React.

interface AppProvider {
  getDirectory: () => string;
  getNavigation: () => NavigationAPI;
  getRefresh: () => () => void;
  getDialog: () => DialogAPI;
}

const emptyNav: NavigationAPI = {
  navigate: () => {},
  goBack: () => {},
  goForward: () => {},
  goUp: () => {},
  canGoBack: false,
  canGoForward: false,
};

const emptyDialog: DialogAPI = {
  prompt: () => Promise.resolve(null),
  confirm: () => Promise.resolve(false),
  choose: () => Promise.resolve(null),
  pickFile: () => Promise.resolve(null),
};

class AppBridgeClass {
  private provider: AppProvider | null = null;

  connect(provider: AppProvider): void {
    this.provider = provider;
  }

  getDirectory(): string {
    return this.provider?.getDirectory() ?? "/";
  }

  get nav(): NavigationAPI {
    return this.provider?.getNavigation() ?? emptyNav;
  }

  get dialog(): DialogAPI {
    return this.provider?.getDialog() ?? emptyDialog;
  }

  refresh(): void {
    this.provider?.getRefresh()();
  }
}

export const AppBridge = new AppBridgeClass();
