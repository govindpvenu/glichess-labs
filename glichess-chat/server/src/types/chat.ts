export interface Player {
  playerId: string;
  playerName: string;
}

export interface JoinPayload extends Player {
  gameId: string;
}

export interface LeavePayload {
  gameId: string;
  playerId: string;
}

export interface SendPayload extends JoinPayload {
  text: string;
}

export interface ChatMessage extends SendPayload {
  id: string;
  timestamp: number;
}

export interface ChatError {
  message: string;
}
