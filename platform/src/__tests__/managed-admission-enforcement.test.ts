import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { getFixedUtcWeekQuotaWindow } from "@/lib/billing/contracts";
import { generateKubernetesManifests, type ManifestInput } from "@/lib/orchestration/manifest-generator";

const getAdminFirestoreMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: getAdminFirestoreMock,
}));

type StoredDoc = Record<string, unknown>;

const ACCOUNT_ID = "acct-managed";
const DEPLOYMENT_ID = "deploy-managed";
const NOW = "2026-06-25T12:00:00.000Z";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createFirestoreMock(initialDocs: Array<[string, StoredDoc]> = []) {
  const docs = new Map<string, StoredDoc>(initialDocs);
  const doc = vi.fn((path: string) => ({
    path,
    get: vi.fn(async () => ({
      exists: docs.has(path),
      data: () => {
        const value = docs.get(path);
        return value ? clone(value) : undefined;
      },
    })),
  }));
  let transactionQueue = Promise.resolve();
  const runTransaction = vi.fn(<T>(callback: (transaction: {
    get: (ref: { path: string }) => Promise<{ exists: boolean; data: () => StoredDoc | undefined }>;
    set: (ref: { path: string }, data: StoredDoc, options?: { merge?: boolean }) => void;
  }) => Promise<T>) => {
    const run = async () => {
      const staged: Array<{ path: string; data: StoredDoc; merge?: boolean }> = [];
      const transaction = {
        get: vi.fn(async (ref: { path: string }) => ({
          exists: docs.has(ref.path),
          data: () => {
            const value = docs.get(ref.path);
            return value ? clone(value) : undefined;
          },
        })),
        set: vi.fn((ref: { path: string }, data: StoredDoc, options?: { merge?: boolean }) => {
          staged.push({ path: ref.path, data: clone(data), merge: options?.merge });
        }),
      };
      const result = await callback(transaction);
      for (const write of staged) {
        docs.set(write.path, write.merge && docs.has(write.path)
          ? { ...docs.get(write.path), ...write.data }
          : write.data);
      }
      return result;
    };

    const result = transactionQueue.then(run, run);
    transactionQueue = result.then(() => undefined, () => undefined);
    return result;
  });

  return { firestore: { doc, runTransaction }, docs };
}

function quotaWindowPath(accountId: string) {
  return `accounts/${accountId}/quota/windows/${getFixedUtcWeekQuotaWindow(NOW).id}/current`;
}

