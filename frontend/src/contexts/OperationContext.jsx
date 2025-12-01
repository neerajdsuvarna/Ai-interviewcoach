import { createContext, useContext, useState } from 'react';

const OperationContext = createContext();

export const OperationProvider = ({ children }) => {
  const [isOperationInProgress, setIsOperationInProgress] = useState(false);

  return (
    <OperationContext.Provider value={{ isOperationInProgress, setIsOperationInProgress }}>
      {children}
    </OperationContext.Provider>
  );
};

export const useOperation = () => {
  const context = useContext(OperationContext);
  if (!context) {
    // Return a default context if not within provider (for backward compatibility)
    return { isOperationInProgress: false, setIsOperationInProgress: () => {} };
  }
  return context;
};