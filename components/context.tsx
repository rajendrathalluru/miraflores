'use client';
import { createContext, useContext } from 'react';
import type { Row } from '@/lib/types';
export type WorkspaceContextType = {
  data: Row;
  packet: Row;
  state: Row;
  version: Row;
  working: boolean;
  readOnly: boolean;
  busy: boolean;
  replay: string;
  select: (ref: string, finding?: Row) => void;
  command: (c: Row) => Promise<boolean>;
  open: (modal: string) => void;
  setView: (view: string) => void;
};
export const WorkContext = createContext<WorkspaceContextType>(null!);
export const useWork = () => useContext(WorkContext);
