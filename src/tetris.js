function rotatePiece(piece) {
  // rotate matrix 90deg clockwise
  return piece[0].map((val, index) =>
    piece.map(row => row[index]).reverse()
  );
}

module.exports = { rotatePiece };
