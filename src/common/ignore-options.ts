// Polyfill.
import "array.prototype.flatmap/auto.js";

import { TSESTree } from "@typescript-eslint/typescript-estree";
import escapeRegExp from "escape-string-regexp";
import { JSONSchema4 } from "json-schema";

import { BaseOptions, RuleContext } from "../util/rule";
import { inClass, inFunction, inInterface } from "../util/tree";
import {
  isAssignmentExpression,
  isCallExpression,
  isExpressionStatement,
  isIdentifier,
  isTSPropertySignature,
  isTypeAliasDeclaration,
  isVariableDeclaration,
  isVariableDeclarator,
  isMemberExpression
} from "../util/typeguard";

export type AllIgnoreOptions = IgnoreLocalOption &
  IgnorePatternOptions &
  IgnoreClassOption &
  IgnoreInterfaceOption &
  IgnoreNewArrayOption;

export type IgnoreLocalOption = {
  readonly ignoreLocal?: boolean;
};

export const ignoreLocalOptionSchema: JSONSchema4 = {
  type: "object",
  properties: {
    ignoreLocal: {
      type: "boolean"
    }
  },
  additionalProperties: false
};

export interface IgnorePatternOptions {
  readonly ignorePattern?: string | ReadonlyArray<string>;
  readonly ignorePrefix?: string | ReadonlyArray<string>;
  readonly ignoreSuffix?: string | ReadonlyArray<string>;
}

export const ignorePatternOptionsSchema: JSONSchema4 = {
  type: "object",
  properties: {
    ignorePattern: {
      type: ["string", "array"],
      items: {
        type: "string"
      }
    },
    ignorePrefix: {
      type: ["string", "array"],
      items: {
        type: "string"
      }
    },
    ignoreSuffix: {
      type: ["string", "array"],
      items: {
        type: "string"
      }
    }
  },
  additionalProperties: false
};

export interface IgnoreReturnTypeOption {
  readonly ignoreReturnType?: boolean;
}
export const ignoreReturnTypeOptionSchema: JSONSchema4 = {
  type: "object",
  properties: {
    ignoreReturnType: {
      type: "boolean"
    }
  },
  additionalProperties: false
};

export interface IgnoreClassOption {
  readonly ignoreClass?: boolean;
}
export const ignoreClassOptionSchema: JSONSchema4 = {
  type: "object",
  properties: {
    ignoreClass: {
      type: "boolean"
    }
  },
  additionalProperties: false
};

export interface IgnoreInterfaceOption {
  readonly ignoreInterface?: boolean;
}
export const ignoreInterfaceOptionSchema: JSONSchema4 = {
  type: "object",
  properties: {
    ignoreInterface: {
      type: "boolean"
    }
  },
  additionalProperties: false
};

export interface IgnoreNewArrayOption {
  readonly ignoreNewArray?: boolean;
}
export const ignoreNewArrayOptionSchema: JSONSchema4 = {
  type: "object",
  properties: {
    ignoreNewArray: {
      type: "boolean"
    }
  },
  additionalProperties: false
};

/**
 * Should the given node be ignored?
 */
export function shouldIgnore(
  node: TSESTree.Node,
  context: RuleContext<string, BaseOptions>,
  ignoreOptions: AllIgnoreOptions
): boolean {
  // Ignore if in a function and ignore-local is set.
  if (ignoreOptions.ignoreLocal && inFunction(node)) {
    return true;
  }

  // Ignore if in a class and ignore-class is set.
  if (ignoreOptions.ignoreClass && inClass(node)) {
    return true;
  }

  // Ignore if in an interface and ignore-interface is set.
  if (ignoreOptions.ignoreInterface && inInterface(node)) {
    return true;
  }

  const identifiers: ReadonlyArray<string> = getIdentifierNames(node, context);

  if (
    identifiers.length > 0 &&
    identifiers.every(identifier => {
      // Ignore if ignore-pattern is set and the pattern matches.
      if (
        ignoreOptions.ignorePattern &&
        isIgnoredPattern(identifier, ignoreOptions.ignorePattern)
      ) {
        return true;
      }

      // Ignore if ignore-prefix is set and the prefix matches.
      if (
        ignoreOptions.ignorePrefix &&
        isIgnoredPrefix(identifier, ignoreOptions.ignorePrefix)
      ) {
        return true;
      }

      // Ignore if ignore-suffix is set and the suffix matches.
      if (
        ignoreOptions.ignoreSuffix &&
        isIgnoredSuffix(identifier, ignoreOptions.ignoreSuffix)
      ) {
        return true;
      }

      return false;
    })
  ) {
    return true;
  }

  return false;
}

