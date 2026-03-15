#!/usr/bin/env node

/**
 * React Hooks Separation Codemod
 *
 * Finds files with custom hooks that violate separation/location rules, then:
 * - Extracts each eligible hook to ../hooks/<hook-file>.ts
 * - Removes extracted hook declarations from the source file
 * - Adds imports (and re-exports when needed) back to the source file
 * - Organizes imports (remove unused) with TypeScript language service
 * - Runs oxfmt on touched files (write mode)
 *
 * Usage:
 *   node lint-plugins/react-hooks-separation-codemod.mjs
 *   node lint-plugins/react-hooks-separation-codemod.mjs --write
 *   node lint-plugins/react-hooks-separation-codemod.mjs --write --path packages/frontend/src/components
 *   node lint-plugins/react-hooks-separation-codemod.mjs --write --overwrite
 */

import ts from "typescript";

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const DEFAULT_TARGET = "packages/frontend/src";

const WRAPPER_NAMES = new Set(["forwardRef", "memo", "React.forwardRef", "React.memo"]);

const EXCLUDED_DIRS = new Set([".git", ".turbo", "build", "coverage", "dist", "node_modules"]);

function isPascalCase(name) {
  return typeof name === "string" && /^[A-Z][a-zA-Z0-9]*$/.test(name);
}

function isHookName(name) {
  return typeof name === "string" && /^use[A-Z]/.test(name);
}

function hookNameToKebabFile(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase() + ".ts";
}

function isValidHookLocation(filePath) {
  const normalizedPath = filePath.replace(/\\/g, "/");
  return (
    normalizedPath.includes("/hooks/") || /\/use-[a-z][a-z0-9-]*\.[tj]sx?$/.test(normalizedPath)
  );
}

function hasExportModifier(node) {
  return Boolean(node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

function getCalleeName(callExpression) {
  const callee = callExpression.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (
    ts.isPropertyAccessExpression(callee) &&
    ts.isIdentifier(callee.expression) &&
    ts.isIdentifier(callee.name)
  ) {
    return `${callee.expression.text}.${callee.name.text}`;
  }
  return null;
}

function isFunctionLikeInit(initializer) {
  if (!initializer) return false;
  if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) return true;

  if (ts.isCallExpression(initializer)) {
    const calleeName = getCalleeName(initializer);
    if (calleeName && WRAPPER_NAMES.has(calleeName) && initializer.arguments.length > 0) {
      return isFunctionLikeInit(initializer.arguments[0]);
    }
  }

  return false;
}

function toImportPath(fromFilePath, toFilePath) {
  let relativePath = path
    .relative(path.dirname(fromFilePath), toFilePath)
    .replace(/\.[^.]+$/, "")
    .replace(/\\/g, "/");

  if (!relativePath.startsWith(".")) {
    relativePath = `./${relativePath}`;
  }

  return relativePath;
}

function getScriptKind(filePath) {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (filePath.endsWith(".ts")) return ts.ScriptKind.TS;
  if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (filePath.endsWith(".js")) return ts.ScriptKind.JS;
  return ts.ScriptKind.Unknown;
}

function createSourceFile(filePath, sourceText) {
  return ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(filePath)
  );
}

function addBindingNames(nameNode, collector) {
  if (ts.isIdentifier(nameNode)) {
    collector.add(nameNode.text);
    return;
  }

  if (ts.isArrayBindingPattern(nameNode) || ts.isObjectBindingPattern(nameNode)) {
    for (const element of nameNode.elements) {
      if (ts.isOmittedExpression(element)) continue;
      addBindingNames(element.name, collector);
    }
  }
}

