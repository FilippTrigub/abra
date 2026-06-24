import type { Metadata } from "next";

import { LegalDocument } from "../components/legal-document";

export const metadata: Metadata = {
  title: "Privacy note",
  description:
    "How Abra handles sign-in, account settings, encrypted runtime configuration, and deployment data.",
};

const supportEmail = "filipp@trigub.tech";

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy note"
      description="This note explains what data Abra processes when someone visits the public site, signs in, configures their runtime, or manages deployments from the dashboard."
      lastUpdated="Last updated: June 24, 2026"
      relatedLinks={[{ href: "/legal", label: "Legal statement" }]}
      sections={[
        {
          title: "1. Data controller",
          body: (
            <p>
              Abra is operated by <strong>TRIGUB TECHNOLOGIES OÜ</strong>, Harju maakond, Tallinn, Kesklinna linnaosa, Narva mnt 5, 10117 Estonia. For privacy questions, contact us at <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
            </p>
          ),
        },
        {
          title: "2. Account and sign-in data",
          body: (
            <>
              <p>
                The platform uses Firebase Authentication for Google and GitHub sign-in. During sign-in, Abra processes the identity details needed to create a server session and connect the browser to the correct platform account, such as the authenticated user identifier and basic profile information returned by the sign-in provider.
              </p>
              <p>
                Session cookies are used to keep dashboard routes authenticated. The dashboard has no local auth bypass; authenticated pages require a valid Firebase-backed session.
              </p>
            </>
          ),
        },
        {
          title: "3. Settings and runtime configuration",
          body: (
            <>
              <p>
                Abra stores account settings in Firestore, including deployment-related preferences and the Telegram bot configuration required to start the runtime.
              </p>
              <p>
                User-managed skill and API environment values are encrypted at rest before storage. Saved values are summarized with redacted metadata and fingerprints and are not returned to the browser as plaintext after save or import.
              </p>
            </>
          ),
        },
        {
          title: "4. Deployment and orchestration data",
          body: (
            <p>
              When a user starts, stops, or updates their Abra runtime, the platform processes deployment records, operation status, runtime image details, and the configuration needed to orchestrate that runtime. In hosted mode, this can involve Kubernetes/AKS orchestration and generated runtime secrets for the user account.
            </p>
          ),
        },
        {
          title: "5. Purposes, recipients, and retention",
          body: (
            <>
              <p>
                We process data to operate Abra, secure dashboard access, persist account settings, deploy and manage the user runtime, troubleshoot incidents, and comply with legal or accounting obligations.
              </p>
              <p>
                Depending on the feature involved, data may be processed through services used by Abra, including Firebase for authentication and Firestore storage, deployment infrastructure for orchestration, and user-configured providers such as Telegram or publishing integrations when those values are supplied by the user.
              </p>
              <p>
                We keep data for as long as needed to operate the service, investigate incidents, comply with legal obligations, or defend our rights. Exact retention periods vary by data type and usage context.
              </p>
            </>
          ),
        },
        {
          title: "6. Your rights",
          body: (
            <p>
              Depending on applicable law, you may have rights to request access, correction, deletion, restriction, or objection to certain processing, and to contact a relevant supervisory authority. For requests, contact <a href={`mailto:${supportEmail}`}>{supportEmail}</a>. You can also review the <a href="/legal">Legal statement</a>.
            </p>
          ),
        },
      ]}
    />
  );
}
