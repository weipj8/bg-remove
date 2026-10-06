import type { ReactNode, SVGProps } from "react";

/**
 * The mark is the product's actual job: a square whose background has been cut away,
 * leaving the subject on a transparency checkerboard.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" focusable="false">
        <defs>
          <pattern id="wm-check" width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="#12171C" />
            <rect width="3" height="3" fill="#1B2229" />
            <rect x="3" y="3" width="3" height="3" fill="#1B2229" />
          </pattern>
        </defs>
        <rect width="22" height="22" rx="4" fill="url(#wm-check)" />
        <circle cx="11" cy="7.2" r="3" fill="#C4F135" />
        <path d="M4.8 18.6c0-3.4 2.8-5.6 6.2-5.6s6.2 2.2 6.2 5.6Z" fill="#C4F135" />
      </svg>
      <span className="font-mono text-sm font-medium tracking-tighter text-paper">
        bg<span className="text-lime">-</span>remove
      </span>
    </span>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="label text-lime">{children}</p>;
}

export function SectionHeader({
  id,
  eyebrow,
  title,
  lede
}: {
  id: string;
  eyebrow: string;
  title: string;
  lede?: string;
}) {
  return (
    <div className="max-w-prose">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={id} className="mt-3 font-display text-2xl sm:text-3xl">
        {title}
      </h2>
      {lede && <p className="mt-3 text-base text-mute">{lede}</p>}
    </div>
  );
}

export function Chip({
  tone = "neutral",
  children
}: {
  tone?: "neutral" | "good" | "warn" | "bad";
  children: ReactNode;
}) {
  const tones = {
    neutral: "text-mute ring-line",
    good: "text-lime ring-lime/30",
    warn: "text-amber ring-amber/30",
    bad: "text-coral ring-coral/30"
  } as const;
  return (
    <span
      className={`readout inline-flex items-center gap-1.5 rounded-sm bg-ink-900 px-2 py-1 text-xs ring-1 ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
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

export const IconUpload = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 16V4m0 0L8 8m4-4 4 4" />
    <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
  </Icon>
);

export const IconDownload = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4v12m0 0 4-4m-4 4-4-4" />
    <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </Icon>
);

export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="m4 12.5 5 5L20 6.5" />
  </Icon>
);

export const IconAlert = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 8v5m0 3h.01" />
    <path d="M10.3 3.9 2.4 18a1.9 1.9 0 0 0 1.7 2.9h15.8a1.9 1.9 0 0 0 1.7-2.9L13.7 3.9a1.9 1.9 0 0 0-3.4 0Z" />
  </Icon>
);

export const IconRefresh = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 12a8 8 0 1 1-2.4-5.7" />
    <path d="M20 4v4h-4" />
  </Icon>
);

export const IconPencil = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15.2 4.8a2.3 2.3 0 0 1 3.2 3.2L7.5 18.9 3.8 20.2l1.3-3.7Z" />
  </Icon>
);

export const IconTrash = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M10 4h4M6 7l1 13h10l1-13" />
  </Icon>
);

export const IconClose = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const IconShield = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.2 5 5.8v5.6c0 4.2 2.9 7.4 7 9.4 4.1-2 7-5.2 7-9.4V5.8Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Icon>
);

export const IconCpu = (p: IconProps) => (
  <Icon {...p}>
    <rect x="7" y="7" width="10" height="10" rx="2" />
    <path d="M11 3v2M13 3v2M11 19v2M13 19v2M3 11h2M3 13h2M19 11h2M19 13h2" />
  </Icon>
);
