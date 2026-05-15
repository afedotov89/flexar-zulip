// Flexar Hub Web — own icon set (ENGINEERING_GUIDE §5).
//
// These are Flexar Hub's own geometric line icons — NOT FontAwesome,
// NOT Zulip's icon set. Convention (consistent across every icon):
//   - 24×24 viewBox
//   - stroke-based: paths are drawn with `currentColor` as stroke,
//     never filled. The `Icon` primitive sets stroke width, linecap,
//     and linejoin once; each entry here is pure geometry.
//   - each value is the inner SVG markup (one or more <path>/<line>/
//     <circle> elements) as a string.
//
// To add an icon: append a `name: '<svg geometry>'` entry. The
// `IconName` union and `Icon`'s `name` prop update automatically.

export const icons = {
  search:
    '<circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16" y2="16" />',
  close: '<line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />',
  check: '<polyline points="4 12 10 18 20 6" />',
  "chevron-down": '<polyline points="6 9 12 15 18 9" />',
  "chevron-right": '<polyline points="9 6 15 12 9 18" />',
  plus: '<line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />',
  hash: '<line x1="9" y1="4" x2="7" y2="20" /><line x1="17" y1="4" x2="15" y2="20" /><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" />',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />',
  bell: '<path d="M6 16V10a6 6 0 0 1 12 0v6l2 3H4l2-3Z" /><path d="M10 19a2 2 0 0 0 4 0" />',
  "dots-vertical":
    '<circle cx="12" cy="5" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="12" cy="19" r="1.4" />',
  paperclip:
    '<path d="M20 11.5 12 19.5a5 5 0 0 1-7-7l8.5-8.5a3.5 3.5 0 0 1 5 5L13 17a2 2 0 0 1-3-3l7-7" />',
  smile:
    '<circle cx="12" cy="12" r="9" /><line x1="9" y1="10" x2="9" y2="10" /><line x1="15" y1="10" x2="15" y2="10" /><path d="M8 14.5a5 5 0 0 0 8 0" />',
  info:
    '<circle cx="12" cy="12" r="9" /><line x1="12" y1="11" x2="12" y2="16" /><line x1="12" y1="8" x2="12" y2="8" />',
  warning:
    '<path d="M12 4 2 20h20L12 4Z" /><line x1="12" y1="10" x2="12" y2="14" /><line x1="12" y1="17" x2="12" y2="17" />',
  error:
    '<circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="13" /><line x1="12" y1="16" x2="12" y2="16" />',
  inbox:
    '<path d="M3 13 6 4h12l3 9v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6Z" /><path d="M3 13h5a1 1 0 0 1 1 1 3 3 0 0 0 6 0 1 1 0 0 1 1-1h5" />',
  recent:
    '<circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 16 14" />',
  "combined-feed":
    '<rect x="3" y="4" width="18" height="6" rx="1" /><rect x="3" y="14" width="18" height="6" rx="1" />',
  mentions:
    '<circle cx="12" cy="12" r="4" /><path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1" />',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z" />',
  drafts:
    '<path d="M7 3h7l5 5v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><polyline points="14 3 14 8 19 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="16" x2="13" y2="16" />',
  schedule:
    '<rect x="4" y="6" width="16" height="14" rx="2" /><line x1="4" y1="10" x2="20" y2="10" /><line x1="9" y1="4" x2="9" y2="8" /><line x1="15" y1="4" x2="15" y2="8" /><circle cx="12" cy="15" r="2" />',
  trash:
    '<polyline points="4 7 20 7" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" /><line x1="10" y1="11" x2="10" y2="18" /><line x1="14" y1="11" x2="14" y2="18" />',
} as const;

export type IconName = keyof typeof icons;

export const iconNames = Object.keys(icons) as IconName[];
