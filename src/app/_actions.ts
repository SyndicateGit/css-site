"use server";

import { prisma } from "@/lib/db";
import { authOptions } from "./api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { DiscordAccount } from "@prisma/client";

const DISCORD_API_ENDPOINT = "https://discordapp.com/api";

const discordEmbed = {
  title: "UWindsor Computer Science Society",
  url: "https://css.uwindsor.ca",
  thumbnail: { url: "https://css.uwindsor.ca/images/css-logo-shield.png" },
  color: "3447003",
};

export async function linkDiscordAccount(discordResponse: any) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id)
      throw new Error("Error while linking account. Session not found.");

    const accessToken = discordResponse.access_token;

    const discordUser = await fetch(`${DISCORD_API_ENDPOINT}/users/@me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }).then((res) => res.json());

    //translate discordResponse.expires_in to a date
    const expiresAt = new Date();
    expiresAt.setSeconds(
      expiresAt.getSeconds() + discordResponse.expires_in - 60
    );

    const data = {
      discordId: discordUser.id,
      userId: session?.user.id!,
      username: discordUser.username,
      discriminator: discordUser.discriminator,
      avatar: discordUser.avatar,
      accessToken: accessToken,
      expiresAt: expiresAt,
    };

    await prisma.discordAccount.upsert({
      where: {
        userId: session?.user.id!,
      },
      update: data,
      create: data,
    });

    //check if the user is already in the server
    const member = await getMemberFromServer(discordUser.id);

    if (!member.user) {
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
    }

    // Send a confirmation DM to the user
    await sendDiscordDM(
      discordUser.id,
      `🔗✅ You've successfully linked your account.\n\n Welcome to the **University of Windsor CS Discord**! You've come to a great place.\n\n
            We've set your nickname to **${session?.user.name}**. Please contact a CSS member if you'd like to shorten your name (e.g. Johnathon Middlename Doe -> John Doe).`
    );
  } catch (error) {
    console.error("An error occurred:", error);
    throw error;
  }
}

export async function unlinkDiscordAccount() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id)
      throw new Error("Error while unlinking account. Session not found.");

    const discordAccount = await prisma.discordAccount.findUnique({
      where: {
        userId: session?.user?.id!,
      },
    });

    if (discordAccount && discordAccount !== null) {
      // Check if the user is in the server
      const member = await getMemberFromServer(discordAccount.discordId);

      await sendDiscordDM(
        discordAccount.discordId,
        `🔗💥 You've successfully unlinked your account.\n\n 
        You've been removed from the server. If you'd like to rejoin, please [relink](https://css.uwindsor.ca/discord) your account.`
      );

      if (member.user) {
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
      }

      // Delete the discord account from the database
      await prisma.discordAccount.delete({
        where: {
          id: discordAccount.id,
        },
      });

      return true;
    }
    throw new Error("No discord account found. Please try again.");
  } catch (error) {
    console.error("An error occurred:", error);
    throw error;
  }
}

async function getMemberFromServer(userId: string) {
  return await fetch(
    `https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/members/${userId}`,
    {
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      },
    }
  ).then((res) => res.json());
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

export async function getUpdatedDiscordAccount(discordAccount: DiscordAccount) {
  let { username, avatar } = discordAccount;
  let avatarUrl = "/images/discord-avatar.png";

  if (discordAccount.updatedAt.getTime() < Date.now() - 300000) {
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
      username = data.username;
      avatarUrl = await getDiscordAccountAvatar(data.id, data.avatar);
    }
  } else if (avatar) {
    avatarUrl = await getDiscordAccountAvatar(discordAccount.discordId, avatar);
  }

  return { username, avatarUrl };
}

async function getDiscordAccountAvatar(discordId: string, avatarId: string) {
  return await fetch(
    `https://cdn.discordapp.com/avatars/${discordId}/${avatarId}.png`,
    {
      next: { revalidate: 300 },
    }
  ).then((res) => res.url);
}
