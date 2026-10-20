// A component that writes to stdout and stderr; built by tests/global-setup.ts.
export function greet(name) {
  console.log(`Hello, ${name}!`);
  console.log('second line');
  return `greeted ${name}`;
}

export function warn(message) {
  console.error(`warning: ${message}`);
}
