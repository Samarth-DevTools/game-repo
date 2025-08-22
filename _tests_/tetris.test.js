// __tests__/tetris.test.js
const { rotatePiece } = require('../src/tetris'); // adjust path as needed

test("rotatePiece rotates piece correctly", () => {
  const piece = [
    [1, 0],
    [1, 1],
  ];
  const rotated = rotatePiece(piece);
  expect(rotated).toEqual([
    [1, 1],
    [1, 0],
  ]);
});
