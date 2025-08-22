const { rotatePiece } = require('../src/tetris');

test('rotatePiece rotates a 2x2 matrix clockwise', () => {
  const piece = [
    [1, 2],
    [3, 4],
  ];
  const rotated = rotatePiece(piece);
  expect(rotated).toEqual([
    [3, 1],
    [4, 2],
  ]);
});
