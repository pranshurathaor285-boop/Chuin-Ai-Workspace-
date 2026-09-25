import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") || "").trim();

    if (!query) {
      return NextResponse.json({ conversations: [] });
    }

    // Search in conversation titles AND message content
    const conversations = await prisma.conversation.findMany({
      where: {
        userId,
        OR: [
          {
            title: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            messages: {
              some: {
                content: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            },
          },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: {
        id: true,
        title: true,
        updatedAt: true,
        _count: {
          select: { messages: true },
        },
      },
    });

    // Add snippet showing where match was found
    const results = await Promise.all(
      conversations.map(async (conv) => {
        // Check if title matched
        const titleMatch = conv.title
          .toLowerCase()
          .includes(query.toLowerCase());

        let snippet = "";
        let matchType: "title" | "message" = "title";

        if (!titleMatch) {
          // Find matching message for snippet
          const matchingMessage = await prisma.message.findFirst({
            where: {
              conversationId: conv.id,
              content: {
                contains: query,
                mode: "insensitive",
              },
            },
            select: { content: true, role: true },
          });

          if (matchingMessage) {
            matchType = "message";
            const content = matchingMessage.content;
            const lowerContent = content.toLowerCase();
            const lowerQuery = query.toLowerCase();
            const idx = lowerContent.indexOf(lowerQuery);

            if (idx !== -1) {
              const start = Math.max(0, idx - 40);
              const end = Math.min(content.length, idx + query.length + 60);
              snippet =
                (start > 0 ? "..." : "") +
                content.slice(start, end).trim() +
                (end < content.length ? "..." : "");
            } else {
              snippet = content.slice(0, 100);
            }
          }
        }

        return {
          id: conv.id,
          title: conv.title,
          updatedAt: conv.updatedAt,
          messageCount: conv._count.messages,
          matchType,
          snippet,
        };
      })
    );

    return NextResponse.json({ conversations: results });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Search failed", conversations: [] },
      { status: 500 }
    );
  }
}
