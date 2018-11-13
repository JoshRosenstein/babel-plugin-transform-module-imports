# babel-plugin-transform-module-imports
 [![Build Status](https://travis-ci.org/JoshRosenstein/babel-plugin-transform-module-imports.svg?branch=master)](https://travis-ci.org/JoshRosenstein/babel-plugin-transform-module-imports?branch=master) [![codecov.io](http://codecov.io/github/JoshRosenstein/babel-plugin-transform-module-imports/coverage.svg?branch=master)](http://codecov.io/github/JoshRosenstein/babel-plugin-transform-module-imports?branch=master)

Fork of [babel-plugin-transform-modules](https://github.com/dolymood/babel-plugin-transform-modules) to Support babel7

## Installation

```
npm install --save-dev babel-plugin-transform-module-imports
```

## Usage

*In .babelrc:*

```json
{
    "plugins": [
        ["transform-module-imports", {
            "typed-is": {
                "transform": "typed-is/lib/${member}",
                "preventFullImport": true
            },
               "@roseys/futils": {
                "transform": "@roseys/futils/lib/${member}",
                "preventFullImport": true
            },
        }
        ]
    ]
}
```

Transforms member style imports:
```javascript
import { isFunction, isString} from 'typed-is';
import { reduce, pipe} from '@roseys/futils';
```
...into default style imports:
```javascript
import isFunction from 'typed-is/lib/isFunction';
import isString from 'typed-is/lib/isString';
import reduce from '@roseys/futils/lib/reduce';
import pipe from '@roseys/futils/lib/pipe';

```

## Options

| Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `transform` | `string` | yes | `undefined` | The library name to use instead of the one specified in the import statement.  `${member}` will be replaced with the member, aka Grid/Row/Col/etc.  Alternatively, pass a path to a .js file which exports a function to process the transform (see Advanced Transformations) |
| `style` | `boolean,string,object` | no | `false` | Whether or not auto add css style import, if set to `true`, it will be same as set to `'style'`. If set to `{name:'sty',ignore:['x', 'y']}`, it means all member modules except `['x', 'y']` will be auto add css import with name 'sty.css' |
| `preventFullImport` | `boolean` | no | `false` | Whether or not to throw when an import is encountered which would cause the entire module to be imported. |
| `camelCase` | `boolean` | no | `false` | When set to `true`, runs `${member}` through _.camelCase. |
| `kebabCase` | `boolean` | no | `false` | When set to `true`, runs `${member}` through _.kebabCase. |
| `snakeCase` | `boolean` | no | `false` | When set to `true`, runs `${member}` through _.snakeCase. |
| `skipDefaultConversion` | `boolean` | no | `false` | When set to `true`, will preserve `import { X }` syntax instead of converting to `import X`. |