function collectDeclaredNames(rootNode) {
  const declaredNames = new Set();

  function visit(node) {
    if (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) {
      addBindingNames(node.name, declaredNames);
    } else if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isClassDeclaration(node) ||
      ts.isClassExpression(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isEnumDeclaration(node) ||
      ts.isTypeParameterDeclaration(node) ||
      ts.isImportEqualsDeclaration(node)
    ) {
      if (node.name && ts.isIdentifier(node.name)) {
        declaredNames.add(node.name.text);
      }
    } else if (ts.isCatchClause(node) && node.variableDeclaration) {
      addBindingNames(node.variableDeclaration.name, declaredNames);
    }

    ts.forEachChild(node, visit);
  }

  visit(rootNode);
  return declaredNames;
}

function isReferenceIdentifier(identifierNode) {
  const parent = identifierNode.parent;
  if (!parent) return false;

  if (ts.isPropertyAccessExpression(parent) && parent.name === identifierNode) return false;
  if (ts.isQualifiedName(parent) && parent.right === identifierNode) return false;

  if (
    (ts.isPropertyAssignment(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isPropertySignature(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isMethodSignature(parent) ||
      ts.isEnumMember(parent)) &&
    parent.name === identifierNode
  ) {
    return false;
  }

  if (
    (ts.isVariableDeclaration(parent) ||
      ts.isParameter(parent) ||
      ts.isBindingElement(parent) ||
      ts.isImportClause(parent) ||
      ts.isImportSpecifier(parent) ||
      ts.isNamespaceImport(parent) ||
      ts.isNamespaceExport(parent) ||
      ts.isExportSpecifier(parent)) &&
    parent.name === identifierNode
  ) {
    return false;
  }

  if (
    (ts.isFunctionDeclaration(parent) ||
      ts.isFunctionExpression(parent) ||
      ts.isClassDeclaration(parent) ||
      ts.isClassExpression(parent) ||
      ts.isInterfaceDeclaration(parent) ||
      ts.isTypeAliasDeclaration(parent) ||
      ts.isEnumDeclaration(parent) ||
      ts.isTypeParameterDeclaration(parent) ||
      ts.isImportEqualsDeclaration(parent)) &&
    parent.name === identifierNode
  ) {
    return false;
  }

  if (
    (ts.isLabeledStatement(parent) || ts.isBreakOrContinueStatement(parent)) &&
    parent.label === identifierNode
  ) {
    return false;
  }

  return true;
}

function collectReferencedIdentifiers(rootNode, excludedRanges = []) {
  const references = new Set();

  function isExcluded(node) {
    return excludedRanges.some(
      range => node.getStart() >= range.start && node.getEnd() <= range.end
    );
  }

  function visit(node) {
    if (isExcluded(node)) return;

    if (ts.isIdentifier(node) && isReferenceIdentifier(node)) {
      references.add(node.text);
    }

    ts.forEachChild(node, visit);
  }

  visit(rootNode);
  return references;
}

function collectTopLevelMetadata(sourceFile) {
  const hooks = [];
  const components = [];
  const importStatements = [];
  const importedNames = new Set();
  const moduleDeclarationMap = new Map();
  const moduleDeclaredNames = new Set();

  function registerDeclaration(name, statement, declarationKind) {
    moduleDeclaredNames.add(name);
    if (!moduleDeclarationMap.has(name)) {
      moduleDeclarationMap.set(name, { statement, declarationKind });
    }
  }

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      importStatements.push(statement.getText(sourceFile));

      const importClause = statement.importClause;
      if (importClause?.name) {
        importedNames.add(importClause.name.text);
      }

      if (importClause?.namedBindings) {
        if (ts.isNamespaceImport(importClause.namedBindings)) {
          importedNames.add(importClause.namedBindings.name.text);
        } else if (ts.isNamedImports(importClause.namedBindings)) {
          for (const specifier of importClause.namedBindings.elements) {
            importedNames.add(specifier.name.text);
          }
        }
      }
    }

    if (ts.isFunctionDeclaration(statement) && statement.name) {
      const functionName = statement.name.text;
      registerDeclaration(functionName, statement, "value");

      if (isHookName(functionName)) {
        hooks.push({
          kind: "function",
          name: functionName,
          statement,
          isExported: hasExportModifier(statement),
          canExtract: true,
        });
      } else if (isPascalCase(functionName)) {
        components.push({ name: functionName, node: statement });
      }
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      const declarations = statement.declarationList.declarations;
      for (const declaration of declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;

        const declarationName = declaration.name.text;
        registerDeclaration(declarationName, statement, "value");

        if (isHookName(declarationName)) {
          hooks.push({
            kind: "variable",
            name: declarationName,
            statement,
            declaration,
            isExported: hasExportModifier(statement),
            canExtract: declarations.length === 1,
          });
        } else if (isPascalCase(declarationName) && isFunctionLikeInit(declaration.initializer)) {
          components.push({ name: declarationName, node: declaration });
        }
      }
      continue;
    }

    if (ts.isClassDeclaration(statement) && statement.name) {
      registerDeclaration(statement.name.text, statement, "value");
      continue;
    }

    if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
      registerDeclaration(statement.name.text, statement, "type");
      continue;
    }

    if (ts.isEnumDeclaration(statement)) {
      registerDeclaration(statement.name.text, statement, "value");
    }
  }

  return {
    hooks,
    components,
    importStatements,
    importedNames,
    moduleDeclaredNames,
    moduleDeclarationMap,
  };
}