function getIdentifierNames(
  node: TSESTree.VariableDeclaration,
  context: RuleContext<string, BaseOptions>
): ReadonlyArray<string>;
function getIdentifierNames(
  node: Exclude<TSESTree.Node, TSESTree.VariableDeclaration>,
  context: RuleContext<string, BaseOptions>
): readonly [string];
function getIdentifierNames(
  node: TSESTree.Node,
  context: RuleContext<string, BaseOptions>
): ReadonlyArray<string>;
function getIdentifierNames(
  node: TSESTree.Node,
  context: RuleContext<string, BaseOptions>
): ReadonlyArray<string> {
  return (isIdentifier(node)
    ? [node.name]
    : isVariableDeclaration(node)
    ? node.declarations.flatMap(declarator =>
        getIdentifierNames(declarator, context)
      )
    : isVariableDeclarator(node) || isTypeAliasDeclaration(node)
    ? getIdentifierNames(node.id, context)
    : isExpressionStatement(node) && isCallExpression(node.expression)
    ? getIdentifierNames(node.expression, context)
    : isAssignmentExpression(node)
    ? getIdentifierNames(node.left, context)
    : isMemberExpression(node)
    ? [
        `${getIdentifierNames(node.object, context)[0]}.${
          getIdentifierNames(node.property, context)[0]
        }`
      ]
    : isCallExpression(node)
    ? [context.getSourceCode().getText(node.callee)]
    : isTSPropertySignature(node)
    ? getIdentifierNames(node.key, context)
    : []
  ).filter((name): name is string => name !== undefined);
}

function isIgnoredPrefix(
  text: string,
  ignorePrefix: ReadonlyArray<string> | string
): boolean {
  if (Array.isArray(ignorePrefix)) {
    if (ignorePrefix.find(pfx => text.indexOf(pfx) === 0)) {
      return true;
    }
  } else {
    if (text.indexOf(ignorePrefix as string) === 0) {
      return true;
    }
  }
  return false;
}

function isIgnoredSuffix(
  text: string,
  ignoreSuffix: ReadonlyArray<string> | string
): boolean {
  if (Array.isArray(ignoreSuffix)) {
    if (
      ignoreSuffix.find(sfx => {
        const indexToFindAt = text.length - sfx.length;
        return indexToFindAt >= 0 && text.indexOf(sfx) === indexToFindAt;
      })
    ) {
      return true;
    }
  } else {
    const indexToFindAt = text.length - ignoreSuffix.length;
    if (
      indexToFindAt >= 0 &&
      text.indexOf(ignoreSuffix as string) === indexToFindAt
    ) {
      return true;
    }
  }
  return false;
}

function isIgnoredPattern(
  text: string,
  ignorePattern: ReadonlyArray<string> | string
): boolean {
  const patterns: ReadonlyArray<string> = Array.isArray(ignorePattern)
    ? ignorePattern
    : [ignorePattern];

  // One or more patterns match?
  return patterns.some(pattern =>
    findMatch(pattern.split("."), text.split("."))
  );
}

function findMatch(
  [pattern, ...remainingPatternParts]: ReadonlyArray<string>,
  textParts: ReadonlyArray<string>,
  allowExtra: boolean = false
): boolean {
  return pattern === undefined
    ? allowExtra || textParts.length === 0
    : // Match any depth (including 0)?
    pattern === "**"
    ? textParts.length === 0
      ? findMatch(remainingPatternParts, [], allowExtra)
      : Array.from({ length: textParts.length })
          .map((_element, index) => index)
          .some(offset =>
            findMatch(remainingPatternParts, textParts.slice(offset), true)
          )
    : // Match anything?
    pattern === "*"
    ? textParts.length > 0 &&
      findMatch(remainingPatternParts, textParts.slice(1), allowExtra)
    : // Text matches pattern?
      new RegExp("^" + escapeRegExp(pattern).replace(/\\\*/g, ".*") + "$").test(
        textParts[0]
      ) && findMatch(remainingPatternParts, textParts.slice(1), allowExtra);
}
