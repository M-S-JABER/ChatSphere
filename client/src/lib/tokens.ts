/**
 * ChatSphere Design Tokens
 * -----------------------
 * A centralized set of variables for consistent spacing, sizing, and z-index throughout the app.
 */

export const tokens = {
  // Z-index stack
  zIndex: {
    base: 1,
    drawer: 20,
    header: 30,
    composer: 30,
    modal: 40,
    tooltip: 50,
    toast: 60,
  },

  // Spacing scale (in pixels)
  spacing: {
    1: '4px',    // Fine details
    2: '8px',    // Tight spacing
    3: '12px',   // Default spacing
    4: '16px',   // Medium spacing
    5: '20px',   // Large spacing
    6: '24px',   // Section spacing
    8: '32px',   // Component spacing
    10: '40px',  // Layout spacing
    12: '48px',  // Container spacing
    16: '64px',  // Page spacing
  },

  // Icon sizes 
  icon: {
    xs: '16px',   // Fine details
    sm: '18px',   // Small icons
    md: '20px',   // Default size
    lg: '24px',   // Large icons
    xl: '32px',   // Extra large
  },

  // Border radii
  radius: {
    sm: '4px',    // Small elements
    md: '6px',    // Default radius
    lg: '8px',    // Large elements
    xl: '12px',   // Cards and panels
    full: '9999px', // Pills and rounded
  },

  // Fixed heights
  height: {
    header: '56px',
    composer: {
      min: '68px', // Base height
      max: '196px', // Height with 5 lines
    },
  },

  // Box shadows
  shadow: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  },
} as const;