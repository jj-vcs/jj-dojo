export function unimplemented(className: string, methodName: string): never {
  throw new Error(
    `${className} does not implement ${methodName}. Consider implementing a fake for it in tests.`,
  );
}
