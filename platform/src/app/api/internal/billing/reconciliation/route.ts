import { NextResponse } from "next/server";

import {
  isBillingReconciliationAdminCredential,
  readBillingReconciliationAdminSecret,
  runInternalUsageReconciliationReport,
} from "@/lib/billing/reconciliation-admin-service";

export const runtime = "nodejs";

function readBearerCredential(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  return authorization.startsWith(prefix) ? authorization.slice(prefix.length).trim() : null;
}

export async function GET(request: Request) {
  if (!readBillingReconciliationAdminSecret()) {
    return NextResponse.json(
      {
        error: {
          code: "RECONCILIATION_ADMIN_UNCONFIGURED",
          message: "Billing reconciliation admin access is not configured.",
        },
      },
      { status: 503 },
    );
  }

  if (!isBillingReconciliationAdminCredential(readBearerCredential(request))) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Billing reconciliation admin credential is required.",
        },
      },
      { status: 401 },
    );
  }

  const report = await runInternalUsageReconciliationReport();
  return NextResponse.json({ report }, { status: 200 });
}
