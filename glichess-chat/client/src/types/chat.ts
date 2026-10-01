export interface Player {
  playerId: string;
  playerName: string;
}

export interface ChatMessage {
  id: string;
  gameId: string;
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected";
