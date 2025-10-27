import { useEffect, useState } from 'react';

export function useVisualViewport() {
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
    offsetTop: 0,
    isKeyboardVisible: false,
  });

  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    const handler = () => {
      const offsetTop = visualViewport.offsetTop ?? 0;
      const isKeyboardVisible = window.innerHeight - visualViewport.height > 150;

      setViewport({
        width: visualViewport.width,
        height: visualViewport.height,
        offsetTop,
        isKeyboardVisible,
      });
    };

    visualViewport.addEventListener('resize', handler);
    visualViewport.addEventListener('scroll', handler);

    return () => {
      visualViewport.removeEventListener('resize', handler);
      visualViewport.removeEventListener('scroll', handler);
    };
  }, []);

  return viewport;
}