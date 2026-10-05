import type { DB } from "@repo/db";
import { createGetInvitation } from "./methods/get-invitation";

class InvitationService {
  private getInvitationMethod: ReturnType<typeof createGetInvitation>;

  constructor(db: DB) {
    this.getInvitationMethod = createGetInvitation(db);
  }

  async getInvitation(id: string) {
    return this.getInvitationMethod(id);
  }
}

export { InvitationService };
