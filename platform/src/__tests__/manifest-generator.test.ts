/**
 * Unit tests for Kubernetes manifest generator.
 *
 * Tests cover:
 * - Deterministic manifest generation for the same input
 * - Proper inclusion of init-container hydration
 * - Resource name consistency
 * - Input validation
 * - Manifest structure validation
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, test, expect } from "vitest";
import {
  generateKubernetesManifests,
  serializeManifestsToYaml,
  validateGeneratedManifests,
  type ManifestInput,
} from "@/lib/orchestration/manifest-generator";
import {
  getStatefulSetName,
  getServiceName,
  getPvcName,
  getPodName,
  getRuntimeNamespace,
} from "@/lib/orchestration/naming-helpers";

function expectDefined<T>(value: T | null | undefined, message: string): asserts value is T {
  expect(value, message).toBeDefined();
}

function rewriteHydrationScriptForTest(script: string) {
  const sandboxRoot = mkdtempSync(join(tmpdir(), "abra-hydration-"));
  const openclawHome = join(sandboxRoot, "openclaw-home");
  const configDir = join(sandboxRoot, "config");
  const secretsDir = join(sandboxRoot, "secrets");

  mkdirSync(openclawHome, { recursive: true });
  mkdirSync(configDir, { recursive: true });
  mkdirSync(secretsDir, { recursive: true });

  writeFileSync(join(configDir, "openclaw.json"), "{}\n");
  writeFileSync(join(configDir, "config.yaml"), "model:\n  default: gpt-5.5\n");
  writeFileSync(join(configDir, "auth.json"), '{"version":1}\n');
  writeFileSync(join(secretsDir, "env"), "OPENCLAW_HOME=/openclaw-home\n");

  return {
    executableScript: script
      .replaceAll("/openclaw-home", openclawHome)
      .replaceAll("/config/", `${configDir}/`)
      .replaceAll("/secrets/", `${secretsDir}/`)
      .replace(
        `chown -R 10000:10000 ${openclawHome}/.openclaw`,
        "true # chown skipped in test"
      )
      .replace(
        `chown -R 10000:10000 ${openclawHome}/.hermes`,
        "true # chown skipped in test"
      ),
    hydratedConfigPath: join(openclawHome, ".openclaw", "openclaw.json"),
    hydratedHermesConfigPath: join(openclawHome, ".hermes", "profiles", "abra", "config.yaml"),
    hydratedHermesAuthPath: join(openclawHome, ".hermes", "profiles", "abra", "auth.json"),
    hydratedEnvPath: join(openclawHome, ".openclaw", ".env"),
  };
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TEST_ACCOUNT_ID = "user123";
const TEST_DEPLOYMENT_ID = "abra-main";
const TEST_IMAGE = "openclaw/abra:latest";

const BASE_INPUT: ManifestInput = {
  accountId: TEST_ACCOUNT_ID,
  deploymentId: TEST_DEPLOYMENT_ID,
  image: TEST_IMAGE,
};

// ---------------------------------------------------------------------------
// Determinism tests
// ---------------------------------------------------------------------------

describe("Determinism", () => {
  test("generates identical manifests from same input (StatefulSet)", () => {
    const manifests1 = generateKubernetesManifests(BASE_INPUT);
    const manifests2 = generateKubernetesManifests(BASE_INPUT);

    expect(manifests1.statefulset).toEqual(manifests2.statefulset);
  });

  test("generates identical manifests from same input (Service)", () => {
    const manifests1 = generateKubernetesManifests(BASE_INPUT);
    const manifests2 = generateKubernetesManifests(BASE_INPUT);

    expect(manifests1.service).toEqual(manifests2.service);
  });

  test("generates identical manifests from same input (PVC)", () => {
    const manifests1 = generateKubernetesManifests(BASE_INPUT);
    const manifests2 = generateKubernetesManifests(BASE_INPUT);

    expect(manifests1.pvc).toEqual(manifests2.pvc);
  });

  test("generates identical names from same input", () => {
    const manifests1 = generateKubernetesManifests(BASE_INPUT);
    const manifests2 = generateKubernetesManifests(BASE_INPUT);

    expect(manifests1.names).toEqual(manifests2.names);
  });

  test("serializes to identical YAML from same manifests", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const yaml1 = serializeManifestsToYaml(manifests);
    const yaml2 = serializeManifestsToYaml(manifests);

    expect(yaml1.statefulset).toBe(yaml2.statefulset);
    expect(yaml1.service).toBe(yaml2.service);
    expect(yaml1.pvc).toBe(yaml2.pvc);
  });
});

// ---------------------------------------------------------------------------
// Input validation tests
// ---------------------------------------------------------------------------

describe("Input validation", () => {
  test("throws error when accountId is empty", () => {
    const input = { ...BASE_INPUT, accountId: "" };
    expect(() => generateKubernetesManifests(input)).toThrow(
      "accountId is required"
    );
  });

  test("throws error when deploymentId is empty", () => {
    const input = { ...BASE_INPUT, deploymentId: "" };
    expect(() => generateKubernetesManifests(input)).toThrow(
      "deploymentId is required"
    );
  });

  test("throws error when image is empty", () => {
    const input = { ...BASE_INPUT, image: "" };
    expect(() => generateKubernetesManifests(input)).toThrow(
      "image is required"
    );
  });

  test("accepts valid input", () => {
    expect(() => generateKubernetesManifests(BASE_INPUT)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// StatefulSet manifest tests
// ---------------------------------------------------------------------------

describe("StatefulSet manifest", () => {
  test("has correct apiVersion and kind", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;

    expect(statefulset.apiVersion).toBe("apps/v1");
    expect(statefulset.kind).toBe("StatefulSet");
  });

  test("has correct metadata name", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;

    expect(statefulset.metadata.name).toBe(
      getStatefulSetName(TEST_ACCOUNT_ID, TEST_DEPLOYMENT_ID)
    );
  });

  test("has correct namespace", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;

    expect(statefulset.metadata.namespace).toBe(getRuntimeNamespace());
  });

  test("has replicas set to 1", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;

    expect(statefulset.spec.replicas).toBe(1);
  });

  test("has serviceName pointing to correct service", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;

    expect(statefulset.spec.serviceName).toBe(
      getServiceName(TEST_ACCOUNT_ID, TEST_DEPLOYMENT_ID)
    );
  });

  test("has correct selector labels", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;
    const selector = statefulset.spec.selector;

    expect(selector.matchLabels.app).toBe("abra");
    expect(selector.matchLabels["abra.io/account-id"]).toBe(TEST_ACCOUNT_ID);
    expect(selector.matchLabels["abra.io/deployment-id"]).toBe(TEST_DEPLOYMENT_ID);
    expect(selector.matchLabels).toEqual(statefulset.spec.template.metadata.labels);
  });

  test("has main openclaw container with correct image", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;
    const spec = statefulset.spec;
    const containers = spec.template.spec.containers;

    const openclawContainer = containers.find(
      (c) => c.name === "openclaw"
    );
    expectDefined(openclawContainer, "openclaw container should exist");
    expect(openclawContainer.image).toBe(TEST_IMAGE);
  });

  test("has init-hydration container", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;
    const spec = statefulset.spec;
    const initContainers = spec.template.spec.initContainers;

    expectDefined(initContainers, "init containers should exist");
    const initContainer = initContainers.find(
      (c) => c.name === "init-hydration"
    );
    expectDefined(initContainer, "init hydration container should exist");
    expect(initContainer.image).toBe("busybox:latest");
  });

  test("runs init-hydration as root so it can hand off runtime ownership", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const initContainers = manifests.statefulset.spec.template.spec.initContainers;

    expectDefined(initContainers, "init containers should exist");
    const initContainer = initContainers.find(
      (c) => c.name === "init-hydration"
    );
    expectDefined(initContainer, "init hydration container should exist");

    expect(initContainer.securityContext).toEqual({
      runAsUser: 0,
      runAsGroup: 0,
    });
  });

  test("init-hydration container mounts config-volume", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;
    const spec = statefulset.spec;
    const initContainers = spec.template.spec.initContainers;

    expectDefined(initContainers, "init containers should exist");
    const initContainer = initContainers.find(
      (c) => c.name === "init-hydration"
    );
    expectDefined(initContainer, "init hydration container should exist");
    const volumeMounts = initContainer.volumeMounts;
    expectDefined(volumeMounts, "init hydration volume mounts should exist");

    const configMount = volumeMounts.find(
      (m) => m.name === "config-volume"
    );
    expectDefined(configMount, "config volume mount should exist");
    expect(configMount.mountPath).toBe("/config");
    expect(configMount.readOnly).toBe(true);
  });

  test("init-hydration container mounts secrets-volume", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;
    const spec = statefulset.spec;
    const initContainers = spec.template.spec.initContainers;

    expectDefined(initContainers, "init containers should exist");
    const initContainer = initContainers.find(
      (c) => c.name === "init-hydration"
    );
    expectDefined(initContainer, "init hydration container should exist");
    const volumeMounts = initContainer.volumeMounts;
    expectDefined(volumeMounts, "init hydration volume mounts should exist");

    const secretsMount = volumeMounts.find(
      (m) => m.name === "secrets-volume"
    );
    expectDefined(secretsMount, "secrets volume mount should exist");
    expect(secretsMount.mountPath).toBe("/secrets");
    expect(secretsMount.readOnly).toBe(true);
  });

  test("init-hydration container mounts openclaw-home volume", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;
    const spec = statefulset.spec;
    const initContainers = spec.template.spec.initContainers;

    expectDefined(initContainers, "init containers should exist");
    const initContainer = initContainers.find(
      (c) => c.name === "init-hydration"
    );
    expectDefined(initContainer, "init hydration container should exist");
    const volumeMounts = initContainer.volumeMounts;
    expectDefined(volumeMounts, "init hydration volume mounts should exist");

    const homeMount = volumeMounts.find(
      (m) => m.name === "openclaw-home"
    );
    expectDefined(homeMount, "openclaw-home mount should exist");
    expect(homeMount.mountPath).toBe("/openclaw-home");
  });

  test("main openclaw container mounts openclaw-home", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;
    const spec = statefulset.spec;
    const containers = spec.template.spec.containers;

    const openclawContainer = containers.find(
      (c) => c.name === "openclaw"
    );
    expectDefined(openclawContainer, "openclaw container should exist");
    const volumeMounts = openclawContainer.volumeMounts;
    expectDefined(volumeMounts, "openclaw volume mounts should exist");

    const homeMount = volumeMounts.find(
      (m) => m.name === "openclaw-home"
    );
    expectDefined(homeMount, "openclaw-home mount should exist");
    expect(homeMount.mountPath).toBe("/openclaw-home");
  });

  test("mounts the adapter-managed PVC for persistent storage", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;
    const spec = statefulset.spec;
    const volumes = spec.template.spec.volumes;
    expectDefined(volumes, "volumes should exist");
    const openclawHomeVolume = volumes.find(
      (volume) => volume.name === "openclaw-home"
    );

    expectDefined(openclawHomeVolume, "openclaw home volume should exist");
    expectDefined(
      openclawHomeVolume.persistentVolumeClaim,
      "openclaw home volume should use a PVC"
    );
    expect(openclawHomeVolume.persistentVolumeClaim.claimName).toBe(
      getPvcName(TEST_ACCOUNT_ID, TEST_DEPLOYMENT_ID)
    );
  });

  test("does not configure OpenClaw HTTP readiness probes for Hermes", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;
    const spec = statefulset.spec;
    const containers = spec.template.spec.containers;

    const openclawContainer = containers.find(
      (c) => c.name === "openclaw"
    );
    expectDefined(openclawContainer, "openclaw container should exist");
    expect(openclawContainer.readinessProbe).toBeUndefined();
  });

  test("does not configure OpenClaw HTTP liveness probes for Hermes", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;
    const spec = statefulset.spec;
    const containers = spec.template.spec.containers;

    const openclawContainer = containers.find(
      (c) => c.name === "openclaw"
    );
    expectDefined(openclawContainer, "openclaw container should exist");
    expect(openclawContainer.livenessProbe).toBeUndefined();
  });

  test("has init-hydration command with hydration logic", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;
    const spec = statefulset.spec;
    const initContainers = spec.template.spec.initContainers;

    expectDefined(initContainers, "init containers should exist");
    const initContainer = initContainers.find(
      (c) => c.name === "init-hydration"
    );
    expectDefined(initContainer, "init hydration container should exist");
    const command = initContainer.command as string[];

    expect(command).toBeDefined();
    // Command is ['/bin/sh', '-c', 'script'] so check the script portion
    expect(command.length).toBe(3);
    expect(command[2]).toContain("mkdir -p /openclaw-home/.openclaw");
    expect(command[2]).toContain("mkdir -p /openclaw-home/.hermes/profiles/abra");
    expect(command[2]).toContain("cp /config/openclaw.json /openclaw-home/.openclaw/");
    expect(command[2]).toContain("cp /config/config.yaml /openclaw-home/.hermes/profiles/abra/config.yaml");
    expect(command[2]).toContain("cp /config/auth.json /openclaw-home/.hermes/profiles/abra/auth.json");
    expect(command[2]).toContain("cp /secrets/env /openclaw-home/.hermes/profiles/abra/.env");
  });

  test("generates an init-hydration script that executes successfully", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const initContainers = manifests.statefulset.spec.template.spec.initContainers;

    expectDefined(initContainers, "init containers should exist");
    const initContainer = initContainers.find(
      (c) => c.name === "init-hydration"
    );
    expectDefined(initContainer, "init hydration container should exist");

    const command = initContainer.command as string[];
    expect(command).toHaveLength(3);

    const {
      executableScript,
      hydratedConfigPath,
      hydratedHermesConfigPath,
      hydratedHermesAuthPath,
      hydratedEnvPath,
    } = rewriteHydrationScriptForTest(command[2]);

    execFileSync(command[0], [command[1], executableScript], {
      env: process.env,
      stdio: "pipe",
    });

    expect(existsSync(hydratedConfigPath)).toBe(true);
    expect(existsSync(hydratedHermesConfigPath)).toBe(true);
    expect(existsSync(hydratedHermesAuthPath)).toBe(true);
    expect(existsSync(hydratedEnvPath)).toBe(true);
    expect(readFileSync(hydratedConfigPath, "utf8")).toBe("{}\n");
    expect(readFileSync(hydratedHermesConfigPath, "utf8")).toBe("model:\n  default: gpt-5.5\n");
    expect(readFileSync(hydratedHermesAuthPath, "utf8")).toBe('{"version":1}\n');
    expect(readFileSync(hydratedEnvPath, "utf8")).toBe("OPENCLAW_HOME=/openclaw-home\n");
  });

  test("applies custom image pull policy", () => {
    const input: ManifestInput = { ...BASE_INPUT, imagePullPolicy: "Always" };
    const manifests = generateKubernetesManifests(input);
    const statefulset = manifests.statefulset;
    const spec = statefulset.spec;
    const containers = spec.template.spec.containers;

    const openclawContainer = containers.find(
      (c) => c.name === "openclaw"
    );
    expectDefined(openclawContainer, "openclaw container should exist");
    expect(openclawContainer.imagePullPolicy).toBe("Always");
  });

  test("applies custom resources when provided", () => {
    const input: ManifestInput = {
      ...BASE_INPUT,
      resources: {
        cpu: "500m",
        memory: "512Mi",
      },
    };
    const manifests = generateKubernetesManifests(input);
    const statefulset = manifests.statefulset;
    const spec = statefulset.spec;
    const containers = spec.template.spec.containers;

    const openclawContainer = containers.find(
      (c) => c.name === "openclaw"
    );
    expectDefined(openclawContainer, "openclaw container should exist");
    expectDefined(openclawContainer.resources, "resources should exist");
    expect(openclawContainer.resources.limits.cpu).toBe("500m");
    expect(openclawContainer.resources.limits.memory).toBe("512Mi");
  });

  test("binds the configured service account when requested", () => {
    const manifests = generateKubernetesManifests({
      ...BASE_INPUT,
      useServiceAccount: true,
      serviceAccountName: "abra-runtime-sa",
    });

    expect(manifests.statefulset.spec.template.spec.serviceAccountName).toBe(
      "abra-runtime-sa"
    );
    expect(manifests.serviceAccount).toEqual(
      expect.objectContaining({
        kind: "ServiceAccount",
        metadata: expect.objectContaining({
          name: "abra-runtime-sa",
        }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Service manifest tests
// ---------------------------------------------------------------------------

describe("Service manifest", () => {
  test("has correct apiVersion and kind", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const service = manifests.service;

    expect(service.apiVersion).toBe("v1");
    expect(service.kind).toBe("Service");
  });

  test("has correct metadata name", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const service = manifests.service;

    expect(service.metadata.name).toBe(
      getServiceName(TEST_ACCOUNT_ID, TEST_DEPLOYMENT_ID)
    );
  });

  test("has correct namespace", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const service = manifests.service;

    expect(service.metadata.namespace).toBe(getRuntimeNamespace());
  });

  test("has type ClusterIP", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const service = manifests.service;
    const spec = service.spec;

    expect(spec.type).toBe("ClusterIP");
  });

  test("has correct port configuration", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const service = manifests.service;
    const spec = service.spec;

    expect(spec.ports.length).toBe(1);
    expect(spec.ports[0].port).toBe(18789);
    expect(spec.ports[0].targetPort).toBe(18789);
    expect(spec.ports[0].protocol).toBe("TCP");
    expect(spec.ports[0].name).toBe("http");
  });

  test("has correct selector labels", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const service = manifests.service;
    const spec = service.spec;

    expect(spec.selector.app).toBe("abra");
    expect(spec.selector["abra.io/account-id"]).toBe(TEST_ACCOUNT_ID);
    expect(spec.selector["abra.io/deployment-id"]).toBe(TEST_DEPLOYMENT_ID);
  });

  test("uses Kubernetes-safe bounded selector labels", () => {
    const manifests = generateKubernetesManifests({
      ...BASE_INPUT,
      accountId: "memory:FJYQATlMASRVEFkF0g6lGaJZ9gv2-with-extra-long-suffix-that-needs-compaction",
      deploymentId: "smoke-hermes-20260609231854-with-extra-long-suffix-that-needs-compaction",
    });

    for (const value of Object.values(manifests.service.spec.selector)) {
      expect(value.length).toBeLessThanOrEqual(63);
      expect(value).toMatch(/^[A-Za-z0-9]([A-Za-z0-9_.-]*[A-Za-z0-9])?$/);
    }
    expect(manifests.service.spec.selector).toEqual(
      manifests.statefulset.spec.selector.matchLabels
    );
  });
});

// ---------------------------------------------------------------------------
// PVC manifest tests
// ---------------------------------------------------------------------------

describe("PVC manifest", () => {
  test("has correct apiVersion and kind", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const pvc = manifests.pvc;

    expect(pvc.apiVersion).toBe("v1");
    expect(pvc.kind).toBe("PersistentVolumeClaim");
  });

  test("has correct metadata name", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const pvc = manifests.pvc;

    expect(pvc.metadata.name).toBe(
      getPvcName(TEST_ACCOUNT_ID, TEST_DEPLOYMENT_ID)
    );
  });

  test("has correct namespace", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const pvc = manifests.pvc;

    expect(pvc.metadata.namespace).toBe(getRuntimeNamespace());
  });

  test("has correct access mode", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const pvc = manifests.pvc;
    const spec = pvc.spec;

    expect(spec.accessModes).toContain("ReadWriteOnce");
  });

  test("has correct storage request", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const pvc = manifests.pvc;
    const spec = pvc.spec;

    expect(spec.resources.requests.storage).toBe("1Gi");
  });
});

describe("Runtime prerequisite manifests", () => {
  test("generates a namespace manifest for the runtime envelope", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);

    expect(manifests.namespace).toEqual(
      expect.objectContaining({
        apiVersion: "v1",
        kind: "Namespace",
        metadata: expect.objectContaining({
          name: getRuntimeNamespace(),
        }),
      })
    );
  });

  test("generates a config map with OpenClaw and Hermes profile config for hydration", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);

    expect(manifests.configMap).toEqual(
      expect.objectContaining({
        apiVersion: "v1",
        kind: "ConfigMap",
        metadata: expect.objectContaining({
          name: "abra-user123-abra-main-config",
        }),
        data: expect.objectContaining({
          "openclaw.json": expect.any(String),
          "config.yaml": expect.any(String),
          "auth.json": expect.any(String),
        }),
      })
    );
  });

  test("generates Hermes config.yaml with Azure Foundry model defaults", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);

    expect(manifests.configMap.data["config.yaml"]).toBe(
      [
        "# Generated by Abra platform AKS hydration.",
        "model:",
        "  default: gpt-5.5",
        "  provider: azure-foundry",
        "  base_url: https://azure-openai-746596.openai.azure.com/openai/v1",
        "  api_mode: chat_completions",
        "gateway:",
        "  media_delivery_allow_dirs:",
        "    - /openclaw-home/media",
        "terminal:",
        "  docker_forward_env:",
        "    - TELEGRAM_BOT_TOKEN",
        "    - TELEGRAM_ALLOWED_USERS",
        "    - TELEGRAM_HOME_CHANNEL",
        "    - AZURE_FOUNDRY_API_KEY",
        "",
      ].join("\n")
    );
  });

  test("generates a secret with env content for hydration", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);

    expect(manifests.secret).toEqual(
      expect.objectContaining({
        apiVersion: "v1",
        kind: "Secret",
        metadata: expect.objectContaining({
          name: "abra-user123-abra-main-secrets",
        }),
        stringData: expect.objectContaining({
          env: expect.any(String),
        }),
      })
    );
  });

  test("init script copies secrets file to .env (with dot prefix)", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const initContainers = manifests.statefulset.spec.template.spec.initContainers;
    const initContainer = initContainers?.find((c) => c.name === "init-hydration");
    expect(initContainer?.command?.[2]).toContain("cp /secrets/env /openclaw-home/.openclaw/.env");
  });

  test("without agentConfig: configMap has minimal gateway config, secret env is empty", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const config = JSON.parse(manifests.configMap.data["openclaw.json"]);
    expect(config).toEqual({ gateway: { mode: "local" } });
    expect(manifests.secret.stringData.env).toBe("");
  });

  test("with complete Telegram agentConfig: configMap references env var, secret env has Telegram values", () => {
    const manifests = generateKubernetesManifests({
      ...BASE_INPUT,
      agentConfig: {
        telegramBotToken: "123456:ABC-DEF",
        telegramHomeChannel: "123456789",
      },
    });
    const config = JSON.parse(manifests.configMap.data["openclaw.json"]);
    expect(config.channels.telegram.accounts.default.botToken).toBe("${TELEGRAM_BOT_TOKEN}");
    expect(manifests.secret.stringData.env).toBe(
      "TELEGRAM_BOT_TOKEN=123456:ABC-DEF\nTELEGRAM_HOME_CHANNEL=123456789\nTELEGRAM_ALLOWED_USERS=123456789"
    );
    expect(manifests.secret.stringData.TELEGRAM_BOT_TOKEN).toBe("123456:ABC-DEF");
    expect(manifests.secret.stringData.TELEGRAM_HOME_CHANNEL).toBe("123456789");
    expect(manifests.secret.stringData.TELEGRAM_ALLOWED_USERS).toBe("123456789");

    const openclawContainer = manifests.statefulset.spec.template.spec.containers.find(
      (c) => c.name === "openclaw"
    );
    expectDefined(openclawContainer, "openclaw container should exist");
    expect(openclawContainer.command).toBeUndefined();
    expect(openclawContainer.args).toEqual(["gateway", "run"]);
    expect(openclawContainer.env).toEqual(
      expect.arrayContaining([
        { name: "HERMES_HOME", value: "/openclaw-home/.hermes/profiles/abra" },
        expect.objectContaining({
          name: "TELEGRAM_ALLOWED_USERS",
          valueFrom: {
            secretKeyRef: {
              name: "abra-user123-abra-main-secrets",
              key: "TELEGRAM_ALLOWED_USERS",
            },
          },
        }),
      ])
    );
  });

  test("with explicit Telegram allowed users: secret env uses the allowlist separately from the home channel", () => {
    const manifests = generateKubernetesManifests({
      ...BASE_INPUT,
      agentConfig: {
        telegramBotToken: "123456:ABC-DEF",
        telegramHomeChannel: "-1001234567890",
        telegramAllowedUsers: "388259993,123456789",
      },
    });

    expect(manifests.secret.stringData.env).toContain("TELEGRAM_HOME_CHANNEL=-1001234567890");
    expect(manifests.secret.stringData.env).toContain("TELEGRAM_ALLOWED_USERS=388259993,123456789");
    expect(manifests.secret.stringData.TELEGRAM_ALLOWED_USERS).toBe("388259993,123456789");
  });

  test("with Azure Foundry key: secret env and container env expose the key from Secret", () => {
    const manifests = generateKubernetesManifests({
      ...BASE_INPUT,
      runtimeEnv: {
        azureFoundryApiKey: "test-azure-key",
      },
    });

    expect(manifests.secret.stringData.env).toBe("AZURE_FOUNDRY_API_KEY=test-azure-key");
    expect(manifests.secret.stringData.AZURE_FOUNDRY_API_KEY).toBe("test-azure-key");

    const authConfig = JSON.parse(manifests.configMap.data["auth.json"]);
    expect(authConfig).toEqual({
      version: 1,
      providers: {},
      active_provider: null,
      updated_at: "2026-06-10T00:05:30.258363+00:00",
      credential_pool: {
        "azure-foundry": [
          {
            id: "19b47d",
            label: "AZURE_FOUNDRY_API_KEY",
            auth_type: "api_key",
            priority: 0,
            source: "env:AZURE_FOUNDRY_API_KEY",
            last_status: null,
            last_status_at: null,
            last_error_code: null,
            last_error_reason: null,
            last_error_message: null,
            last_error_reset_at: null,
            base_url: "",
            request_count: 0,
            secret_fingerprint: "sha256:dfa9e6a1592ad440",
          },
        ],
        "custom:azure": [],
      },
    });

    const openclawContainer = manifests.statefulset.spec.template.spec.containers.find(
      (c) => c.name === "openclaw"
    );
    expectDefined(openclawContainer, "openclaw container should exist");
    expect(openclawContainer.env).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "AZURE_FOUNDRY_API_KEY",
          valueFrom: {
            secretKeyRef: {
              name: "abra-user123-abra-main-secrets",
              key: "AZURE_FOUNDRY_API_KEY",
            },
          },
        }),
      ])
    );
  });

  test("with incomplete Telegram agentConfig: behaves like no agentConfig", () => {
    const manifests = generateKubernetesManifests({
      ...BASE_INPUT,
      agentConfig: { telegramBotToken: "  ", telegramHomeChannel: "123456789" },
    });
    const config = JSON.parse(manifests.configMap.data["openclaw.json"]);
    expect(config).toEqual({ gateway: { mode: "local" } });
    expect(manifests.secret.stringData.env).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Names consistency tests
// ---------------------------------------------------------------------------

describe("Names consistency", () => {
  test("StatefulSet name matches naming helper", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;

    expect(manifests.names.statefulSetName).toBe(
      getStatefulSetName(TEST_ACCOUNT_ID, TEST_DEPLOYMENT_ID)
    );
    expect(statefulset.metadata.name).toBe(manifests.names.statefulSetName);
  });

  test("Service name matches naming helper", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const service = manifests.service;

    expect(manifests.names.serviceName).toBe(
      getServiceName(TEST_ACCOUNT_ID, TEST_DEPLOYMENT_ID)
    );
    expect(service.metadata.name).toBe(manifests.names.serviceName);
  });

  test("PVC name matches naming helper", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const pvc = manifests.pvc;

    expect(manifests.names.pvcName).toBe(
      getPvcName(TEST_ACCOUNT_ID, TEST_DEPLOYMENT_ID)
    );
    expect(pvc.metadata.name).toBe(manifests.names.pvcName);
  });

  test("Pod name matches naming helper", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);

    expect(manifests.names.podName).toBe(
      getPodName(TEST_ACCOUNT_ID, TEST_DEPLOYMENT_ID)
    );
  });

  test("runtime prerequisite names are deterministic", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);

    expect(manifests.names.configMapName).toBe("abra-user123-abra-main-config");
    expect(manifests.names.secretName).toBe("abra-user123-abra-main-secrets");
    expect(manifests.names.serviceAccountName).toBeUndefined();
  });

  test("compacts long generated AKS names while keeping cross-resource references aligned", () => {
    const manifests = generateKubernetesManifests({
      accountId: "fjyqatlmasrvefkf0g6lgajz9gv2",
      deploymentId: "9ba066b6-8348-4e00-abd3-52e7fcc7e04c",
      image: TEST_IMAGE,
    });

    expect(manifests.names.statefulSetName.length).toBeLessThanOrEqual(52);
    expect(manifests.names.serviceName.length).toBeLessThanOrEqual(63);
    expect(manifests.names.pvcName.length).toBeLessThanOrEqual(63);
    expect(manifests.names.configMapName.length).toBeLessThanOrEqual(63);
    expect(manifests.names.secretName.length).toBeLessThanOrEqual(63);
    expect(manifests.names.podName.length).toBeLessThanOrEqual(63);
    expect(manifests.statefulset.spec.serviceName).toBe(manifests.names.serviceName);
    expect(manifests.service.metadata.name).toBe(manifests.names.serviceName);
    expect(manifests.pvc.metadata.name).toBe(manifests.names.pvcName);
    expect(manifests.configMap.metadata.name).toBe(manifests.names.configMapName);
    expect(manifests.secret.metadata.name).toBe(manifests.names.secretName);
  });
});

// ---------------------------------------------------------------------------
// Serialization tests
// ---------------------------------------------------------------------------

describe("YAML serialization", () => {
  test("serializes StatefulSet to YAML string", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const yaml = serializeManifestsToYaml(manifests);

    expect(yaml.statefulset).toContain("apiVersion:");
    expect(yaml.statefulset).toContain("kind: StatefulSet");
    expect(yaml.statefulset).toContain("metadata:");
  });

  test("serializes Service to YAML string", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const yaml = serializeManifestsToYaml(manifests);

    expect(yaml.service).toContain("apiVersion:");
    expect(yaml.service).toContain("kind: Service");
    expect(yaml.service).toContain("metadata:");
  });

  test("serializes PVC to YAML string", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const yaml = serializeManifestsToYaml(manifests);

    expect(yaml.pvc).toContain("apiVersion:");
    expect(yaml.pvc).toContain("kind: PersistentVolumeClaim");
    expect(yaml.pvc).toContain("metadata:");
  });
});

// ---------------------------------------------------------------------------
// Manifest validation tests
// ---------------------------------------------------------------------------

describe("Manifest validation", () => {
  test("passes validation for valid manifests", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    expect(() => validateGeneratedManifests(manifests)).not.toThrow();
  });

  test("throws error for StatefulSet with wrong apiVersion", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    manifests.statefulset.apiVersion = "v1";
    expect(() => validateGeneratedManifests(manifests)).toThrow(
      "StatefulSet apiVersion mismatch"
    );
  });

  test("throws error for Service with wrong kind", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    manifests.service.kind = "Deployment";
    expect(() => validateGeneratedManifests(manifests)).toThrow(
      "Service kind mismatch"
    );
  });

  test("throws error for PVC with missing accessModes", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    delete (manifests.pvc.spec as { accessModes?: string[] }).accessModes;
    expect(() => validateGeneratedManifests(manifests)).toThrow(
      "PVC missing spec.accessModes"
    );
  });

  test("throws error when generated config map loses openclaw.json", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    delete manifests.configMap.data["openclaw.json"];

    expect(() => validateGeneratedManifests(manifests)).toThrow(
      "ConfigMap missing data.openclaw.json"
    );
  });

  test("throws error when generated config map loses config.yaml", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    delete manifests.configMap.data["config.yaml"];

    expect(() => validateGeneratedManifests(manifests)).toThrow(
      "ConfigMap missing data.config.yaml"
    );
  });

  test("throws error when generated config map loses auth.json", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    delete manifests.configMap.data["auth.json"];

    expect(() => validateGeneratedManifests(manifests)).toThrow(
      "ConfigMap missing data.auth.json"
    );
  });
});

// ---------------------------------------------------------------------------
// Custom input tests
// ---------------------------------------------------------------------------

describe("Custom inputs", () => {
  test("generates correct names with different accountId", () => {
    const input: ManifestInput = {
      accountId: "custom-user",
      deploymentId: "abra-prod",
      image: TEST_IMAGE,
    };
    const manifests = generateKubernetesManifests(input);

    expect(manifests.names.statefulSetName).toBe(
      "abra-custom-user-abra-prod"
    );
    expect(manifests.names.serviceName).toBe("abra-custom-user-abra-prod-svc");
    expect(manifests.names.pvcName).toBe("abra-custom-user-abra-prod-data");
    expect(manifests.names.podName).toBe("abra-custom-user-abra-prod-0");
  });

  test("generates correct names with different deploymentId", () => {
    const input: ManifestInput = {
      accountId: "user123",
      deploymentId: "abra-dev",
      image: TEST_IMAGE,
    };
    const manifests = generateKubernetesManifests(input);

    expect(manifests.names.statefulSetName).toBe("abra-user123-abra-dev");
    expect(manifests.names.serviceName).toBe("abra-user123-abra-dev-svc");
    expect(manifests.names.pvcName).toBe("abra-user123-abra-dev-data");
    expect(manifests.names.podName).toBe("abra-user123-abra-dev-0");
  });
});
