import * as path from 'path';

/**
 * Disallow passing through the root of the app with relative imports.
 *
 * It is easier to read `import foo from 'app/baz';` than reasoning on where
 * `import foo from '../../../baz';` is pointing to.
 */
export default {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'Disallow passing through root of module with relative imports',
    },
    messages: {
      relativeRoot: 'Root of application cannot be imported with relative path',
    },
    schema: [],
  },
  create(context) {
    const appRoot = path.resolve(context.cwd, 'src', 'app');

    function check(source) {
      if (!source || typeof source.value !== 'string' || !source.value.startsWith('.')) {
        return;
      }
      const relativePart = [];
      const remainingPart = [];
      // imports always use '/'
      for (const part of source.value.split('/')) {
        if ((part === '.' || part === '..') && remainingPart.length === 0) {
          relativePart.push(part);
        } else {
          remainingPart.push(part);
        }
      }
      const relativeRoot = path.resolve(path.dirname(context.filename), ...relativePart);
      if (relativeRoot === appRoot) {
        context.report({
          node: source,
          messageId: 'relativeRoot',
          fix: fixer => fixer.replaceText(source, `'${['app', ...remainingPart].join('/')}'`),
        });
      }
    }

    return {
      ImportDeclaration: node => check(node.source),
      ExportNamedDeclaration: node => check(node.source),
      ExportAllDeclaration: node => check(node.source),
      ImportExpression: node => check(node.source),
    };
  },
};
