/** @type {import("@commitlint/types").UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Scope should match module names
    "scope-enum": [
      1,
      "always",
      [
        "product",
        "po",
        "order",
        "receipt",
        "invoice",
        "putaway",
        "map",
        "picking",
        "packing",
        "shipping",
        "load-planning",
        "transfer",
        "move",
        "inventory",
        "dashboard",
        "auth",
        "shell",
        "shared",
        "ui",
        "rules",
        "config",
        "deps",
        "ci",
      ],
    ],
  },
};
