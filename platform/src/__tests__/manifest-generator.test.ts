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

import { describe, test, expect, beforeEach, afterEach } from "vitest";
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

    expect((statefulset.metadata as any).name).toBe(
      getStatefulSetName(TEST_ACCOUNT_ID, TEST_DEPLOYMENT_ID)
    );
  });

  test("has correct namespace", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;

    expect((statefulset.metadata as any).namespace).toBe(getRuntimeNamespace());
  });

  test("has replicas set to 1", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;

    expect((statefulset.spec as any).replicas).toBe(1);
  });

  test("has serviceName pointing to correct service", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;

    expect((statefulset.spec as any).serviceName).toBe(
      getServiceName(TEST_ACCOUNT_ID, TEST_DEPLOYMENT_ID)
    );
  });

  test("has correct selector labels", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;
    const selector = (statefulset.spec as any).selector;

    expect(selector.matchLabels.app).toBe("abra");
    expect(selector.matchLabels["abra.io/deployment-id"]).toBe(TEST_DEPLOYMENT_ID);
  });

  test("has main openclaw container with correct image", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;
    const spec = statefulset.spec as any;
    const containers = spec.template.spec.containers;

    const openclawContainer = containers.find(
      (c: any) => c.name === "openclaw"
    );
    expect(openclawContainer).toBeDefined();
    expect(openclawContainer.image).toBe(TEST_IMAGE);
  });

  test("has init-hydration container", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;
    const spec = statefulset.spec as any;
    const initContainers = spec.template.spec.initContainers;

    const initContainer = initContainers.find(
      (c: any) => c.name === "init-hydration"
    );
    expect(initContainer).toBeDefined();
    expect(initContainer.image).toBe("bitnami/kubectl:latest");
  });

  test("init-hydration container mounts config-volume", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;
    const spec = statefulset.spec as any;
    const initContainers = spec.template.spec.initContainers;

    const initContainer = initContainers.find(
      (c: any) => c.name === "init-hydration"
    );
    const volumeMounts = initContainer.volumeMounts;

    const configMount = volumeMounts.find(
      (m: any) => m.name === "config-volume"
    );
    expect(configMount).toBeDefined();
    expect(configMount.mountPath).toBe("/config");
    expect(configMount.readOnly).toBe(true);
  });

  test("init-hydration container mounts secrets-volume", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;
    const spec = statefulset.spec as any;
    const initContainers = spec.template.spec.initContainers;

    const initContainer = initContainers.find(
      (c: any) => c.name === "init-hydration"
    );
    const volumeMounts = initContainer.volumeMounts;

    const secretsMount = volumeMounts.find(
      (m: any) => m.name === "secrets-volume"
    );
    expect(secretsMount).toBeDefined();
    expect(secretsMount.mountPath).toBe("/secrets");
    expect(secretsMount.readOnly).toBe(true);
  });

  test("init-hydration container mounts openclaw-home volume", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;
    const spec = statefulset.spec as any;
    const initContainers = spec.template.spec.initContainers;

    const initContainer = initContainers.find(
      (c: any) => c.name === "init-hydration"
    );
    const volumeMounts = initContainer.volumeMounts;

    const homeMount = volumeMounts.find(
      (m: any) => m.name === "openclaw-home"
    );
    expect(homeMount).toBeDefined();
    expect(homeMount.mountPath).toBe("/openclaw-home");
  });

  test("main openclaw container mounts openclaw-home", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;
    const spec = statefulset.spec as any;
    const containers = spec.template.spec.containers;

    const openclawContainer = containers.find(
      (c: any) => c.name === "openclaw"
    );
    const volumeMounts = openclawContainer.volumeMounts;

    const homeMount = volumeMounts.find(
      (m: any) => m.name === "openclaw-home"
    );
    expect(homeMount).toBeDefined();
    expect(homeMount.mountPath).toBe("/openclaw-home");
  });

  test("mounts the adapter-managed PVC for persistent storage", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;
    const spec = statefulset.spec as any;
    const openclawHomeVolume = spec.template.spec.volumes.find(
      (volume: any) => volume.name === "openclaw-home"
    );

    expect(openclawHomeVolume).toBeDefined();
    expect(openclawHomeVolume.persistentVolumeClaim).toBeDefined();
    expect(openclawHomeVolume.persistentVolumeClaim.claimName).toBe(
      getPvcName(TEST_ACCOUNT_ID, TEST_DEPLOYMENT_ID)
    );
  });

  test("has readiness probe configured", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;
    const spec = statefulset.spec as any;
    const containers = spec.template.spec.containers;

    const openclawContainer = containers.find(
      (c: any) => c.name === "openclaw"
    );
    expect(openclawContainer.readinessProbe).toBeDefined();
    expect(openclawContainer.readinessProbe.httpGet.path).toBe("/health");
    expect(openclawContainer.readinessProbe.httpGet.port).toBe(3000);
  });

  test("has liveness probe configured", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;
    const spec = statefulset.spec as any;
    const containers = spec.template.spec.containers;

    const openclawContainer = containers.find(
      (c: any) => c.name === "openclaw"
    );
    expect(openclawContainer.livenessProbe).toBeDefined();
    expect(openclawContainer.livenessProbe.httpGet.path).toBe("/health");
    expect(openclawContainer.livenessProbe.httpGet.port).toBe(3000);
  });

  test("has init-hydration command with hydration logic", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const statefulset = manifests.statefulset;
    const spec = statefulset.spec as any;
    const initContainers = spec.template.spec.initContainers;

    const initContainer = initContainers.find(
      (c: any) => c.name === "init-hydration"
    );
    const command = initContainer.command as string[];

    expect(command).toBeDefined();
    // Command is ['/bin/sh', '-c', 'script'] so check the script portion
    expect(command.length).toBe(3);
    expect(command[2]).toContain("mkdir -p /openclaw-home/.openclaw");
    expect(command[2]).toContain("cp /config/openclaw.json /openclaw-home/.openclaw/");
  });

  test("applies custom image pull policy", () => {
    const input: ManifestInput = { ...BASE_INPUT, imagePullPolicy: "Always" };
    const manifests = generateKubernetesManifests(input);
    const statefulset = manifests.statefulset;
    const spec = statefulset.spec as any;
    const containers = spec.template.spec.containers;

    const openclawContainer = containers.find(
      (c: any) => c.name === "openclaw"
    );
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
    const spec = statefulset.spec as any;
    const containers = spec.template.spec.containers;

    const openclawContainer = containers.find(
      (c: any) => c.name === "openclaw"
    );
    expect(openclawContainer.resources).toBeDefined();
    expect(openclawContainer.resources.limits.cpu).toBe("500m");
    expect(openclawContainer.resources.limits.memory).toBe("512Mi");
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

    expect((service.metadata as any).name).toBe(
      getServiceName(TEST_ACCOUNT_ID, TEST_DEPLOYMENT_ID)
    );
  });

  test("has correct namespace", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const service = manifests.service;

    expect((service.metadata as any).namespace).toBe(getRuntimeNamespace());
  });

  test("has type ClusterIP", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const service = manifests.service;
    const spec = service.spec as any;

    expect(spec.type).toBe("ClusterIP");
  });

  test("has correct port configuration", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const service = manifests.service;
    const spec = service.spec as any;

    expect(spec.ports.length).toBe(1);
    expect(spec.ports[0].port).toBe(3000);
    expect(spec.ports[0].targetPort).toBe(3000);
    expect(spec.ports[0].protocol).toBe("TCP");
    expect(spec.ports[0].name).toBe("http");
  });

  test("has correct selector labels", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const service = manifests.service;
    const spec = service.spec as any;

    expect(spec.selector.app).toBe("abra");
    expect(spec.selector["abra.io/deployment-id"]).toBe(TEST_DEPLOYMENT_ID);
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

    expect((pvc.metadata as any).name).toBe(
      getPvcName(TEST_ACCOUNT_ID, TEST_DEPLOYMENT_ID)
    );
  });

  test("has correct namespace", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const pvc = manifests.pvc;

    expect((pvc.metadata as any).namespace).toBe(getRuntimeNamespace());
  });

  test("has correct access mode", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const pvc = manifests.pvc;
    const spec = pvc.spec as any;

    expect(spec.accessModes).toContain("ReadWriteOnce");
  });

  test("has correct storage request", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const pvc = manifests.pvc;
    const spec = pvc.spec as any;

    expect(spec.resources.requests.storage).toBe("1Gi");
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
    expect((statefulset.metadata as any).name).toBe(manifests.names.statefulSetName);
  });

  test("Service name matches naming helper", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const service = manifests.service;

    expect(manifests.names.serviceName).toBe(
      getServiceName(TEST_ACCOUNT_ID, TEST_DEPLOYMENT_ID)
    );
    expect((service.metadata as any).name).toBe(manifests.names.serviceName);
  });

  test("PVC name matches naming helper", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    const pvc = manifests.pvc;

    expect(manifests.names.pvcName).toBe(
      getPvcName(TEST_ACCOUNT_ID, TEST_DEPLOYMENT_ID)
    );
    expect((pvc.metadata as any).name).toBe(manifests.names.pvcName);
  });

  test("Pod name matches naming helper", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);

    expect(manifests.names.podName).toBe(
      getPodName(TEST_ACCOUNT_ID, TEST_DEPLOYMENT_ID)
    );
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
    (manifests.statefulset as any).apiVersion = "v1";
    expect(() => validateGeneratedManifests(manifests)).toThrow(
      "StatefulSet apiVersion mismatch"
    );
  });

  test("throws error for Service with wrong kind", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    (manifests.service as any).kind = "Deployment";
    expect(() => validateGeneratedManifests(manifests)).toThrow(
      "Service kind mismatch"
    );
  });

  test("throws error for PVC with missing accessModes", () => {
    const manifests = generateKubernetesManifests(BASE_INPUT);
    (manifests.pvc as any).spec.accessModes = undefined;
    expect(() => validateGeneratedManifests(manifests)).toThrow(
      "PVC missing spec.accessModes"
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
