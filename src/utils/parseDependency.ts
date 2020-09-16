export function parseDependency(text: string) {
  const matches = text.match(/"(.+)":\s*"(.+)"/)

  return {
    name: matches?.[1],
    version: matches?.[2],
  }
}
