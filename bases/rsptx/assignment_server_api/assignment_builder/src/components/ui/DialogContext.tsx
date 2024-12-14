import { Dialog, DialogProps } from "primereact/dialog";
import { createContext, ReactNode, useContext, useState } from "react";
// create context
const DialogContext = createContext<{
  showDialog: (options: Partial<DialogProps>) => void;
  hideDialog: VoidFunction;
}>({
  showDialog: () => {},
  hideDialog: () => {}
});

// wrap context provider to add functionality
export const DialogContextProvider = ({ children }: { children: ReactNode }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [props, setProps] = useState({});

  const showDialog = (options: Partial<DialogProps>) => {
    setProps(options);
    setIsVisible(true);
  };

  const hideDialog = () => {
    setProps({});
    setIsVisible(false);
  };

  return (
    <DialogContext.Provider value={{ showDialog, hideDialog }}>
      <Dialog {...props} visible={isVisible} onHide={() => setIsVisible(false)} />
      <div>{children}</div>
    </DialogContext.Provider>
  );
};

export const useDialogContext = () => {
  const context = useContext(DialogContext);

  if (!context) {
    throw new Error("useDialogContext have to be used within DialogContextProvider");
  }

  return context;
};
