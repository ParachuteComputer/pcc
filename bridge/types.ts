export interface Peer {
  id: string;
  name: string;
  pid: number;
  cwd: string;
  status: string;
  registered_at: string;
  last_seen: string;
}

export interface Message {
  id: number;
  from_id: string;
  from_name: string;
  to_id: string;
  content: string;
  sent_at: string;
}
