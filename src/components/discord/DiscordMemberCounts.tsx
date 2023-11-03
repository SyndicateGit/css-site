import { getMemberCount } from "@/lib/actions";
import MemberCount from "./DiscordMemberCount";

interface DiscordMemberCountsProps {
  cardInfo: {
    memberCountText: string;
    onlineCountText: string;
  };
}

async function DiscordMemberCounts({ cardInfo }: DiscordMemberCountsProps) {
  const { memberCount, onlineCount } = await getMemberCount();
  return (
    <>
      <MemberCount
        ping
        count={memberCount}
        text={cardInfo.memberCountText}
        className="text-sm text-foreground"
      />
      <MemberCount
        ping
        count={onlineCount}
        text={cardInfo.onlineCountText}
        className="text-sm text-foreground"
      />
    </>
  );
}

export default DiscordMemberCounts;
