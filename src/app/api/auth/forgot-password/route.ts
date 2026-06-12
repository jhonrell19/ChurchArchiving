import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { message: "Email is required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { message: "No account found with this email" },
        { status: 404 }
      );
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        purpose: "password_reset",
      },
      process.env.JWT_SECRET as string,
      { expiresIn: "15m" }
    );

    const resetLink = `/reset-password?token=${token}`;

    return NextResponse.json({
      message: "Password reset link generated",
      resetLink,
    });
  } catch (error) {
    console.error("Forgot password error:", error);

    return NextResponse.json(
      { message: "Failed to generate reset link" },
      { status: 500 }
    );
  }
}