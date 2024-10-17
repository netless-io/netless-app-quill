export function test() {
  const foo = "foo".replaceAll("", "");
  return new Promise((resolve) => {
    resolve(foo);
  });
}