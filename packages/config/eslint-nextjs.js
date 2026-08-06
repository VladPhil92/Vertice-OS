/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: [
    "./eslint-base.js",
    "next/core-web-vitals",
  ],
  rules: {
    // Next.js usa <Image> en lugar de <img> — advertir en lugar de error para facilitar migración
    "@next/next/no-img-element": "warn",

    // Permitir el uso de href en <a> cuando se navega fuera del app
    "@next/next/no-html-link-for-pages": "off",
  },
};
