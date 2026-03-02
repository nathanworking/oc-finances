import { db } from "@/db"
import { savingsGoals } from "@/db/schema"
import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

export async function GET() {
  const rows = await db.select().from(savingsGoals).all()
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const result = await db.insert(savingsGoals).values(body).returning()
  return NextResponse.json(result[0])
}

export async function PUT(req: NextRequest) {
  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const { id, ...data } = body
  if (typeof id !== "number") {
    return NextResponse.json({ error: "Missing or invalid id" }, { status: 400 })
  }
  const result = await db
    .update(savingsGoals)
    .set(data)
    .where(eq(savingsGoals.id, id))
    .returning()
  if (result.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json(result[0])
}

export async function DELETE(req: NextRequest) {
  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const { id } = body
  if (typeof id !== "number") {
    return NextResponse.json({ error: "Missing or invalid id" }, { status: 400 })
  }
  await db.delete(savingsGoals).where(eq(savingsGoals.id, id))
  return NextResponse.json({ ok: true })
}
