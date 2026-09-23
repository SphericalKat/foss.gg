export interface Notice {
  text: string;
  code?: string;
  action?: { href: string; text: string };
}

export interface LinkDraft {
  kind: string;
  key: string;
  destination: string;
}

export interface ErrorContext {
  operation: "create" | "edit";
  linkId?: number;
  field?: "address" | "destination";
}
