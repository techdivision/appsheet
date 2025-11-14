/**
 * Mock for uuid library
 */

let counter = 0;

export function v4(): string {
  counter++;
  return `mock-uuid-${counter.toString().padStart(10, '0')}`;
}

export function resetCounter(): void {
  counter = 0;
}
