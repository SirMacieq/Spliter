import { useState, useCallback } from 'react';
import { Alert } from 'react-native';

interface UseErrorHandlerOptions {
  showAlert?: boolean;
  onError?: (error: Error) => void;
}

export const useErrorHandler = (options: UseErrorHandlerOptions = {}) => {
  const { showAlert = true, onError } = options;
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const handleError = useCallback((err: unknown) => {
    const errorMessage = err instanceof Error 
      ? err.message 
      : 'An unexpected error occurred';
    
    setError(errorMessage);
    
    if (showAlert) {
      Alert.alert('Error', errorMessage);
    }
    
    if (onError && err instanceof Error) {
      onError(err);
    }
    
    console.error('Error:', err);
  }, [showAlert, onError]);
  
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  const wrapAsync = useCallback(<T,>(fn: () => Promise<T>) => {
    return async () => {
      setIsLoading(true);
      setError(null);
      try {
        return await fn();
      } catch (err) {
        handleError(err);
        return undefined;
      } finally {
        setIsLoading(false);
      }
    };
  }, [handleError]);
  
  return {
    error,
    isLoading,
    setError,
    clearError,
    handleError,
    wrapAsync,
    setIsLoading,
  };
};
