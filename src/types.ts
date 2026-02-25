export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  title: string;
  model: string;
  created_at: string;
}

export interface GeneratedImage {
  id: string;
  prompt: string;
  url: string;
  model: string;
  created_at: string;
}