function applyTextChanges(sourceText, textChanges) {
  if (textChanges.length === 0) return sourceText;

  const orderedChanges = [...textChanges].sort((a, b) => b.span.start - a.span.start);
  let nextText = sourceText;
  for (const change of orderedChanges) {
    const start = change.span.start;
    const end = change.span.start + change.span.length;
    nextText = `${nextText.slice(0, start)}${change.newText}${nextText.slice(end)}`;
  }

  return nextText;
}

function organizeImports(filePath, sourceText) {
  const absoluteFilePath = path.resolve(filePath);
  const fileMap = new Map([[absoluteFilePath, sourceText]]);

  const languageServiceHost = {
    getCompilationSettings: () => ({
      allowJs: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ESNext,
    }),
    getScriptFileNames: () => [absoluteFilePath],
    getScriptVersion: () => "1",
    getScriptSnapshot: name => {
      if (fileMap.has(name)) {
        return ts.ScriptSnapshot.fromString(fileMap.get(name));
      }
      if (!fs.existsSync(name)) return undefined;
      return ts.ScriptSnapshot.fromString(fs.readFileSync(name, "utf8"));
    },
    getCurrentDirectory: () => process.cwd(),
    getDefaultLibFileName: options => ts.getDefaultLibFilePath(options),
    fileExists: fs.existsSync,
    readFile: name => {
      if (fileMap.has(name)) return fileMap.get(name);
      if (!fs.existsSync(name)) return undefined;
      return fs.readFileSync(name, "utf8");
    },
    readDirectory: (...args) => ts.sys.readDirectory(...args),
    directoryExists: directoryPath => {
      try {
        return fs.statSync(directoryPath).isDirectory();
      } catch {
        return false;
      }
    },
    getDirectories: directoryPath => ts.sys.getDirectories(directoryPath),
  };

  const languageService = ts.createLanguageService(languageServiceHost);
  const organizeChanges = languageService.organizeImports(
    { type: "file", fileName: absoluteFilePath },
    {},
    {}
  );
  languageService.dispose();

  const ownFileChanges = organizeChanges.find(
    change => path.resolve(change.fileName) === absoluteFilePath
  );
  if (!ownFileChanges || ownFileChanges.textChanges.length === 0) return sourceText;

  return applyTextChanges(sourceText, ownFileChanges.textChanges);
}

function ensureTrailingNewline(text) {
  return text.endsWith("\n") ? text : `${text}\n`;
}

