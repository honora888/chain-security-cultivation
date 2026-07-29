import type { SVGProps } from "react";

export type QuestOneIconName =
  | "water-drop"
  | "realm-jindan"
  | "risk-high"
  | "boss"
  | "sword"
  | "target"
  | "code-scroll"
  | "vault"
  | "attacker"
  | "call"
  | "callback"
  | "reentry-loop"
  | "checks"
  | "effects"
  | "interactions"
  | "seal"
  | "bestiary"
  | "exp"
  | "mastery"
  | "badge"
  | "chain-proof"
  | "local-data";

interface QuestOneIconProps extends SVGProps<SVGSVGElement> {
  name: QuestOneIconName;
  title?: string;
}

const common = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  strokeWidth: 1.8,
};

export function QuestOneIcon({ name, title, ...props }: QuestOneIconProps) {
  const decorative = !title;

  return (
    <svg
      aria-hidden={decorative ? "true" : undefined}
      aria-label={title}
      focusable="false"
      role={decorative ? undefined : "img"}
      viewBox="0 0 24 24"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {name === "water-drop" ? (
        <path {...common} d="M12 3.2C8.7 7.4 6.4 10 6.4 13.3a5.6 5.6 0 0 0 11.2 0C17.6 10 15.3 7.4 12 3.2Z M9.6 14.1c.5 1.1 1.3 1.7 2.6 1.9" />
      ) : null}
      {name === "realm-jindan" ? (
        <><circle {...common} cx="12" cy="12" r="7.4" /><path {...common} d="m12 6.8 1.35 3.85L17.2 12l-3.85 1.35L12 17.2l-1.35-3.85L6.8 12l3.85-1.35L12 6.8Z" /></>
      ) : null}
      {name === "risk-high" ? (
        <><path {...common} d="M12 3.5 21 19H3L12 3.5Z" /><path {...common} d="M12 9v4.7M12 16.8h.01" /></>
      ) : null}
      {name === "boss" ? (
        <><path {...common} d="M5 8.5 8 5l2.2 2.1L12 4.5l1.8 2.6L16 5l3 3.5v7.2L16 19H8l-3-3.3V8.5Z" /><path {...common} d="M8.6 12h.01M15.4 12h.01M9.5 15.4h5" /></>
      ) : null}
      {name === "sword" ? <path {...common} d="m15.9 3.8 4.3 4.3-8.7 8.7-3.4.9.9-3.4 8.7-8.7ZM6.5 17.5l-2.7 2.7M8.2 19.2l-3.4-3.4" /> : null}
      {name === "target" ? <><circle {...common} cx="12" cy="12" r="7.2" /><circle {...common} cx="12" cy="12" r="2.5" /><path {...common} d="M12 2v2M22 12h-2M12 22v-2M2 12h2" /></> : null}
      {name === "code-scroll" ? <><path {...common} d="M6 4.5h10.6a2.4 2.4 0 1 1 0 4.8H7.4a2.4 2.4 0 1 0 0 4.8H17a2.4 2.4 0 1 1 0 4.8H6" /><path {...common} d="M8 4v16M16 4v16" /></> : null}
      {name === "vault" ? <><path {...common} d="M4 9.2 12 4l8 5.2v9.3H4V9.2Z" /><path {...common} d="M8 18.5v-5.7h8v5.7M12 9.3v.1" /></> : null}
      {name === "attacker" ? <><circle {...common} cx="12" cy="8" r="3" /><path {...common} d="M6.3 20c.6-3.8 2.5-5.7 5.7-5.7s5.1 1.9 5.7 5.7M17.8 7.2l2.4-1.6" /></> : null}
      {name === "call" ? <path {...common} d="M4 12h13M13 7l5 5-5 5" /> : null}
      {name === "callback" ? <path {...common} d="M20 8.5A8 8 0 0 0 6.3 6L4 8.2M4 4v4.2h4.2M4 15.5A8 8 0 0 0 17.7 18l2.3-2.2M20 20v-4.2h-4.2" /> : null}
      {name === "reentry-loop" ? <><path {...common} d="M18.8 9.1A7.2 7.2 0 0 0 6.7 7L4 9.5M4 5v4.5h4.5" /><path {...common} d="M5.2 14.9a7.2 7.2 0 0 0 12.1 2.1l2.7-2.5M20 19v-4.5h-4.5" /><path {...common} d="M12 8.2v7.6" /></> : null}
      {name === "checks" ? <><rect {...common} x="5" y="4" width="14" height="16" rx="2" /><path {...common} d="m8.5 12 2.1 2.1 4.9-5" /></> : null}
      {name === "effects" ? <><rect {...common} x="5" y="5" width="14" height="14" rx="1.5" /><path {...common} d="M8 8h8M8 12h5M8 16h8" /></> : null}
      {name === "interactions" ? <><path {...common} d="M4 8h16v10H4z" /><path {...common} d="M8 8V5h8v3M9 13h6M12 10v6" /></> : null}
      {name === "seal" ? <><path {...common} d="M12 3.5 19 7.2v6.5c0 3.7-2.9 5.8-7 6.8-4.1-1-7-3.1-7-6.8V7.2L12 3.5Z" /><path {...common} d="M8.7 12h6.6M12 8.7v6.6" /></> : null}
      {name === "bestiary" ? <><path {...common} d="M5 5.2h5.3c1.1 0 1.7.4 1.7 1.5v12c0-1.1-.6-1.5-1.7-1.5H5zM19 5.2h-5.3c-1.1 0-1.7.4-1.7 1.5v12c0-1.1.6-1.5 1.7-1.5H19z" /><path {...common} d="M8 9h2M14 9h2" /></> : null}
      {name === "exp" ? <><path {...common} d="M12 3.5 14 9l5.5 2-5.5 2L12 18.5 10 13l-5.5-2 5.5-2L12 3.5Z" /><path {...common} d="M18.5 16.5 20 20M16.5 18.5 20 20" /></> : null}
      {name === "mastery" ? <><circle {...common} cx="12" cy="12" r="7.8" /><path {...common} d="M12 5.7v12.6M7.2 9.1c1.4.8 2.9 1.2 4.8 1.2s3.4-.4 4.8-1.2M7.2 14.9c1.4-.8 2.9-1.2 4.8-1.2s3.4.4 4.8 1.2" /></> : null}
      {name === "badge" ? <><path {...common} d="M5.4 7.1 12 3.8l6.6 3.3v6.8L12 20.2l-6.6-6.3V7.1Z" /><rect {...common} x="9" y="8.5" width="6" height="6" rx=".8" /></> : null}
      {name === "chain-proof" ? <><path {...common} d="M8.2 15.8 5.7 18.3a2.8 2.8 0 1 1-4-4l2.5-2.5M15.8 8.2l2.5-2.5a2.8 2.8 0 1 1 4 4l-2.5 2.5M8.6 15.4l6.8-6.8" /></> : null}
      {name === "local-data" ? <><path {...common} d="M5 5h14v14H5z" /><path {...common} d="M8 9h8M8 13h5M8 17h8" /></> : null}
    </svg>
  );
}
