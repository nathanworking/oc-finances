import { db } from "@/db"
import { profitFirstConfig } from "@/db/schema"
import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

export async function GET() {
  const rows = await db.select().from(profitFirstConfig).all()
  return NextResponse.json(rows)
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
    .update(profitFirstConfig)
    .set(data)
    .where(eq(profitFirstConfig.id, id))
    .returning()
  if (result.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json(result[0])
}
