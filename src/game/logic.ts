export type Player = 0 | 1 | 2;
export type OuterStatus = 'neutral' | 'blue' | 'red' | 'draw';

export const BLUE: Player = 1;
export const RED: Player = 2;
export const EMPTY: Player = 0;

export const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

export interface GameState {
  innerBoards: Player[][];
  outerStatus: OuterStatus[];
  currentPlayer: 1 | 2;
  gameOver: boolean;
  winner: Player;
}

export function createInitialState(): GameState {
  return {
    innerBoards: Array.from({ length: 9 }, () => Array<Player>(9).fill(EMPTY)),
    outerStatus: Array<OuterStatus>(9).fill('neutral'),
    currentPlayer: 1,
    gameOver: false,
    winner: EMPTY,
  };
}

export function checkWinner(cells: Player[]): Player {
  for (const [a, b, c] of WIN_LINES) {
    if (cells[a] !== EMPTY && cells[a] === cells[b] && cells[b] === cells[c]) {
      return cells[a];
    }
  }
  return EMPTY;
}

export function isInnerBoardFull(cells: Player[]): boolean {
  return cells.every((cell) => cell !== EMPTY);
}

export function canPlayOuterBoard(state: GameState, outerIndex: number): boolean {
  if (state.gameOver) return false;
  if (state.outerStatus[outerIndex] !== 'neutral') return false;
  return !isInnerBoardFull(state.innerBoards[outerIndex]!);
}

export function canPlayCell(state: GameState, outerIndex: number, innerIndex: number): boolean {
  if (!canPlayOuterBoard(state, outerIndex)) return false;
  return state.innerBoards[outerIndex]![innerIndex] === EMPTY;
}

export function applyMove(state: GameState, outerIndex: number, innerIndex: number): GameState {
  if (!canPlayCell(state, outerIndex, innerIndex)) return state;

  const innerBoards = state.innerBoards.map((board, i) =>
    i === outerIndex ? board.map((cell, j) => (j === innerIndex ? state.currentPlayer : cell)) : [...board],
  );

  const outerStatus = [...state.outerStatus];
  const updatedInner = innerBoards[outerIndex]!;
  const innerWinner = checkWinner(updatedInner);

  if (innerWinner === BLUE) {
    outerStatus[outerIndex] = 'blue';
  } else if (innerWinner === RED) {
    outerStatus[outerIndex] = 'red';
  } else if (isInnerBoardFull(updatedInner)) {
    outerStatus[outerIndex] = 'draw';
  }

  const outerOwners: Player[] = outerStatus.map((status) => {
    if (status === 'blue') return BLUE;
    if (status === 'red') return RED;
    return EMPTY;
  });

  const outerWinner = checkWinner(outerOwners);
  const allResolved = outerStatus.every((status) => status !== 'neutral');
  const gameOver = outerWinner !== EMPTY || allResolved;

  return {
    innerBoards,
    outerStatus,
    currentPlayer: state.currentPlayer === 1 ? 2 : 1,
    gameOver,
    winner: outerWinner,
  };
}

export function getStatusMessage(state: GameState): string {
  if (!state.gameOver) {
    return state.currentPlayer === BLUE ? "Blue's turn" : "Red's turn";
  }
  if (state.winner === BLUE) return 'Blue wins!';
  if (state.winner === RED) return 'Red wins!';
  return "It's a tie!";
}
