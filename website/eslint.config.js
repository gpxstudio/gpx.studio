import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
    {
        ignores: ['build/', '.svelte-kit/', 'package/'],
    },
    js.configs.recommended,
    ...ts.configs['flat/recommended'],
    ...svelte.configs['flat/recommended'],
    prettier,
    ...svelte.configs['flat/prettier'],
    {
        languageOptions: {
            globals: { ...globals.browser, ...globals.node },
        },
    },
    {
        rules: {
            // TypeScript already reports undefined names
            'no-undef': 'off',
            'no-empty': ['error', { allowEmptyCatch: true }],
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
        },
    },
    {
        files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
        languageOptions: {
            parserOptions: {
                parser: tsParser,
                extraFileExtensions: ['.svelte'],
            },
        },
        rules: {
            // $effect dependencies are tracked by reading them
            '@typescript-eslint/no-unused-expressions': 'off',
        },
    },
];