function admissionRequest(credential: string, body: Record<string, unknown>) {
  return new Request("http://localhost:3000/api/billing/admission", {
    method: "POST",
    headers: {
      authorization: `Bearer ${credential}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function buildHydrationSandbox(script: string) {
  const root = mkdtempSync(join(tmpdir(), "abra-managed-admission-"));
  const hermesData = join(root, "opt-data");
  const configDir = join(root, "config");
  const secretsDir = join(root, "secrets");
  const localesDir = join(root, "locales");
  const localeOverrideDir = join(root, "locale-override");
  const gatewayDir = join(root, "gateway");
  const gatewayOverrideDir = join(root, "gateway-override");

  mkdirSync(join(gatewayDir, "platforms"), { recursive: true });
  for (const dir of [hermesData, configDir, secretsDir, localesDir, localeOverrideDir, gatewayOverrideDir]) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(join(configDir, "config.yaml"), "model:\n  default: test\n");
  writeFileSync(join(configDir, "auth.json"), "{}\n");
  writeFileSync(join(secretsDir, "env"), "ABRA_MANAGED_RUNTIME=1\n");
  writeFileSync(
    join(localesDir, "en.yaml"),
    "gateway:\n  reset:\n    header_default: \"old\"\n    header_new: \"old\"\n    tip: \"old\"\n",
  );
  writeFileSync(
    join(gatewayDir, "slash_commands.py"),
    "        try:\n            session_info = self._format_session_info()\n        except Exception:\n            session_info = \"\"\n",
  );
  writeFileSync(
    join(gatewayDir, "platforms", "base.py"),
    [
      "class BaseAdapter:",
      "    async def handle_message(self, event):",
      "        await self._process_message_background(event)",
      "",
    ].join("\n"),
  );

  const executableScript = script
    .replaceAll("/opt/data", hermesData)
    .replaceAll("/config/", `${configDir}/`)
    .replaceAll("/secrets/", `${secretsDir}/`)
    .replace("cp -r /opt/hermes/locales/. /locale-override/", `cp -r ${localesDir}/. ${localeOverrideDir}/`)
    .replace("cp -r /opt/hermes/gateway/. /gateway-override/", `cp -r ${gatewayDir}/. ${gatewayOverrideDir}/`)
    .replaceAll("/locale-override/en.yaml", `${localeOverrideDir}/en.yaml`)
    .replaceAll("'/gateway-override/slash_commands.py'", `'${gatewayOverrideDir}/slash_commands.py'`)
    .replaceAll("'/gateway-override/platforms/base.py'", `'${join(gatewayOverrideDir, "platforms", "base.py")}'`)
    .replace(`chown -R 10000:10000 ${hermesData}`, "true # chown skipped in test");

  return {
    root,
    executableScript,
    patchedBasePath: join(gatewayOverrideDir, "platforms", "base.py"),
    patchedSlashCommandsPath: join(gatewayOverrideDir, "slash_commands.py"),
  };
}

function runPatchedGatewayCase(basePath: string, mode: "allow" | "deny" | "unreachable" | "self-hosted") {
  const scriptPath = join(mkdtempSync(join(tmpdir(), "abra-managed-admission-run-")), "run.py");
  writeFileSync(scriptPath, String.raw`
import asyncio
import importlib.util
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

base_path = ${JSON.stringify(basePath)}
mode = ${JSON.stringify(mode)}

spec = importlib.util.spec_from_file_location("patched_base", base_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class Event:
    message_id = "telegram-message-1"

class Adapter(module.BaseAdapter):
    def __init__(self):
        self.forwarded = 0
    async def _process_message_background(self, event):
        self.forwarded += 1

calls = []
server = None
thread = None

if mode in ("allow", "deny"):
    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            length = int(self.headers.get("content-length", "0"))
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            calls.append({"body": body, "authorization": self.headers.get("authorization")})
            if mode == "allow":
                self.send_response(200)
                payload = {"allow": True}
            else:
                self.send_response(402)
                payload = {
                    "allow": False,
                    "reasonCode": "quota_exhausted",
                    "message": "You've reached your Free message limit. Upgrade to Growth to keep processing managed messages.",
                }
            self.send_header("content-type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(payload).encode("utf-8"))
        def log_message(self, *args):
            pass
    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    os.environ["ABRA_MANAGED_ADMISSION_URL"] = f"http://127.0.0.1:{server.server_port}/admit"
elif mode == "unreachable":
    os.environ["ABRA_MANAGED_ADMISSION_URL"] = "http://127.0.0.1:9/admit"

if mode == "self-hosted":
    for key in ("ABRA_MANAGED_RUNTIME", "ABRA_MANAGED_ACCOUNT_ID", "ABRA_MANAGED_DEPLOYMENT_ID", "ABRA_MANAGED_RUNTIME_CREDENTIAL", "ABRA_MANAGED_ADMISSION_URL"):
        os.environ.pop(key, None)
else:
    os.environ["ABRA_MANAGED_RUNTIME"] = "1"
    os.environ["ABRA_MANAGED_ACCOUNT_ID"] = "acct-managed"
    os.environ["ABRA_MANAGED_DEPLOYMENT_ID"] = "deploy-managed"
    os.environ["ABRA_MANAGED_RUNTIME_CREDENTIAL"] = "runtime-secret"

adapter = Adapter()
raised = None
try:
    asyncio.run(adapter.handle_message(Event()))
except Exception as exc:
    raised = type(exc).__name__ + ": " + str(exc)
finally:
    if server is not None:
        server.shutdown()
        thread.join(timeout=2)

print(json.dumps({"forwarded": adapter.forwarded, "raised": raised, "calls": calls}, sort_keys=True))
`);
  return JSON.parse(execFileSync("python3", [scriptPath], { encoding: "utf8" })) as {
    forwarded: number;
    raised: string | null;
    calls: Array<{ body: Record<string, unknown>; authorization: string | null }>;
  };
}

describe("managed admission endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.ABRA_MANAGED_RUNTIME_CREDENTIAL_SECRET = "test-platform-secret";
  });

  it("reserves quota for a managed runtime request below quota", async () => {
    const firestore = createFirestoreMock([[`accounts/${ACCOUNT_ID}/summaries/billing`, { tier: "free" }]]);
    getAdminFirestoreMock.mockReturnValue(firestore.firestore);
    const { createManagedRuntimeCredential } = await import("@/lib/billing/managed-admission-runtime");
    const { POST } = await import("@/app/api/billing/admission/route");
    const credential = createManagedRuntimeCredential({
      accountId: ACCOUNT_ID,
      deploymentId: DEPLOYMENT_ID,
      secret: "test-platform-secret",
    });

    const response = await POST(admissionRequest(credential, {
      accountId: ACCOUNT_ID,
      deploymentId: DEPLOYMENT_ID,
      requestId: "runtime-request-1",
      channelMessageId: "telegram-message-1",
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      allow: true,
      reasonCode: null,
      used: 1,
      limit: 25,
    });
    expect(firestore.docs.get(quotaWindowPath(ACCOUNT_ID))).toMatchObject({ used: 1, limit: 25 });
  });

  it("denies a free managed runtime request at quota with an upgrade message", async () => {
    const firestore = createFirestoreMock([
      [`accounts/${ACCOUNT_ID}/summaries/billing`, { tier: "free" }],
      [quotaWindowPath(ACCOUNT_ID), { used: 25, limit: 25 }],
    ]);
    getAdminFirestoreMock.mockReturnValue(firestore.firestore);
    const { createManagedRuntimeCredential } = await import("@/lib/billing/managed-admission-runtime");
    const { POST } = await import("@/app/api/billing/admission/route");
    const credential = createManagedRuntimeCredential({
      accountId: ACCOUNT_ID,
      deploymentId: DEPLOYMENT_ID,
      secret: "test-platform-secret",
    });

    const response = await POST(admissionRequest(credential, {
      accountId: ACCOUNT_ID,
      deploymentId: DEPLOYMENT_ID,
      requestId: "runtime-request-2",
      channelMessageId: "telegram-message-2",
    }));

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toMatchObject({
      allow: false,
      reasonCode: "quota_exhausted",
      message: "You've reached your Free message limit. Upgrade to Growth to keep processing managed messages.",
      used: 25,
      limit: 25,
    });
    expect(firestore.docs.get(quotaWindowPath(ACCOUNT_ID))).toMatchObject({ used: 25, limit: 25 });
  });

  it("denies a growth managed runtime request at quota with a follow-up offer message", async () => {
    const firestore = createFirestoreMock([
      [`accounts/${ACCOUNT_ID}/summaries/billing`, { tier: "growth" }],
      [quotaWindowPath(ACCOUNT_ID), { used: 100, limit: 100 }],
    ]);
    getAdminFirestoreMock.mockReturnValue(firestore.firestore);
    const { createManagedRuntimeCredential } = await import("@/lib/billing/managed-admission-runtime");
    const { POST } = await import("@/app/api/billing/admission/route");
    const credential = createManagedRuntimeCredential({
      accountId: ACCOUNT_ID,
      deploymentId: DEPLOYMENT_ID,
      secret: "test-platform-secret",
    });

    const response = await POST(admissionRequest(credential, {
      accountId: ACCOUNT_ID,
      deploymentId: DEPLOYMENT_ID,
      requestId: "runtime-request-growth-limit",
      channelMessageId: "telegram-message-growth-limit",
    }));

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toMatchObject({
      allow: false,
      reasonCode: "quota_exhausted",
      message: "You've reached your Growth message limit. I will reach out within 24 hours with an offer.",
      used: 100,
      limit: 100,
    });
    expect(firestore.docs.get(quotaWindowPath(ACCOUNT_ID))).toMatchObject({ used: 100, limit: 100 });
  });
});

describe("managed admission gateway override", () => {
  const managedInput: ManifestInput = {
    accountId: ACCOUNT_ID,
    deploymentId: DEPLOYMENT_ID,
    image: "abra:test",
    managedAdmission: {
      enabled: true,
      url: "https://platform.example.com/api/billing/admission",
      accountId: ACCOUNT_ID,
      deploymentId: DEPLOYMENT_ID,
      credential: "runtime-secret",
    },
  };

  it("injects platform-owned managed admission env without user-editable runtimeEnv", () => {
    const manifests = generateKubernetesManifests(managedInput);

    expect(manifests.secret.stringData.env).toContain("ABRA_MANAGED_RUNTIME=1");
    expect(manifests.secret.stringData.env).toContain("ABRA_MANAGED_ADMISSION_URL=https://platform.example.com/api/billing/admission");
    expect(manifests.secret.stringData.env).toContain(`ABRA_MANAGED_ACCOUNT_ID=${ACCOUNT_ID}`);
    expect(manifests.secret.stringData.env).toContain(`ABRA_MANAGED_DEPLOYMENT_ID=${DEPLOYMENT_ID}`);
    expect(manifests.secret.stringData.ABRA_MANAGED_RUNTIME_CREDENTIAL).toBe("runtime-secret");

    const userSupplied = generateKubernetesManifests({
      accountId: ACCOUNT_ID,
      deploymentId: DEPLOYMENT_ID,
      image: "abra:test",
      runtimeEnv: {
        ABRA_MANAGED_RUNTIME_CREDENTIAL: "user-controlled",
        ABRA_MANAGED_ADMISSION_URL: "https://evil.example.com",
      },
    });
    expect(userSupplied.secret.stringData.env).not.toContain("ABRA_MANAGED_");
    expect(userSupplied.secret.stringData.ABRA_MANAGED_RUNTIME_CREDENTIAL).toBeUndefined();
  });

  it("patches BaseAdapter.handle_message to admit before forwarding and deny before forwarding", () => {
    const manifests = generateKubernetesManifests(managedInput);
    const initContainer = manifests.statefulset.spec.template.spec.initContainers?.find((container) => container.name === "init-hydration");
    expect(initContainer?.command).toHaveLength(3);
    const sandbox = buildHydrationSandbox(initContainer?.command?.[2] ?? "");

    execFileSync("/bin/sh", ["-c", sandbox.executableScript], { stdio: "pipe" });
    const patchedBase = readFileSync(sandbox.patchedBasePath, "utf8");
    expect(patchedBase).toContain("# ABRA_MANAGED_ADMISSION_SHIM");
    expect(patchedBase).toContain("await _abra_managed_admission_before_handle(event)");
    expect(readFileSync(sandbox.patchedSlashCommandsPath, "utf8")).toContain("Abra: model info suppressed");

    const admitted = runPatchedGatewayCase(sandbox.patchedBasePath, "allow");
    expect(admitted).toMatchObject({ forwarded: 1, raised: null });
    expect(admitted.calls[0]).toMatchObject({
      authorization: "Bearer runtime-secret",
      body: {
        accountId: ACCOUNT_ID,
        deploymentId: DEPLOYMENT_ID,
        requestId: "telegram-message-1",
        channelMessageId: "telegram-message-1",
      },
    });

    const denied = runPatchedGatewayCase(sandbox.patchedBasePath, "deny");
    expect(denied.forwarded).toBe(0);
    expect(denied.raised).toContain("You've reached your Free message limit. Upgrade to Growth to keep processing managed messages.");

    const unreachable = runPatchedGatewayCase(sandbox.patchedBasePath, "unreachable");
    expect(unreachable.forwarded).toBe(0);
    expect(unreachable.raised).toContain("Abra managed admission endpoint is unreachable");

    const selfHosted = runPatchedGatewayCase(sandbox.patchedBasePath, "self-hosted");
    expect(selfHosted).toMatchObject({ forwarded: 1, raised: null, calls: [] });
  });
});