function removeRanges(sourceText, ranges) {
  if (ranges.length === 0) return sourceText;

  const orderedRanges = [...ranges].sort((a, b) => b.start - a.start);
  let nextText = sourceText;

  for (const range of orderedRanges) {
    nextText = `${nextText.slice(0, range.start)}${nextText.slice(range.end)}`;
  }

  return nextText;
}

function ensureExportedHookStatement(statementNode, sourceFile) {
  const statementText = statementNode.getText(sourceFile).trim();
  if (hasExportModifier(statementNode)) return statementText;
  return `export ${statementText}`;
}

function buildHookFileContent({
  hookFilePath,
  importStatements,
  hookStatementText,
  hookDependencyImports,
  localValueImports,
}) {
  const contentParts = [];
  if (importStatements.length > 0) {
    contentParts.push(importStatements.join("\n"));
  }
  if (hookDependencyImports.length > 0) {
    contentParts.push(hookDependencyImports.join("\n"));
  }
  if (localValueImports.length > 0) {
    contentParts.push(localValueImports.join("\n"));
  }
  contentParts.push(hookStatementText);

  let hookSource = contentParts.join("\n\n");
  hookSource = organizeImports(hookFilePath, hookSource);
  return ensureTrailingNewline(hookSource);
}

function findImportsInsertionPosition(sourceFile) {
  let insertionPoint = 0;
  for (const statement of sourceFile.statements) {
    if (ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression)) {
      insertionPoint = statement.getEnd();
      continue;
    }
    if (ts.isImportDeclaration(statement)) {
      insertionPoint = statement.getEnd();
      continue;
    }
    break;
  }
  return insertionPoint;
}

function injectHookImportsAndExports(sourceText, componentFilePath, extractedHooks) {
  if (extractedHooks.length === 0) return sourceText;

  const updatedSourceFile = createSourceFile(componentFilePath, sourceText);
  const referencedNames = collectReferencedIdentifiers(updatedSourceFile);

  const declarationsToInsert = [];
  const seenLines = new Set();

  for (const hook of extractedHooks) {
    const hookImportPath = toImportPath(componentFilePath, hook.hookFilePath);
    if (referencedNames.has(hook.name)) {
      const importLine = `import { ${hook.name} } from "${hookImportPath}";`;
      if (!seenLines.has(importLine)) {
        declarationsToInsert.push(importLine);
        seenLines.add(importLine);
      }
    }

    if (hook.isExported) {
      const exportLine = `export { ${hook.name} } from "${hookImportPath}";`;
      if (!seenLines.has(exportLine)) {
        declarationsToInsert.push(exportLine);
        seenLines.add(exportLine);
      }
    }
  }

  if (declarationsToInsert.length === 0) return sourceText;

  const insertionPoint = findImportsInsertionPosition(updatedSourceFile);
  const needsLeadingNewline = insertionPoint > 0 && sourceText[insertionPoint - 1] !== "\n";
  const needsTrailingNewline =
    insertionPoint < sourceText.length && sourceText[insertionPoint] !== "\n";

  const block = `${needsLeadingNewline ? "\n" : ""}${declarationsToInsert.join("\n")}${
    needsTrailingNewline ? "\n" : "\n\n"
  }`;

  return `${sourceText.slice(0, insertionPoint)}${block}${sourceText.slice(insertionPoint)}`;
}

function analyzeLocalDependencies(hookStatement, { importedNames, moduleDeclaredNames }) {
  const references = collectReferencedIdentifiers(hookStatement);
  const declaredInsideHook = collectDeclaredNames(hookStatement);

  const localDependencies = [];
  for (const identifier of references) {
    if (declaredInsideHook.has(identifier)) continue;
    if (importedNames.has(identifier)) continue;
    if (!moduleDeclaredNames.has(identifier)) continue;
    localDependencies.push(identifier);
  }

  return [...new Set(localDependencies)];
}

