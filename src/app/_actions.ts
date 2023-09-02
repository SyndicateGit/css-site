"use server";

import { prisma } from "@/lib/db";
import { authOptions } from "./api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { DiscordAccount } from "@prisma/client";

const DISCORD_API_ENDPOINT = "https://discordapp.com/api";

// TODO: Update thumbnail link
const discordEmbed = {
  title: "UWindsor Computer Science Society",
  url: "https://css.uwindsor.ca",
  thumbnail: { url: "https://css.uwindsor.ca/css-logo-square.png" },
  color: "3447003",
};

export async function linkDiscordAccount(discordResponse: any) {
  try {
    const accessToken = discordResponse.access_token;

    //translate discordResponse.expires_in to a date
    const expiresAt = new Date();
    expiresAt.setSeconds(
      expiresAt.getSeconds() + discordResponse.expires_in - 60
    );

    const discordUser = await fetch(`${DISCORD_API_ENDPOINT}/users/@me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }).then((res) => res.json());

    const session = await getServerSession(authOptions);
    const discordAccount = await prisma.discordAccount.findUnique({
      where: {
        userId: session?.user.id!,
      },
    });

    const data = {
      discordId: discordUser.id,
      userId: session?.user.id!,
      username: discordUser.username,
      discriminator: discordUser.discriminator,
      avatar: discordUser.avatar,
      accessToken: accessToken,
      expiresAt: expiresAt,
    };

    if (discordAccount) {
      await prisma.discordAccount.update({
        where: {
          id: discordAccount.id,
        },
        data,
      });
    } else {
      await prisma.discordAccount.create({
        data,
      });
    }

    // Add the user to the server
    await fetch(
      `https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordUser.id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          access_token: accessToken,
          nick: session?.user.name,
        }),
      }
    );

    // Send a confirmation DM to the user
    await sendDiscordDM(
      discordUser.id,
      `🔗✅ You've successfully linked your account.\n\n Welcome to the **University of Windsor CS Discord**! You've come to a great place.\n\n
      We've set your nickname to **${session?.user.name}**. Please contact a CSS member if you'd like to shorten your name (e.g. Johnathon Middlename Doe -> John Doe).`
    );
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

export async function unlinkDiscordAccount() {
  const session = await getServerSession(authOptions);
  try {
    const discordAccount = await prisma.discordAccount.findUnique({
      where: {
        userId: session?.user?.id!,
      },
    });

    if (discordAccount) {
      await sendDiscordDM(
        discordAccount.discordId,
        `🔗💥 You've successfully unlinked your account.\n\n 
        You've been removed from the server. If you'd like to rejoin, please [relink](https://css.uwindsor.ca/discord) your account.`
      );

      // Remove the user from the server
      await fetch(
        `https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordAccount.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          },
        }
      ).catch((error) => {
        console.error("An error occurred:", error);
      });

      await prisma.discordAccount.delete({
        where: {
          id: discordAccount.id,
        },
      });
    } else {
      throw new Error("Discord account not found");
    }

    return true;
  } catch (error) {
    console.error("An error occurred:", error);
    return false;
  }
}

export async function sendDiscordDM(userID: string, message: string) {
  try {
    const channel = await fetch(`${DISCORD_API_ENDPOINT}/users/@me/channels`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient_id: userID,
      }),
    });
    const channelJSON = await channel.json();

    await fetch(`${DISCORD_API_ENDPOINT}/channels/${channelJSON.id}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        embed: {
          ...discordEmbed,
          description: message,
        },
      }),
    });
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

export async function getMemberCount(): Promise<{
  memberCount: number;
  onlineCount: number;
}> {
  try {
    const response = await fetch(
      `${DISCORD_API_ENDPOINT}/guilds/${process.env.DISCORD_GUILD_ID}/preview`,
      {
        next: { revalidate: 3600 },
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        },
      }
    );
    const data = await response.json();
    return {
      memberCount: data.approximate_member_count,
      onlineCount: data.approximate_presence_count,
    };
  } catch (error) {
    console.error("An error occurred:", error);
    throw error;
  }
}

export async function updateDiscordAccount(discordAccount: DiscordAccount) {
  if (discordAccount.updatedAt.getTime() > Date.now() - 300000) return;

  const res = await fetch(
    `${DISCORD_API_ENDPOINT}/users/${discordAccount.discordId}`,
    {
      next: { revalidate: 300 },
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      },
    }
  );

  if (res.ok) {
    const data = await res.json();
    await prisma.discordAccount.update({
      where: { id: discordAccount.id },
      data: {
        username: data.username,
        discriminator: data.discriminator,
        avatar: data.avatar,
      },
    });
  }
}

export async function getDiscordAccountAvatar(discordAccount: DiscordAccount) {
  if (discordAccount && discordAccount !== null)
    return await fetch(
      `https://cdn.discordapp.com/avatars/${discordAccount.discordId}/${discordAccount.avatar}.png`,
      {
        next: { revalidate: 300 },
      }
    ).then((res) => res.url);
}
