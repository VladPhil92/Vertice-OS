// ESLint 9 flat config — reemplaza .eslintrc.json (formato legacy).
// `next lint` de Next.js 14 no soporta ESLint 9, así que invocamos eslint
// directamente y cargamos la config de Next vía FlatCompat.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'coverage/**',
      'next-env.d.ts',
      'public/sw.js',
    ],
  },

  // Reglas de Next.js (core-web-vitals) cargadas desde la config legacy
  ...compat.extends('next/core-web-vitals'),

  // Reglas TypeScript propias de VÉRTICE
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
    },
  },

  // Reglas de seguridad y estilo (core de ESLint, sin plugin)
  {
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
];