function resolveTypeDependencies({ initialTypeDependencies, importedNames, moduleDeclarationMap }) {
  const collectedTypeDependencies = new Set();
  const valueDependencies = new Set();
  const queue = [...initialTypeDependencies];

  while (queue.length > 0) {
    const currentTypeDependency = queue.shift();
    if (collectedTypeDependencies.has(currentTypeDependency)) continue;

    const declarationEntry = moduleDeclarationMap.get(currentTypeDependency);
    if (!declarationEntry || declarationEntry.declarationKind !== "type") continue;

    collectedTypeDependencies.add(currentTypeDependency);
    const declarationReferences = collectReferencedIdentifiers(declarationEntry.statement);
    const declarationNames = collectDeclaredNames(declarationEntry.statement);

    for (const referencedName of declarationReferences) {
      if (declarationNames.has(referencedName)) continue;
      if (importedNames.has(referencedName)) continue;

      const referencedDeclaration = moduleDeclarationMap.get(referencedName);
      if (!referencedDeclaration) continue;

      if (referencedDeclaration.declarationKind === "type") {
        if (!collectedTypeDependencies.has(referencedName)) {
          queue.push(referencedName);
        }
        continue;
      }

      valueDependencies.add(referencedName);
    }
  }

  return {
    typeDependencies: [...collectedTypeDependencies],
    valueDependencies: [...valueDependencies],
  };
}

function collectEligibleHooks({
  hooks,
  importedNames,
  moduleDeclaredNames,
  moduleDeclarationMap,
  filePath,
  warnings,
}) {
  const allHookNames = new Set(hooks.map(hook => hook.name));

  const hookAnalysis = hooks.map(hook => {
    if (!hook.canExtract) {
      warnings.push(
        `[skip] ${filePath}: hook "${hook.name}" is declared in a multi-declarator variable statement`
      );
      return {
        hook,
        localDependencies: [],
        hookDependencies: [],
        typeDependencies: [],
        valueDependencies: [],
        blocked: true,
      };
    }

    const localDependencies = analyzeLocalDependencies(hook.statement, {
      importedNames,
      moduleDeclaredNames,
    });

    const hookDependencies = [];
    const initialTypeDependencies = [];
    const valueDependencies = [];

    for (const dependencyName of localDependencies) {
      if (allHookNames.has(dependencyName)) {
        hookDependencies.push(dependencyName);
        continue;
      }

      const declarationEntry = moduleDeclarationMap.get(dependencyName);
      if (declarationEntry?.declarationKind === "type") {
        initialTypeDependencies.push(dependencyName);
        continue;
      }

      valueDependencies.push(dependencyName);
    }

    const { typeDependencies, valueDependencies: typeValueDependencies } = resolveTypeDependencies({
      initialTypeDependencies,
      importedNames,
      moduleDeclarationMap,
    });
    valueDependencies.push(...typeValueDependencies);

    return {
      hook,
      localDependencies,
      hookDependencies,
      typeDependencies,
      valueDependencies: [...new Set(valueDependencies)],
      blocked: false,
    };
  });

  let eligible = hookAnalysis.filter(analysis => !analysis.blocked);
  while (true) {
    const eligibleNames = new Set(eligible.map(analysis => analysis.hook.name));
    const next = eligible.filter(analysis =>
      analysis.hookDependencies.every(dependencyName => eligibleNames.has(dependencyName))
    );
    if (next.length === eligible.length) break;
    eligible = next;
  }

  const eligibleNames = new Set(eligible.map(analysis => analysis.hook.name));
  for (const analysis of hookAnalysis) {
    if (analysis.blocked) {
      continue;
    }

    const blockedDependencies = analysis.hookDependencies.filter(
      dependencyName => !eligibleNames.has(dependencyName)
    );
    if (blockedDependencies.length > 0) {
      warnings.push(
        `[skip] ${filePath}: hook "${analysis.hook.name}" depends on local symbols (${blockedDependencies.join(
          ", "
        )}) that cannot be auto-moved safely`
      );
    }
  }

  return eligible;
}

