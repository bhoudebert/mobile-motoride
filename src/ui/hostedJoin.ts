import { parseInviteLink } from "../core/liveShare.ts";
import { joinServer } from "../services/enrol.ts";
import { reinvite, type SidecarFailure } from "../services/sidecar.ts";
import { markHosted, type HostedMark } from "./hostedAccount.ts";
import { saveServer } from "./serverSetting.ts";

/**
 * Join the server of an account that exists, with an invitation the sidecar mints: the phone gets a token of its own and
 * keeps the server (spec hosted-server). Null when it worked, else why not.
 */
export async function joinHosted(
  base: string,
  accountToken: string,
  mark: HostedMark,
): Promise<SidecarFailure["reason"] | null> {
  const invited = await reinvite(base, accountToken);
  if (!invited.ok) return invited.reason;
  const invitation = invited.value.invitationLink ? parseInviteLink(invited.value.invitationLink) : null;
  if (!invitation) return "failed";
  const joined = await joinServer(invitation, "");
  if (!joined.ok) return joined.reason === "unreachable" ? "unreachable" : "failed";
  await markHosted(mark);
  await saveServer({ url: invitation.url, token: joined.token });
  return null;
}
