export const Icons = {
  ADVISORY: "☢",
  CHECKING: "🗘",
  PENDING: "⭳",
  UPDATABLE: "⚠",
}

export const Margins = {
  MARGIN_INITIAL: { margin: `0 0 0 2ch` }, // First decoration on line (two spaces from code).
  MARGIN_THEN: { margin: `0 0 0 1ch` }, // Next decorations on line (one space between).
}

export const ThemeLight = {
  DEFAULT: { color: "silver" }, // Eg. "update available" and checking icon

  ICON_ADVISORY: { color: "#A31515" },
  ICON_AVAILABLE: { color: "gray" },
  ICON_UPDATABLE: { color: "gold" },

  LABEL_ADVISORY: { color: "#A31515" }, // Eg. "Security advisory (HIGH/7.7):"
  LABEL_ADVISORY_TITLE: { color: "#ef8585" }, // Eg. "package vulnerable to Prototype Pollution"
  LABEL_FORMALIZATION: { color: "silver" }, // Eg. "already installed, just formalization"
  LABEL_MAJOR: { color: "#A31515" }, // Eg. "caution: major update!"
  LABEL_PENDING: { color: "gray" }, // Eg. "install pending"
  LABEL_PRERELEASE: { color: "#0451A5" }, // Eg. "<pre-release>"
  LABEL_UPDATABLE: { color: "gray" }, // Eg. "update available"
  LABEL_VERSION: { color: "#001080" }, // Eg. "3.0.1"
}

export const ThemeDark = {
  DEFAULT: { color: "gray" },

  ICON_ADVISORY: { color: "#F97583" },
  ICON_AVAILABLE: { color: "silver" },
  ICON_UPDATABLE: { color: "yellow" },

  LABEL_ADVISORY: { color: "#F97583" },
  LABEL_ADVISORY_TITLE: { color: "#cd3e4d" },
  LABEL_FORMALIZATION: { color: "gray" },
  LABEL_MAJOR: { color: "#F97583" },
  LABEL_PENDING: { color: "silver" },
  LABEL_PRERELEASE: { color: "#B392F0" },
  LABEL_UPDATABLE: { color: "silver" },
  LABEL_VERSION: { color: "#9CDCFE" },
}
