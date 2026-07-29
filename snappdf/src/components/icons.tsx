/**
 * アイコン集（インライン SVG）。
 * アイコンライブラリに依存せず、テーマ色（currentColor）に追従させる。
 */

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 20, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconDocument = (p: IconProps) => (
  <Base {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </Base>
);

export const IconImages = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="5" width="14" height="12" rx="2" />
    <path d="M7 21h10a4 4 0 0 0 4-4V9" />
    <circle cx="8" cy="9.5" r="1.3" />
    <path d="M3.5 15.5 8 11.5l5 4.5" />
  </Base>
);

export const IconPlus = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const IconCamera = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
    <circle cx="12" cy="13" r="3.4" />
  </Base>
);

export const IconTrash = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  </Base>
);

export const IconCopy = (p: IconProps) => (
  <Base {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h8" />
  </Base>
);

export const IconRotate = (p: IconProps) => (
  <Base {...p}>
    <path d="M20 11a8 8 0 1 0-2.3 5.7" />
    <path d="M20 4v6h-6" />
  </Base>
);

export const IconRotateLeft = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 11a8 8 0 1 1 2.3 5.7" />
    <path d="M4 4v6h6" />
  </Base>
);

export const IconCrop = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 2v14a2 2 0 0 0 2 2h14" />
    <path d="M2 6h14a2 2 0 0 1 2 2v14" />
  </Base>
);

export const IconEdit = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 20h4l10-10a2.8 2.8 0 1 0-4-4L4 16z" />
  </Base>
);

export const IconSort = (p: IconProps) => (
  <Base {...p}>
    <path d="M7 4v16M7 20l-3-3M7 20l3-3" />
    <path d="M14 7h7M14 12h5M14 17h3" />
  </Base>
);

export const IconDrag = (p: IconProps) => (
  <Base {...p}>
    <circle cx="9" cy="6" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="9" cy="18" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="15" cy="18" r="1.4" fill="currentColor" stroke="none" />
  </Base>
);

export const IconClose = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Base>
);

export const IconCheck = (p: IconProps) => (
  <Base {...p}>
    <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
  </Base>
);

export const IconSettings = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
  </Base>
);

export const IconMore = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
  </Base>
);

export const IconSun = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
  </Base>
);

export const IconMoon = (p: IconProps) => (
  <Base {...p}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
  </Base>
);

export const IconDownload = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3v12M12 15l-4-4M12 15l4-4" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </Base>
);

export const IconShare = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3v13M12 3 8 7M12 3l4 4" />
    <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </Base>
);

export const IconPrint = (p: IconProps) => (
  <Base {...p}>
    <path d="M7 9V4h10v5" />
    <rect x="3" y="9" width="18" height="8" rx="2" />
    <path d="M7 14h10v6H7z" />
  </Base>
);

export const IconCompress = (p: IconProps) => (
  <Base {...p}>
    <path d="M9 4v5H4M15 20v-5h5" />
    <path d="M4 20l5-5M20 4l-5 5" />
  </Base>
);

export const IconSplit = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3v6M12 15v6" />
    <path d="M4 12h16" strokeDasharray="3 3" />
  </Base>
);

export const IconMerge = (p: IconProps) => (
  <Base {...p}>
    <path d="M8 3v6a4 4 0 0 0 4 4h8" />
    <path d="M20 13l-3-3M20 13l-3 3" />
    <path d="M8 21v-6" />
  </Base>
);

export const IconText = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 6V4h14v2M12 4v16M9 20h6" />
  </Base>
);

export const IconWand = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 19 17 7" />
    <path d="M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />
    <path d="M19.5 11.5l.6 1.2 1.2.6-1.2.6-.6 1.2-.6-1.2-1.2-.6 1.2-.6z" />
  </Base>
);

export const IconChevronLeft = (p: IconProps) => (
  <Base {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Base>
);

export const IconChevronRight = (p: IconProps) => (
  <Base {...p}>
    <path d="M9 5l7 7-7 7" />
  </Base>
);

export const IconArrowLeft = (p: IconProps) => (
  <Base {...p}>
    <path d="M20 12H4M4 12l6-6M4 12l6 6" />
  </Base>
);

export const IconHistory = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
    <path d="M3 4v5h5" />
    <path d="M12 7.5V12l3 2" />
  </Base>
);

export const IconArrowUp = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 20V4M12 4l-6 6M12 4l6 6" />
  </Base>
);

export const IconArrowDown = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4v16M12 20l-6-6M12 20l6-6" />
  </Base>
);
