/**
 * Hides an element from sight but not from screen readers. The sizes are strings because `sx`
 * reads a plain `1` as 100%, which made hidden labels as wide as the page.
 */
export const visuallyHidden = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  margin: '-1px',
  padding: 0,
  border: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;
