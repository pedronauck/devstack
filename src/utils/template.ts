export type TemplateVariables = Record<string, string>;

const TEMPLATE_TOKEN = /\{\{(\w+)\}\}/g;

function toTitleCase(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toCamelCase(value: string) {
  return value.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

export function buildTemplateTokens(projectName: string): TemplateVariables {
  const projectTitle = toTitleCase(projectName);

  return {
    projectName,
    projectTitle,
    projectNameCamel: toCamelCase(projectName),
    projectTitleInitial: projectTitle.slice(0, 1).toUpperCase(),
    dbPort: "5432",
  };
}

export function replaceTemplateTokens(content: string, variables: TemplateVariables) {
  return content.replace(TEMPLATE_TOKEN, (token, key: string) => variables[key] ?? token);
}
