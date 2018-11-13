import { declare } from '@babel/helper-plugin-utils';
import { template, types as t } from '@babel/core';
import kebab from 'lodash.kebabcase';
import snake from 'lodash.snakecase';
import camel from 'lodash.camelcase';
import pathLib from 'path'

function barf(msg) {
  throw new Error('babel-plugin-transform-modules: ' + msg);
}

function transform(transformOption, importName, styleName?:string, hasImportName?:boolean) {
  var isFunction = typeof transformOption === 'function';
  if (/\.js$/i.test(transformOption) || isFunction) {
      var transformFn;

      try {
          transformFn = isFunction ? transformOption : require(transformOption);
      } catch (error) {
          barf('failed to require transform file ' + transformOption);
      }

      if (typeof transformFn !== 'function') {
          barf('expected transform function to be exported from ' + transformOption);
      }

      return transformFn(importName, styleName, hasImportName);
  }
  if (styleName) {
      if (!hasImportName && importName === styleName) {
          importName += '.css'
      } else {
          importName += '/' + styleName + '.css'
      }
  }
  return transformOption.replace(/\$\{\s?member\s?\}/ig, importName);
}

function parseStyleOption(style) {
  var styleOption;
  if (style === true) {
      styleOption = {
          name: 'style',
          ignore: []
      };
  } else if (typeof style === 'string') {
      styleOption = {
          name: style,
          ignore: []
      };
  } else {
      styleOption = {
          name: style.name || 'style',
          ignore: style.ignore || []
      };
  }
  return styleOption;
}

function handleStyleImport(opts, styleTransforms, importName?:string) {
  if (opts.style) {
      var styleOption = parseStyleOption(opts.style);
      var styleName = styleOption.name;
      var ignore = styleOption.ignore;
      var hasImportName = !!importName;
      if (!importName) {
          importName = styleName;
      }
      if (ignore.indexOf(importName) >= 0) {
          return
      }
      var replace = transform(opts.transform, importName, styleName, hasImportName);
      styleTransforms.push(t.importDeclaration([], t.stringLiteral(replace)))
  }
}


export default declare((api, options) => {
  api.assertVersion(7);

  const state = {
    globals: new Set(),
    renamed: new Map(),
    identifiers: new Map(),
    isCJS: false,
  };

  const enter = path => {
    let cursor = path;

    // Find the closest function scope or parent.
    do {
      // Ignore block statements.
      if (t.isBlockStatement(cursor.scope.path)) {
        continue;
      }

      if (t.isFunction(cursor.scope.path) || t.isProgram(cursor.scope.path)) {
        break;
      }
    } while (cursor = cursor.scope.path.parentPath);

    if (t.isProgram(cursor.scope.path)) {
      const nodes = [];
      const inner = [];

      // Break up the program, separate Nodes added by us from the nodes
      // created by the user.
      cursor.scope.path.node.body.filter(node => {
        // Keep replaced nodes together, these will not be wrapped.
        if (node.__replaced) {
          nodes.push(node);
        }
        else {
          inner.push(node);
        }
      });

      const program = t.program([
        ...nodes,
        t.expressionStatement(
          t.callExpression(
            t.memberExpression(
              t.functionExpression(
                null,
                [],
                t.blockStatement(inner),
              ),
              t.identifier('call'),
            ),
            [t.identifier('module.exports')],
          )
        ),
      ]);

      cursor.scope.path.replaceWith(program);
      state.isCJS = true;
    }
  };

  return {
    post() {
      state.globals.clear();
      state.renamed.clear();
      state.identifiers.clear();
      state.isCJS = false;
    },

    visitor: {
      ImportDeclaration: (path, state)=>{
      let source = path.node.source.value
      if (!(source in state.opts) && source.match(/^\.{0,2}\//)) {
        source = pathLib.resolve(pathLib.join(
            source[0] === '/' ? '' : pathLib.dirname(state.file.opts.filename),
            source
        ));
    }

    if (source in state.opts) {
      var opts = state.opts[source];

      if (!opts.transform) {
          barf('transform option is required for module ' + source);
      }

      var transforms = [];
      var styleTransforms = [];

      var fullImports = path.node.specifiers.filter(function(specifier) { return specifier.type !== 'ImportSpecifier' });
      var memberImports = path.node.specifiers.filter(function(specifier) { return specifier.type === 'ImportSpecifier' });

      if (fullImports.length > 0) {
          // Examples of "full" imports:
          //      import * as name from 'module'; (ImportNamespaceSpecifier)
          //      import name from 'module'; (ImportDefaultSpecifier)

          if (opts.preventFullImport) {
              barf('import of entire module ' + source + ' not allowed due to preventFullImport setting');
          }

          if (memberImports.length > 0) {
              // Swap out the import with one that doesn't include member imports.  Member imports should each get their own import line
              // transform this:
              //      import Bootstrap, { Grid } from 'react-bootstrap';
              // into this:
              //      import Bootstrap from 'react-bootstrap';
              transforms.push(t.importDeclaration(fullImports, t.stringLiteral(source)));
          }
          handleStyleImport(opts, styleTransforms);
      }
      var hasFullStyleImports = styleTransforms.length > 0
      memberImports.forEach(function(memberImport) {
          // Examples of member imports:
          //      import { member } from 'module'; (ImportSpecifier)
          //      import { member as alias } from 'module' (ImportSpecifier)

          // transform this:
          //      import { Grid as gird } from 'react-bootstrap';
          // into this:
          //      import gird from 'react-bootstrap/lib/Grid';
          // or this, if skipDefaultConversion = true:
          //      import { Grid as gird } from 'react-bootstrap/lib/Grid';

          var importName = memberImport.imported.name;
          if (opts.camelCase) importName = camel(importName);
          if (opts.kebabCase) importName = kebab(importName);
          if (opts.snakeCase) importName = snake(importName);

          var replace = transform(opts.transform, importName);

          var newImportSpecifier = (opts.skipDefaultConversion)
              ? memberImport
              : t.importDefaultSpecifier(t.identifier(memberImport.local.name));

          transforms.push(t.importDeclaration(
              [newImportSpecifier],
              t.stringLiteral(replace)
          ));
          !hasFullStyleImports && handleStyleImport(opts, styleTransforms, importName);
      });

      if (transforms.length > 0) {
          path.replaceWithMultiple(transforms.concat(styleTransforms));
      } else if (styleTransforms.length) {
          path.insertAfter(styleTransforms);
      }
  }

      },
      
    },
  };
});
