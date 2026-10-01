export type PlayerColor = 'white' | 'black';
export type Promotion = 'q' | 'r' | 'b' | 'n';
export type GameStatus = 'waiting' | 'playing' | 'finished';
export type MoveIntent = { gameId: string; from: string; to: string; promotion?: Promotion };
export type GameResult = { reason: 'checkmate' | 'stalemate' | 'draw' | 'resignation'; winner: PlayerColor | null };
export type GameState = {
  gameId: string;
  fen: string;
  turn: 'w' | 'b';
  status: GameStatus;
  whitePlayerId: string;
  blackPlayerId: string | null;
  moves: string[];
  inCheck: boolean;
  result: GameResult | null;
};
export type JoinResponse =
  | { ok: true; playerId: string; color: PlayerColor; state: GameState }
  | { ok: false; message: string };
export interface ClientToServerEvents {
  create_game: (payload: { playerId?: string }, reply: (result: JoinResponse) => void) => void;
  join_game: (payload: { gameId: string; playerId?: string }, reply: (result: JoinResponse) => void) => void;
  make_move: (payload: MoveIntent) => void;
  resign_game: (payload: { gameId: string }) => void;
}
export interface ServerToClientEvents {
  game_state: (state: GameState) => void;
  move_rejected: (message: string) => void;
  game_error: (message: string) => void;
}
