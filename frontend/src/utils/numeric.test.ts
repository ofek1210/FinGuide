const { add, subtract, multiply, divide } = require('./numeric');

test('add function', () => {
	expect(add(1, 2)).toBe(3);
});

test('subtract function', () => {
	expect(subtract(5, 3)).toBe(2);
});

test('multiply function', () => {
	expect(multiply(2, 3)).toBe(6);
});

test('divide function', () => {
	expect(divide(6, 2)).toBe(3);
	expect(divide(5, 0)).toBe(Infinity);
});