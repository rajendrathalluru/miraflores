/** Serializable workflow contracts. No source packet or server dependencies. */
export interface Entry { id: string; actorId: string; at: string; sourceRefs?: string[]; [key: string]: unknown }
export interface WorkflowState {
  cycle: number;
  history: Entry[];
  amendments: Entry[];
  verifications: Record<string, Entry>;
  documents: Record<string, Entry>;
  areas: Record<string, Entry>;
  judgments: Entry[];
  dueDiligence: Record<string, Entry>;
  identifierCorrections: Entry[];
  questions: Entry[];
  tasks: Entry[];
  notifications: Entry[];
  scenarios: Entry[];
  lineAdjustments: Entry[];
  reconciliations: Entry[];
  originals: Record<string, Entry>;
  replayAt: string | null;
  replayEventId?: string;
  batches: Entry[];
  extensions: Entry[];
  signatures: Entry[];
  filingEvents: Entry[];
  notices: Entry[];
  carryforwards: Entry[];
  plans: Entry[];
  outsideFilings: Entry[];
  links: Entry[];
  attachments: Entry[];
  time: Entry[];
  lastSeen: Record<string, number>;
  standards: { requireAllDocuments: boolean; requireAllAreas: boolean; requireSignature: boolean;
    requireDueDiligence: boolean; requireOutsideFilings: boolean;
    budgetHours: number; retentionYears: number; variancePercent: number; varianceAmount: number };
}
