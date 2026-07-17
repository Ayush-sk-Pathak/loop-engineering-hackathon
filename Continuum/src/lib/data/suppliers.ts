import { WORKSPACE_LIST } from "./workspaces";

export const SUPPLIERS = WORKSPACE_LIST.flatMap((workspace) => workspace.suppliers);
