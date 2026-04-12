import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { z } from "zod";

const createNoteSchema = z.object({
  content: z.string().min(1, "Content is required"),
});

const deleteNoteSchema = z.object({
  noteId: z.string().min(1, "Note ID is required"),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((session.user as { role: string }).role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId } = await params;

    const notes: { id: string; userId: string; authorId: string; content: string; createdAt: Date }[] = await prisma.adminNote.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    const notesWithAuthor = await Promise.all(
      notes.map(async (note: { id: string; userId: string; authorId: string; content: string; createdAt: Date }) => {
        const author = await prisma.user.findUnique({
          where: { id: note.authorId },
          select: { name: true },
        });
        return {
          ...note,
          authorName: author?.name || "Unknown",
        };
      })
    );

    return NextResponse.json(notesWithAuthor);
  } catch (error) {
    console.error("Failed to fetch notes:", error);
    return NextResponse.json(
      { error: "Failed to fetch notes" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((session.user as { role: string }).role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId } = await params;
    const authorId = session.user.id as string;

    const body = await request.json();
    const validation = createNoteSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const note = await prisma.adminNote.create({
      data: {
        userId,
        authorId,
        content: validation.data.content,
      },
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error("Failed to create note:", error);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((session.user as { role: string }).role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await params;

    const body = await request.json();
    const validation = deleteNoteSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    await prisma.adminNote.delete({
      where: { id: validation.data.noteId },
    });

    return NextResponse.json({ message: "Note deleted successfully" });
  } catch (error) {
    console.error("Failed to delete note:", error);
    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 }
    );
  }
}
