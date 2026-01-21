import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const schemaPath = path.join(process.cwd(), "..", "cli", "schemas", "agpm.json");
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));

  return NextResponse.json(schema, {
    headers: {
      "Content-Type": "application/schema+json",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