function ensureExportModifier(statementNode, sourceFile, sourceText) {
  if (hasExportModifier(statementNode)) {
    return sourceText;
  }

  const insertPosition = statementNode.getStart(sourceFile);
  return `${sourceText.slice(0, insertPosition)}export ${sourceText.slice(insertPosition)}`;
}

function ensureExportModifiers(sourceText, sourceFile, statements) {
  if (statements.length === 0) {
    return sourceText;
  }

  const orderedStatements = [...statements].sort(
    (left, right) => right.getStart() - left.getStart()
  );
  let nextSource = sourceText;

  for (const statement of orderedStatements) {
    nextSource = ensureExportModifier(statement, sourceFile, nextSource);
  }

  return nextSource;
}

function transformFile(filePath, options) {
  const originalSource = fs.readFileSync(filePath, "utf8");
  const sourceFile = createSourceFile(filePath, originalSource);
  const metadata = collectTopLevelMetadata(sourceFile);
  const hasHooks = metadata.hooks.length > 0;
  const hasComponents = metadata.components.length > 0;
  const validHookLocation = isValidHookLocation(filePath);

  if (!hasHooks || (!hasComponents && validHookLocation)) {
    return {
      changed: false,
      filePath,
      warnings: [],
      hookOutputs: [],
      componentSource: originalSource,
    };
  }

  const warnings = [];
  const eligibleHooks = collectEligibleHooks({
    hooks: metadata.hooks,
    importedNames: metadata.importedNames,
    moduleDeclaredNames: metadata.moduleDeclaredNames,
    moduleDeclarationMap: metadata.moduleDeclarationMap,
    filePath,
    warnings,
  });
  if (eligibleHooks.length === 0) {
    return {
      changed: false,
      filePath,
      warnings,
      hookOutputs: [],
      componentSource: originalSource,
    };
  }

  const plannedHooks = eligibleHooks
    .map(analysis => {
      const hookFilePath = path.resolve(
        path.dirname(filePath),
        "..",
        "hooks",
        hookNameToKebabFile(analysis.hook.name)
      );
      if (path.resolve(hookFilePath) === path.resolve(filePath)) {
        warnings.push(
          `[skip] ${filePath}: hook "${analysis.hook.name}" resolves to its own source file target (${path.relative(
            process.cwd(),
            hookFilePath
          )})`
        );
        return null;
      }
      const dependencyImports = analysis.hookDependencies.map(dependencyName => {
        const dependencyFilePath = path.resolve(
          path.dirname(filePath),
          "..",
          "hooks",
          hookNameToKebabFile(dependencyName)
        );
        return `import { ${dependencyName} } from "${toImportPath(hookFilePath, dependencyFilePath)}";`;
      });
      const localValueDependencies = [...analysis.valueDependencies].sort((left, right) =>
        left.localeCompare(right)
      );
      const localValueImports =
        localValueDependencies.length === 0
          ? []
          : [
              `import { ${localValueDependencies.join(", ")} } from "${toImportPath(
                hookFilePath,
                filePath
              )}";`,
            ];

      const typeDependencyStatements = analysis.typeDependencies
        .map(dependencyName => metadata.moduleDeclarationMap.get(dependencyName))
        .filter(Boolean)
        .sort((left, right) => left.statement.getStart() - right.statement.getStart())
        .map(dependencyEntry => dependencyEntry.statement.getText(sourceFile));

      const hookSource = buildHookFileContent({
        hookFilePath,
        importStatements: metadata.importStatements,
        hookStatementText: [
          ...typeDependencyStatements,
          ensureExportedHookStatement(analysis.hook.statement, sourceFile),
        ].join("\n\n"),
        hookDependencyImports: dependencyImports,
        localValueImports,
      });

      return {
        ...analysis.hook,
        localValueDependencies,
        hookFilePath,
        hookSource,
      };
    })
    .filter(Boolean);

  if (plannedHooks.length === 0) {
    return {
      changed: false,
      filePath,
      warnings,
      hookOutputs: [],
      componentSource: originalSource,
    };
  }

  const hooksToExtract = [];
  for (const plannedHook of plannedHooks) {
    if (!fs.existsSync(plannedHook.hookFilePath)) {
      hooksToExtract.push(plannedHook);
      continue;
    }

    const existingHookSource = fs.readFileSync(plannedHook.hookFilePath, "utf8");
    if (existingHookSource === plannedHook.hookSource) {
      hooksToExtract.push(plannedHook);
      continue;
    }

    if (options.overwrite) {
      hooksToExtract.push(plannedHook);
      continue;
    }

    warnings.push(
      `[skip] ${filePath}: target hook file already exists with different content (${path.relative(
        process.cwd(),
        plannedHook.hookFilePath
      )}). Re-run with --overwrite to replace it.`
    );
  }

  if (hooksToExtract.length === 0) {
    return {
      changed: false,
      filePath,
      warnings,
      hookOutputs: [],
      componentSource: originalSource,
    };
  }

  const removalRanges = hooksToExtract.map(hook => ({
    start: hook.statement.getFullStart(),
    end: hook.statement.getEnd(),
  }));
  const dependencyNamesToExport = new Set();
  for (const hook of hooksToExtract) {
    for (const dependencyName of hook.localValueDependencies) {
      dependencyNamesToExport.add(dependencyName);
    }
  }

  let componentSource = removeRanges(originalSource, removalRanges);

  if (dependencyNamesToExport.size > 0) {
    const nextSourceFile = createSourceFile(filePath, componentSource);
    const nextMetadata = collectTopLevelMetadata(nextSourceFile);
    const statementsToExport = [];
    const seenStatements = new Set();
    for (const dependencyName of dependencyNamesToExport) {
      const declarationEntry = nextMetadata.moduleDeclarationMap.get(dependencyName);
      if (!declarationEntry || declarationEntry.declarationKind !== "value") {
        continue;
      }
      const statementKey = `${declarationEntry.statement.pos}:${declarationEntry.statement.end}`;
      if (seenStatements.has(statementKey)) {
        continue;
      }
      seenStatements.add(statementKey);
      statementsToExport.push(declarationEntry.statement);
    }
    componentSource = ensureExportModifiers(componentSource, nextSourceFile, statementsToExport);
  }

  componentSource = injectHookImportsAndExports(componentSource, filePath, hooksToExtract);
  componentSource = organizeImports(filePath, componentSource);
  componentSource = ensureTrailingNewline(componentSource);

  const changed = componentSource !== originalSource || hooksToExtract.length > 0;
  return {
    changed,
    filePath,
    warnings,
    hookOutputs: hooksToExtract,
    componentSource,
  };
}

