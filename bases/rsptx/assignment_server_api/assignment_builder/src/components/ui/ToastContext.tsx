import { Toast, ToastMessage } from "primereact/toast";
import { createContext, ReactNode, useContext, useRef } from "react";

// create context
const ToastContext = createContext<{
  showToast: (options: ToastMessage) => void;
  clearToast: VoidFunction;
}>({
  showToast: () => {},
  clearToast: () => {}
});

// wrap context provider to add functionality
export const ToastContextProvider = ({ children }: { children: ReactNode }) => {
  const toastRef = useRef<Toast>(null);

  const showToast = (options: ToastMessage) => {
    if (!toastRef.current) return;
    toastRef.current.show(options);
  };

  const clearToast = () => {
    if (!toastRef.current) return;
    toastRef.current.clear();
  };

  return (
    <ToastContext.Provider value={{ showToast, clearToast }}>
      <Toast ref={toastRef} />
      <div>{children}</div>
    </ToastContext.Provider>
  );
};

export const useToastContext = () => {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToastContext have to be used within ToastContextProvider");
  }

  return context;
};
