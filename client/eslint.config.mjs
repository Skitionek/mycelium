// ESLint flat config, ported from the former tslint.json (tslint:recommended +
// codelyzer + local rules). Rule names in comments are the TSLint originals.
import angular from '@angular-eslint/eslint-plugin';
import angularTemplate from '@angular-eslint/eslint-plugin-template';
import angularTemplateParser from '@angular-eslint/template-parser';
import stylistic from '@stylistic/eslint-plugin';
import importX from 'eslint-plugin-import-x';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

import noRelativeImportOfRoot from './eslint-rules/no-relative-import-of-root.mjs';

export default defineConfig(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'storybook-static/**',
      'coverage/**',
      // Storybook requires each story to be a named export in PascalCase, which
      // the naming rules reject; the config files are not application code either.
      'src/**/*.stories.ts',
      '.storybook/**',
    ],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      '@angular-eslint': angular,
      '@stylistic': stylistic,
      'import-x': importX,
      local: {rules: {'no-relative-import-of-root': noRelativeImportOfRoot}},
    },
    rules: {
      // --- Angular (codelyzer) ---
      '@angular-eslint/component-class-suffix': 'error',
      '@angular-eslint/contextual-lifecycle': 'error',
      '@angular-eslint/directive-class-suffix': 'error',
      '@angular-eslint/directive-selector': ['error', {type: 'attribute', prefix: 'app', style: 'camelCase'}],
      '@angular-eslint/component-selector': ['error', {type: 'element', prefix: 'app', style: 'kebab-case'}],
      '@angular-eslint/no-inputs-metadata-property': 'error',
      '@angular-eslint/no-output-on-prefix': 'error',
      '@angular-eslint/no-outputs-metadata-property': 'error',
      '@angular-eslint/use-lifecycle-interface': 'error',
      '@angular-eslint/use-pipe-transform-interface': 'error',
      // codelyzer crashed on TypeScript 5 and never reported these; renaming the
      // existing aliased/native-named bindings changes component APIs, so they
      // are warnings until that is done.
      '@angular-eslint/no-input-rename': 'warn',
      '@angular-eslint/no-output-native': 'warn',
      '@angular-eslint/no-output-rename': 'warn',

      // --- Local rules ---
      'local/no-relative-import-of-root': 'error',

      // --- Imports ---
      // import-blacklist
      'no-restricted-imports': ['error', {paths: ['rxjs/Rx']}],
      // no-duplicate-imports (allow-namespace-imports)
      'import-x/no-duplicates': 'error',
      // ordered-imports: Angular, then 3rd party, then `app/`, then relative
      'import-x/order': ['error', {
        groups: [['builtin', 'external'], 'internal', ['parent', 'sibling', 'index']],
        pathGroups: [
          {pattern: '@angular/**', group: 'external', position: 'before'},
          {pattern: 'app/**', group: 'internal'},
        ],
        pathGroupsExcludedImportTypes: [],
        distinctGroup: false,
        'newlines-between': 'ignore',
      }],

      // --- TypeScript ---
      '@typescript-eslint/adjacent-overload-signatures': 'error',
      '@typescript-eslint/consistent-type-assertions': 'error', // no-angle-bracket-type-assertion
      '@typescript-eslint/consistent-type-definitions': 'error', // interface-over-type-literal
      '@typescript-eslint/member-ordering': ['error', {
        default: ['static-field', 'instance-field', 'static-method', 'instance-method'],
      }],
      '@typescript-eslint/naming-convention': ['error', // variable-name, class-name
        {selector: 'variable', format: ['camelCase', 'UPPER_CASE'], leadingUnderscore: 'allow', trailingUnderscore: 'allow'},
        {selector: 'variable', modifiers: ['destructured'], format: null},
        {selector: 'class', format: ['PascalCase']},
      ],
      '@typescript-eslint/no-deprecated': 'warn', // deprecation
      '@typescript-eslint/no-empty-object-type': ['error', {allowInterfaces: 'with-single-extends', allowObjectTypes: 'always'}], // no-empty-interface
      '@typescript-eslint/no-inferrable-types': ['error', {ignoreParameters: true}],
      '@typescript-eslint/no-misused-new': 'error',
      '@typescript-eslint/no-namespace': ['error', {allowDeclarations: true, allowDefinitionFiles: true}],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unsafe-function-type': 'error', // ban-types
      '@typescript-eslint/no-unused-expressions': ['error', {allowShortCircuit: true, allowTernary: true}],
      '@typescript-eslint/no-wrapper-object-types': 'error', // ban-types
      '@typescript-eslint/prefer-for-of': 'error',
      '@typescript-eslint/prefer-function-type': 'error', // callable-types
      '@typescript-eslint/triple-slash-reference': 'error', // no-reference
      '@typescript-eslint/unified-signatures': 'error',

      // --- Core ---
      curly: 'error',
      eqeqeq: ['error', 'always', {null: 'ignore'}], // triple-equals (allow-null-check)
      'guard-for-in': 'error', // forin
      'no-bitwise': 'error',
      'no-caller': 'error', // no-arg
      'no-cond-assign': 'error', // no-conditional-assignment
      'no-debugger': 'error',
      'no-eval': 'error',
      'no-fallthrough': 'error', // no-switch-case-fall-through
      'no-new-wrappers': 'error', // no-construct
      'no-restricted-properties': ['error', // no-console (debug, info, time, timeEnd, trace)
        ...['debug', 'info', 'time', 'timeEnd', 'trace'].map(property => ({object: 'console', property})),
      ],
      'no-throw-literal': 'error', // no-string-throw
      'no-undef-init': 'error', // no-unnecessary-initializer
      'no-unsafe-finally': 'error',
      'no-var': 'error', // no-var-keyword
      'object-shorthand': 'error', // object-literal-shorthand
      'prefer-arrow-callback': ['error', {allowNamedFunctions: true}], // only-arrow-functions
      'prefer-const': 'error',
      radix: 'error',

      // --- Formatting ---
      '@stylistic/eol-last': 'error', // eofline
      '@stylistic/max-len': ['error', {code: 140, ignoreUrls: true}], // max-line-length
      '@stylistic/new-parens': 'error',
      '@stylistic/no-trailing-spaces': 'error', // no-trailing-whitespace
      '@stylistic/quote-props': ['error', 'as-needed'], // object-literal-key-quotes
      '@stylistic/quotes': ['error', 'single', {avoidEscape: true, allowTemplateLiterals: 'always'}], // quotemark
      '@stylistic/semi': 'error', // semicolon
      '@stylistic/space-before-function-paren': ['error', {anonymous: 'never', asyncArrow: 'always', named: 'never'}],
      '@stylistic/spaced-comment': ['error', 'always', {line: {markers: ['/']}, block: {exceptions: ['*'], balanced: false}}], // comment-format
      '@stylistic/type-annotation-spacing': 'error', // typedef-whitespace
    },
  },
  {
    files: ['src/**/*.html'],
    languageOptions: {
      parser: angularTemplateParser,
    },
    plugins: {
      '@angular-eslint/template': angularTemplate,
    },
    rules: {
      '@angular-eslint/template/banana-in-box': 'error',
      '@angular-eslint/template/no-negated-async': 'error',
    },
  },
);
