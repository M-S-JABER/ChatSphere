import { useCallback, useEffect, useState } from 'react';

export function useMobileKeyboardDetection() {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const handleResize = useCallback(() => {
    // On iOS, window.innerHeight gets smaller when the keyboard is visible
    const isKeyboard = window.innerHeight < window.outerHeight * 0.8;
    setIsKeyboardVisible(isKeyboard);
  }, []);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  return isKeyboardVisible;
}