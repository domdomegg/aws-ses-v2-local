import { sum } from '../src/index';

test('adds postiive numbers', () => {
  expect(sum(1, 3)).toBe(4);
  expect(sum(10001, 1345)).toBe(11346);
});

test('adds negative numbers', () => {
  expect(sum(-1, -3)).toBe(-4);
  expect(sum(-10001, -1345)).toBe(-11346);
});

test('adds a negative and positive number', () => {
  expect(sum(1, -3)).toBe(-2);
  expect(sum(-10001, 1345)).toBe(-8656);
});
