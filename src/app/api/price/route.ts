import { handlePriceRequest } from "@/pricing/handler";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handlePriceRequest(request);
}