function isTargetSourceFile(filePath) {
  if (filePath.endsWith(".d.ts")) return false;
  if (!filePath.endsWith(".ts") && !filePath.endsWith(".tsx")) return false;
  return true;
}

function walkTargetFiles(targetPath, collector) {
  if (!fs.existsSync(targetPath)) return;

  const stats = fs.statSync(targetPath);
  if (stats.isFile()) {
    if (isTargetSourceFile(targetPath)) {
      collector.push(path.resolve(targetPath));
    }
    return;
  }

  if (!stats.isDirectory()) return;

  const entries = fs.readdirSync(targetPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)) continue;
    walkTargetFiles(path.join(targetPath, entry.name), collector);
  }
}

function parseArguments(argv) {
  const options = {
    write: false,
    overwrite: false,
    runOxfmt: true,
    targets: [],
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--write" || argument === "--apply") {
      options.write = true;
      continue;
    }
    if (argument === "--overwrite") {
      options.overwrite = true;
      continue;
    }
    if (argument === "--no-oxfmt") {
      options.runOxfmt = false;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (argument === "--path") {
      const nextValue = argv[index + 1];
      if (!nextValue || nextValue.startsWith("--")) {
        throw new Error("--path requires a value");
      }
      options.targets.push(nextValue);
      index += 1;
      continue;
    }

    options.targets.push(argument);
  }

  return options;
}

function printHelp() {
  console.log("React Hooks Separation Codemod");
  console.log("");
  console.log("Usage:");
  console.log("  node lint-plugins/react-hooks-separation-codemod.mjs [options] [paths...]");
  console.log("");
  console.log("Options:");
  console.log("  --write, --apply   Write changes to disk");
  console.log("  --overwrite        Overwrite existing hook files when generated content differs");
  console.log("  --no-oxfmt         Skip oxfmt (write mode only)");
  console.log("  --path <path>      Add target path (file or directory)");
  console.log("  -h, --help         Show this help");
  console.log("");
  console.log(`Default target: ${DEFAULT_TARGET}`);
}

function runOxfmt(filePaths) {
  if (filePaths.length === 0) return;

  const sortedFiles = [...new Set(filePaths)].sort((left, right) => left.localeCompare(right));
  const formatResult = spawnSync("bunx", ["oxfmt", ...sortedFiles], {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  if (formatResult.status !== 0) {
    throw new Error("oxfmt failed");
  }
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const targetPaths = options.targets.length > 0 ? options.targets : [DEFAULT_TARGET];
  const files = [];
  for (const targetPath of targetPaths) {
    walkTargetFiles(path.resolve(targetPath), files);
  }

  const uniqueFiles = [...new Set(files)].sort((left, right) => left.localeCompare(right));
  if (uniqueFiles.length === 0) {
    console.log("No target files found.");
    return;
  }

  const touchedFiles = new Set();
  const warnings = [];
  let transformedFiles = 0;
  let createdHookFiles = 0;

  for (const filePath of uniqueFiles) {
    const result = transformFile(filePath, options);
    for (const warning of result.warnings) {
      warnings.push(warning);
    }
    if (!result.changed) continue;

    transformedFiles += 1;
    const relativeComponentPath = path.relative(process.cwd(), result.filePath);

    if (!options.write) {
      const hookTargets = result.hookOutputs.map(hookOutput =>
        path.relative(process.cwd(), hookOutput.hookFilePath)
      );
      console.log(`[plan] ${relativeComponentPath}`);
      for (const hookTarget of hookTargets) {
        console.log(`  -> ${hookTarget}`);
      }
      continue;
    }

    for (const hookOutput of result.hookOutputs) {
      fs.mkdirSync(path.dirname(hookOutput.hookFilePath), { recursive: true });
      const existed = fs.existsSync(hookOutput.hookFilePath);
      fs.writeFileSync(hookOutput.hookFilePath, hookOutput.hookSource, "utf8");
      if (!existed) {
        createdHookFiles += 1;
      }
      touchedFiles.add(path.resolve(hookOutput.hookFilePath));
    }

    fs.writeFileSync(result.filePath, result.componentSource, "utf8");
    touchedFiles.add(path.resolve(result.filePath));
  }

  for (const warning of warnings) {
    console.warn(warning);
  }

  if (options.write && options.runOxfmt && touchedFiles.size > 0) {
    runOxfmt([...touchedFiles]);
  }

  if (options.write) {
    console.log(
      `Done. Transformed ${transformedFiles} file(s), created ${createdHookFiles} new hook file(s).`
    );
  } else {
    console.log(
      `Dry run complete. ${transformedFiles} file(s) would be transformed. Re-run with --write to apply.`
    );
  }
}

try {
  main();
} catch (error) {
  if (error instanceof Error) {
    console.error(`Failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
  } else {
    console.error(`Failed: ${String(error)}`);
  }
  process.exit(1);
}
